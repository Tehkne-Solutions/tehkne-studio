import {
  hasCapability,
  setEngineeringProperty,
  type EngineeringEntity,
  type EntityId
} from "../../engineering-core/src/index.js";
import type { EngineeringSession } from "../../engineering-session/src/index.js";
import {
  forwardKinematics,
  planPickMotion,
  type ArmGeometry,
  type ArmJointLimits,
  type ArmJointPose,
  type MotionWaypoint,
  type PickMotionPlan,
  type Vector3
} from "../../robotics-runtime/src/index.js";

export interface ArmMotionRecord {
  readonly waypointId: string;
  readonly label: string;
  readonly pose: ArmJointPose;
  readonly endEffector: Vector3;
  readonly gripperOpeningMm: number;
  readonly occurredAt: string;
}

export interface ArmPickExecutionSummary {
  readonly taskId: string;
  readonly robotEntityId: EntityId;
  readonly targetEntityId: EntityId;
  readonly waypointCount: number;
  readonly finalPose: ArmJointPose;
  readonly finalPosition: Vector3;
  readonly attachedTo: EntityId;
  readonly message: string;
}

function numericProperty(entity: EngineeringEntity, propertyId: string): number {
  const value = entity.properties[propertyId]?.value;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${entity.id}.${propertyId} must be a finite number`);
  }
  return value;
}

function stringProperty(entity: EngineeringEntity, propertyId: string): string | null {
  const value = entity.properties[propertyId]?.value;
  return typeof value === "string" ? value : null;
}

function geometryFrom(entity: EngineeringEntity): ArmGeometry {
  const geometry = entity.metadata.geometry;
  if (!geometry || typeof geometry !== "object") throw new Error(`${entity.id} missing authored arm geometry`);
  const candidate = geometry as Record<string, unknown>;
  const baseHeight = candidate.baseHeight;
  const upperArmLength = candidate.upperArmLength;
  const forearmLength = candidate.forearmLength;
  if (
    typeof baseHeight !== "number" ||
    typeof upperArmLength !== "number" ||
    typeof forearmLength !== "number"
  ) {
    throw new Error(`${entity.id} arm geometry is incomplete`);
  }
  return { baseHeight, upperArmLength, forearmLength };
}

function jointLimit(entity: EngineeringEntity): { minDeg: number; maxDeg: number } {
  return {
    minDeg: numericProperty(entity, "minDeg"),
    maxDeg: numericProperty(entity, "maxDeg")
  };
}

function updateProperty(
  session: EngineeringSession,
  entityId: EntityId,
  propertyId: string,
  value: string | number | boolean | null
): EngineeringEntity {
  const before = session.getEntity(entityId);
  const after = setEngineeringProperty(before, propertyId, value);
  session.graph.replaceEntity(after);
  return after;
}

export class Arm01Controller {
  readonly #records: ArmMotionRecord[] = [];
  #sequence = 0;

  constructor(readonly session: EngineeringSession) {}

  records(): readonly ArmMotionRecord[] {
    return [...this.#records];
  }

  geometry(): ArmGeometry {
    return geometryFrom(this.session.getEntity("arm.root"));
  }

  limits(): ArmJointLimits {
    return {
      baseYaw: jointLimit(this.session.getEntity("arm.joint.base")),
      shoulder: jointLimit(this.session.getEntity("arm.joint.shoulder")),
      elbow: jointLimit(this.session.getEntity("arm.joint.elbow"))
    };
  }

  currentPose(): ArmJointPose {
    return {
      baseYawDeg: numericProperty(this.session.getEntity("arm.joint.base"), "angleDeg"),
      shoulderDeg: numericProperty(this.session.getEntity("arm.joint.shoulder"), "angleDeg"),
      elbowDeg: numericProperty(this.session.getEntity("arm.joint.elbow"), "angleDeg")
    };
  }

  targetPosition(targetEntityId: EntityId): Vector3 {
    const target = this.session.getEntity(targetEntityId);
    return {
      x: numericProperty(target, "xM"),
      y: numericProperty(target, "yM"),
      z: numericProperty(target, "zM")
    };
  }

  planPick(targetEntityId: EntityId): PickMotionPlan {
    return planPickMotion(this.geometry(), this.limits(), this.targetPosition(targetEntityId));
  }

  executePick(targetEntityId: EntityId): ArmPickExecutionSummary {
    const robot = this.session.getEntity("arm.root");
    const controller = this.session.getEntity("arm.controller");
    const target = this.session.getEntity(targetEntityId);
    const sensor = this.session.getEntity("arm.sensor.object");
    const gripper = this.session.getEntity("arm.gripper");
    const joints = [
      this.session.getEntity("arm.joint.base"),
      this.session.getEntity("arm.joint.shoulder"),
      this.session.getEntity("arm.joint.elbow")
    ];

    if (!hasCapability(robot, "pick")) throw new Error("ARM-01 does not expose pick capability");
    if (!hasCapability(controller, "runPick")) throw new Error("ARM-01 controller cannot execute pick tasks");
    if (!hasCapability(gripper, "setGripperOpening")) throw new Error("ARM-01 gripper cannot be commanded");
    for (const joint of joints) {
      if (!hasCapability(joint, "setJointTarget")) throw new Error(`${joint.name} cannot be commanded`);
    }
    if (target.type !== "Workpiece") throw new Error(`${target.name} is not a manipulable workpiece`);
    if (target.state !== "free") throw new Error(`${target.name} is not free for pickup`);

    const detected = sensor.properties.detected?.value === true;
    const detectedTarget = stringProperty(sensor, "targetEntityId");
    if (!detected || detectedTarget !== target.id) {
      throw new Error(`Object sensor has not confirmed ${target.name}`);
    }

    const payloadKg = numericProperty(robot, "payloadKg");
    const targetMassKg = numericProperty(target, "massKg");
    if (targetMassKg > payloadKg) {
      throw new Error(`${target.name} mass ${targetMassKg} kg exceeds ARM-01 payload ${payloadKg} kg`);
    }

    const plan = this.planPick(targetEntityId);
    if (plan.status !== "ready" || plan.waypoints.length === 0) {
      const reason = plan.reason ?? "Motion plan is blocked";
      this.session.events.record({
        id: `robotics-event-${this.session.events.list().length + 1}`,
        type: "MotionPlanBlocked",
        occurredAt: new Date().toISOString(),
        source: "simulation",
        payload: { robotEntityId: robot.id, targetEntityId, reason }
      });
      throw new Error(reason);
    }

    const taskId = `pick-${++this.#sequence}`;
    updateProperty(this.session, "arm.root", "taskState", "picking");
    updateProperty(this.session, "arm.controller", "motionState", "running");
    updateProperty(this.session, "arm.controller", "activeTargetId", target.id);
    this.session.events.record({
      id: `robotics-event-${this.session.events.list().length + 1}`,
      type: "MotionPlanCreated",
      occurredAt: new Date().toISOString(),
      source: "simulation",
      payload: {
        taskId,
        robotEntityId: robot.id,
        targetEntityId,
        waypointIds: plan.waypoints.map((waypoint) => waypoint.id)
      }
    });

    for (const waypoint of plan.waypoints) this.#applyWaypoint(taskId, waypoint, target.id);

    const finalWaypoint = plan.waypoints.at(-1)!;
    const finalPosition = forwardKinematics(this.geometry(), finalWaypoint.pose);
    updateProperty(this.session, target.id, "xM", finalPosition.x);
    updateProperty(this.session, target.id, "yM", finalPosition.y);
    updateProperty(this.session, target.id, "zM", finalPosition.z);
    updateProperty(this.session, "arm.root", "taskState", "holding");
    updateProperty(this.session, "arm.controller", "motionState", "completed");

    this.session.events.record({
      id: `robotics-event-${this.session.events.list().length + 1}`,
      type: "PickTaskCompleted",
      occurredAt: new Date().toISOString(),
      source: "simulation",
      payload: {
        taskId,
        robotEntityId: robot.id,
        targetEntityId,
        finalPose: finalWaypoint.pose,
        finalPosition
      }
    });

    return {
      taskId,
      robotEntityId: robot.id,
      targetEntityId,
      waypointCount: plan.waypoints.length,
      finalPose: finalWaypoint.pose,
      finalPosition,
      attachedTo: "arm.gripper",
      message: `${robot.name} pegou ${target.name} em ${plan.waypoints.length} etapas e mantém o objeto na garra.`
    };
  }

  #applyWaypoint(taskId: string, waypoint: MotionWaypoint, targetEntityId: EntityId): void {
    this.#setJoint("arm.joint.base", waypoint.pose.baseYawDeg);
    this.#setJoint("arm.joint.shoulder", waypoint.pose.shoulderDeg);
    this.#setJoint("arm.joint.elbow", waypoint.pose.elbowDeg);
    updateProperty(this.session, "arm.gripper", "openingMm", waypoint.gripperOpeningMm);

    const endEffector = forwardKinematics(this.geometry(), waypoint.pose);
    const occurredAt = new Date().toISOString();
    const record: ArmMotionRecord = {
      waypointId: waypoint.id,
      label: waypoint.label,
      pose: waypoint.pose,
      endEffector,
      gripperOpeningMm: waypoint.gripperOpeningMm,
      occurredAt
    };
    this.#records.push(record);
    this.session.events.record({
      id: `robotics-event-${this.session.events.list().length + 1}`,
      type: "MotionWaypointReached",
      occurredAt,
      source: "simulation",
      payload: { taskId, ...record }
    });

    if (waypoint.id === "close") this.#attachTarget(taskId, targetEntityId);
  }

  #setJoint(entityId: EntityId, angleDeg: number): void {
    updateProperty(this.session, entityId, "targetDeg", angleDeg);
    updateProperty(this.session, entityId, "angleDeg", angleDeg);
    this.session.events.record({
      id: `robotics-event-${this.session.events.list().length + 1}`,
      type: "JointTargetChanged",
      occurredAt: new Date().toISOString(),
      source: "simulation",
      payload: { entityId, angleDeg }
    });
  }

  #attachTarget(taskId: string, targetEntityId: EntityId): void {
    const target = this.session.getEntity(targetEntityId);
    const held: EngineeringEntity = { ...target, state: "held" };
    this.session.graph.replaceEntity(held);
    updateProperty(this.session, targetEntityId, "attachedTo", "arm.gripper");
    updateProperty(this.session, "arm.gripper", "holdingEntityId", targetEntityId);
    const attachedRelationshipId = `attachment-${targetEntityId}-arm.gripper`;
    const alreadyAttached = this.session.graph
      .snapshot()
      .relationships.some((relationship) => relationship.id === attachedRelationshipId);
    if (!alreadyAttached) {
      this.session.graph.connect({
        id: attachedRelationshipId,
        source: targetEntityId,
        target: "arm.gripper",
        type: "attachedTo",
        metadata: { taskId }
      });
    }
    this.session.events.record({
      id: `robotics-event-${this.session.events.list().length + 1}`,
      type: "GripperClosed",
      occurredAt: new Date().toISOString(),
      source: "simulation",
      payload: { taskId, gripperEntityId: "arm.gripper", openingMm: numericProperty(this.session.getEntity("arm.gripper"), "openingMm") }
    });
    this.session.events.record({
      id: `robotics-event-${this.session.events.list().length + 1}`,
      type: "ObjectAttached",
      occurredAt: new Date().toISOString(),
      source: "simulation",
      payload: { taskId, targetEntityId, gripperEntityId: "arm.gripper" }
    });
  }
}
