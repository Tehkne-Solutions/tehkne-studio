import type { CommandResult, StudioCommand } from "../../command-bus/src/index.js";
import type { EngineeringRelationship } from "../../engineering-graph/src/index.js";
import type { EngineeringSession } from "../../engineering-session/src/index.js";
import {
  deriveMechanicalAxialConstraints,
  planMechanicalRotaryJointStep,
  type MechanicalAxialConstraint
} from "../../invention-assembly-runtime/src/index.js";
import {
  rotaryJointRelativeAngle,
  rotaryJointTargetDelta
} from "../../invention-assembly-runtime/src/rotary-relative-angle.js";
import type { InventionSpatialScene } from "../../invention-spatial-runtime/src/index.js";
import { mechanicalPortLocalPosition, mechanicalPortWorldPosition } from "./port-geometry.js";

export const MECHANICAL_ROTARY_STEP_COMMAND = "invention.mechanical.rotary.step" as const;
export const MECHANICAL_ROTARY_TARGET_COMMAND = "invention.mechanical.rotary.setTarget" as const;
export const MECHANICAL_COMMAND_SIGNATURE = "Tehkné Solutions" as const;

export interface MechanicalRotaryStepPayload {
  readonly relationshipId: string;
  readonly radians: number;
}

export interface MechanicalRotaryTargetPayload {
  readonly relationshipId: string;
  readonly targetRadians: number;
}

export interface MechanicalRotaryCommandResult {
  readonly commandId: string;
  readonly relationshipId: string;
  readonly source: StudioCommand["source"];
  readonly driverEntityId: string;
  readonly followerEntityId: string;
  readonly beforeRadians: number;
  readonly afterRadians: number;
  readonly deltaRadians: number;
  readonly mode: "incremental" | "principal-shortest";
  readonly changed: boolean;
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

interface ResolvedRotaryJoint {
  readonly constraint: MechanicalAxialConstraint;
  readonly relationship: EngineeringRelationship;
}

function finiteRadians(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
}

function normalizeNearZero(value: number): number {
  return Math.abs(value) <= 1e-12 ? 0 : value;
}

export class InventionMechanicalCommandRuntime {
  #sequence: number;

  constructor(
    readonly session: EngineeringSession,
    readonly spatial: InventionSpatialScene
  ) {
    if (spatial.session !== session) throw new Error("Mechanical command runtime requires the spatial scene from the same EngineeringSession");
    this.#sequence = this.#restoreCommandSequence();
    this.session.commands.register(MECHANICAL_ROTARY_STEP_COMMAND, (command) =>
      this.#executeStep(command as StudioCommand<MechanicalRotaryStepPayload>)
    );
    this.session.commands.register(MECHANICAL_ROTARY_TARGET_COMMAND, (command) =>
      this.#executeTarget(command as StudioCommand<MechanicalRotaryTargetPayload>)
    );
  }

  async step(
    relationshipId: string,
    radians: number,
    source: StudioCommand["source"] = "ui"
  ): Promise<CommandResult<MechanicalRotaryCommandResult>> {
    finiteRadians(radians, "Mechanical rotary step");
    return this.session.commands.dispatch<MechanicalRotaryCommandResult>({
      id: this.#nextCommandId(),
      type: MECHANICAL_ROTARY_STEP_COMMAND,
      payload: { relationshipId, radians },
      source,
      issuedAt: new Date().toISOString()
    });
  }

  async setTarget(
    relationshipId: string,
    targetRadians: number,
    source: StudioCommand["source"] = "ui"
  ): Promise<CommandResult<MechanicalRotaryCommandResult>> {
    finiteRadians(targetRadians, "Mechanical rotary target");
    return this.session.commands.dispatch<MechanicalRotaryCommandResult>({
      id: this.#nextCommandId(),
      type: MECHANICAL_ROTARY_TARGET_COMMAND,
      payload: { relationshipId, targetRadians },
      source,
      issuedAt: new Date().toISOString()
    });
  }

  #relationships(): readonly EngineeringRelationship[] {
    return this.session.graph.snapshot().relationships;
  }

