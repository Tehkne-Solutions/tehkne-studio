export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface JointLimit {
  readonly minDeg: number;
  readonly maxDeg: number;
}

export interface ArmGeometry {
  readonly baseHeight: number;
  readonly upperArmLength: number;
  readonly forearmLength: number;
}

export interface ArmJointLimits {
  readonly baseYaw: JointLimit;
  readonly shoulder: JointLimit;
  readonly elbow: JointLimit;
}

export interface ArmJointPose {
  readonly baseYawDeg: number;
  readonly shoulderDeg: number;
  readonly elbowDeg: number;
}

export interface ArmIkResult {
  readonly status: "solved" | "unreachable" | "limit";
  readonly target: Vector3;
  readonly pose?: ArmJointPose;
  readonly reason?: string;
}

export interface MotionWaypoint {
  readonly id: string;
  readonly label: string;
  readonly target: Vector3;
  readonly gripperOpeningMm: number;
  readonly pose: ArmJointPose;
}

export interface PickMotionPlan {
  readonly status: "ready" | "blocked";
  readonly target: Vector3;
  readonly waypoints: readonly MotionWaypoint[];
  readonly reason?: string;
}

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function within(value: number, limit: JointLimit): boolean {
  return value >= limit.minDeg && value <= limit.maxDeg;
}

export function solveArmIk(
  geometry: ArmGeometry,
  limits: ArmJointLimits,
  target: Vector3
): ArmIkResult {
  const radial = Math.hypot(target.x, target.z);
  const vertical = target.y - geometry.baseHeight;
  const distance = Math.hypot(radial, vertical);
  const minimumReach = Math.abs(geometry.upperArmLength - geometry.forearmLength);
  const maximumReach = geometry.upperArmLength + geometry.forearmLength;

  if (distance < minimumReach || distance > maximumReach) {
    return {
      status: "unreachable",
      target,
      reason: `Target distance ${distance.toFixed(3)} m is outside arm reach ${minimumReach.toFixed(3)}–${maximumReach.toFixed(3)} m.`
    };
  }

  const cosElbow = clamp(
    (distance ** 2 - geometry.upperArmLength ** 2 - geometry.forearmLength ** 2) /
      (2 * geometry.upperArmLength * geometry.forearmLength),
    -1,
    1
  );
  const elbowRad = Math.acos(cosElbow);
  const shoulderRad =
    Math.atan2(vertical, radial) -
    Math.atan2(
      geometry.forearmLength * Math.sin(elbowRad),
      geometry.upperArmLength + geometry.forearmLength * Math.cos(elbowRad)
    );

  const pose: ArmJointPose = {
    baseYawDeg: Math.atan2(target.z, target.x) * RAD_TO_DEG,
    shoulderDeg: shoulderRad * RAD_TO_DEG,
    elbowDeg: elbowRad * RAD_TO_DEG
  };

  if (!within(pose.baseYawDeg, limits.baseYaw)) {
    return { status: "limit", target, reason: `Base yaw ${pose.baseYawDeg.toFixed(2)}° exceeds joint limits.` };
  }
  if (!within(pose.shoulderDeg, limits.shoulder)) {
    return { status: "limit", target, reason: `Shoulder ${pose.shoulderDeg.toFixed(2)}° exceeds joint limits.` };
  }
  if (!within(pose.elbowDeg, limits.elbow)) {
    return { status: "limit", target, reason: `Elbow ${pose.elbowDeg.toFixed(2)}° exceeds joint limits.` };
  }

  return { status: "solved", target, pose };
}

export function forwardKinematics(geometry: ArmGeometry, pose: ArmJointPose): Vector3 {
  const yaw = pose.baseYawDeg * DEG_TO_RAD;
  const shoulder = pose.shoulderDeg * DEG_TO_RAD;
  const elbow = pose.elbowDeg * DEG_TO_RAD;
  const radial =
    geometry.upperArmLength * Math.cos(shoulder) +
    geometry.forearmLength * Math.cos(shoulder + elbow);
  const y =
    geometry.baseHeight +
    geometry.upperArmLength * Math.sin(shoulder) +
    geometry.forearmLength * Math.sin(shoulder + elbow);

  return {
    x: radial * Math.cos(yaw),
    y,
    z: radial * Math.sin(yaw)
  };
}

function solvedWaypoint(
  id: string,
  label: string,
  target: Vector3,
  opening: number,
  geometry: ArmGeometry,
  limits: ArmJointLimits
): MotionWaypoint | string {
  const result = solveArmIk(geometry, limits, target);
  if (result.status !== "solved" || !result.pose) return result.reason ?? `Waypoint ${id} cannot be solved.`;
  return { id, label, target, gripperOpeningMm: opening, pose: result.pose };
}

export function planPickMotion(
  geometry: ArmGeometry,
  limits: ArmJointLimits,
  target: Vector3,
  gripperClosedMm = 28
): PickMotionPlan {
  const specs = [
    ["approach", "Approach", { ...target, y: target.y + 0.25 }, 60] as const,
    ["grasp", "Grasp", target, 60] as const,
    ["close", "Close gripper", target, gripperClosedMm] as const,
    ["lift", "Lift", { ...target, y: target.y + 0.45 }, gripperClosedMm] as const
  ];
  const waypoints: MotionWaypoint[] = [];

  for (const [id, label, point, opening] of specs) {
    const waypoint = solvedWaypoint(id, label, point, opening, geometry, limits);
    if (typeof waypoint === "string") {
      return { status: "blocked", target, waypoints, reason: waypoint };
    }
    waypoints.push(waypoint);
  }

  return { status: "ready", target, waypoints };
}