  #resolveJoint(relationshipId: string): ResolvedRotaryJoint {
    const relationships = this.#relationships();
    const relationship = relationships.find((entry) => entry.id === relationshipId);
    if (!relationship || relationship.type !== "connectedTo" || relationship.metadata.inventionRuntime !== true) {
      throw new Error(`Mechanical rotary command requires an authored invention connectedTo relationship: ${relationshipId}`);
    }
    const constraint = deriveMechanicalAxialConstraints(this.session, relationships)
      .find((entry) => entry.relationshipId === relationshipId);
    if (!constraint) throw new Error(`Mechanical rotary command requires a rotary-shaft axial constraint: ${relationshipId}`);
    return { constraint, relationship };
  }

  #executeStep(command: StudioCommand<MechanicalRotaryStepPayload>): MechanicalRotaryCommandResult {
    finiteRadians(command.payload.radians, "Mechanical rotary step");
    return this.#apply(command, command.payload.relationshipId, command.payload.radians, "incremental");
  }

  #executeTarget(command: StudioCommand<MechanicalRotaryTargetPayload>): MechanicalRotaryCommandResult {
    finiteRadians(command.payload.targetRadians, "Mechanical rotary target");
    const { constraint } = this.#resolveJoint(command.payload.relationshipId);
    const driverBinding = this.spatial.binding(constraint.driver.entityId);
    const followerBinding = this.spatial.binding(constraint.follower.entityId);
    const target = rotaryJointTargetDelta(
      constraint.driverAxisLocal,
      constraint.followerAxisLocal,
      driverBinding.rotation,
      followerBinding.rotation,
      command.payload.targetRadians
    );
    return this.#apply(command, command.payload.relationshipId, target.deltaRadians, target.mode);
  }

  #apply(
    command: StudioCommand<MechanicalRotaryStepPayload | MechanicalRotaryTargetPayload>,
    relationshipId: string,
    deltaRadiansInput: number,
    mode: MechanicalRotaryCommandResult["mode"]
  ): MechanicalRotaryCommandResult {
    finiteRadians(deltaRadiansInput, "Mechanical rotary command delta");
    const deltaRadians = normalizeNearZero(deltaRadiansInput);
    const { constraint } = this.#resolveJoint(relationshipId);
    const driverEntity = this.session.getEntity(constraint.driver.entityId);
    const followerEntity = this.session.getEntity(constraint.follower.entityId);
    const driverBinding = this.spatial.binding(constraint.driver.entityId);
    const followerBinding = this.spatial.binding(constraint.follower.entityId);
    const driverEndpointLocal = mechanicalPortLocalPosition(driverEntity, constraint.driver.portId);
    const followerEndpointLocal = mechanicalPortLocalPosition(followerEntity, constraint.follower.portId);
    const driverEndpointWorld = mechanicalPortWorldPosition(driverEndpointLocal, driverBinding);
    const beforeRadians = rotaryJointRelativeAngle(
      constraint.driverAxisLocal,
      constraint.followerAxisLocal,
      driverBinding.rotation,
      followerBinding.rotation
    );
    const plan = planMechanicalRotaryJointStep(
      driverEndpointWorld,
      followerEndpointLocal,
      constraint.driverAxisLocal,
      constraint.followerAxisLocal,
      driverBinding,
      followerBinding,
      deltaRadians
    );
    this.spatial.transformBatch([{
      entityId: plan.entityId,
      position: plan.toPosition,
      rotation: plan.toRotation
    }]);
    const afterBinding = this.spatial.binding(constraint.follower.entityId);
    const afterRadians = normalizeNearZero(rotaryJointRelativeAngle(
      constraint.driverAxisLocal,
      constraint.followerAxisLocal,
      driverBinding.rotation,
      afterBinding.rotation
    ));
    const changed = Math.abs(deltaRadians) > 1e-12;
    const result: MechanicalRotaryCommandResult = {
      commandId: command.id,
      relationshipId,
      source: command.source,
      driverEntityId: constraint.driver.entityId,
      followerEntityId: constraint.follower.entityId,
      beforeRadians: normalizeNearZero(beforeRadians),
      afterRadians,
      deltaRadians,
      mode,
      changed,
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
    this.#recordEvidence(command, result);
    return result;
  }

  #recordEvidence(
    command: StudioCommand<MechanicalRotaryStepPayload | MechanicalRotaryTargetPayload>,
    result: MechanicalRotaryCommandResult
  ): void {
    this.session.events.record({
      id: `event-${this.session.events.list().length + 1}`,
      type: result.mode === "incremental" ? "MechanicalRotaryStepExecuted" : "MechanicalRotaryTargetExecuted",
      occurredAt: command.issuedAt,
      source: command.source,
      payload: {
        commandId: command.id,
        relationshipId: result.relationshipId,
        driverEntityId: result.driverEntityId,
        followerEntityId: result.followerEntityId,
        beforeRadians: result.beforeRadians,
        afterRadians: result.afterRadians,
        deltaRadians: result.deltaRadians,
        mode: result.mode,
        changed: result.changed,
        signature: result.signature
      }
    });
  }

  #restoreCommandSequence(): number {
    let maximum = 0;
    for (const event of this.session.events.list()) {
      const commandId = event.payload.commandId;
      if (typeof commandId !== "string") continue;
      const match = /^mechanical-cmd-(\d+)$/.exec(commandId);
      if (match?.[1]) maximum = Math.max(maximum, Number(match[1]));
    }
    return maximum;
  }

  #nextCommandId(): string {
    this.#sequence += 1;
    return `mechanical-cmd-${this.#sequence}`;
  }
}

const runtimeCache = new WeakMap<EngineeringSession, InventionMechanicalCommandRuntime>();

export function mechanicalCommandRuntimeFor(spatial: InventionSpatialScene): InventionMechanicalCommandRuntime {
  const session = spatial.session;
  const existing = runtimeCache.get(session);
  if (existing) {
    if (existing.spatial !== spatial) throw new Error("Mechanical command runtime already bound to another spatial scene for this session");
    return existing;
  }
  const runtime = new InventionMechanicalCommandRuntime(session, spatial);
  runtimeCache.set(session, runtime);
  return runtime;
}
