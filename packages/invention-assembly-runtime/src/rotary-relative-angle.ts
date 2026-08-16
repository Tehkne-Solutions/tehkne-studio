import type { SpatialVector3 } from "../../spatial-runtime/src/index.js";

export const ROTARY_RELATIVE_ANGLE_EPSILON = 0.00001;

interface Quaternion { readonly x: number; readonly y: number; readonly z: number; readonly w: number; }

export interface RotaryJointTargetDelta {
  readonly currentRadians: number;
  readonly targetRadians: number;
  readonly deltaRadians: number;
  readonly mode: "principal-shortest";
}

function finiteVector(value: SpatialVector3, label: string): void {
  if (![value.x, value.y, value.z].every(Number.isFinite)) throw new Error(`${label} must be finite`);
}

function normalized(value: SpatialVector3, label: string): SpatialVector3 {
  finiteVector(value, label);
  const length = Math.hypot(value.x, value.y, value.z);
  if (!Number.isFinite(length) || length <= Number.EPSILON) throw new Error(`${label} must be non-zero`);
  return { x: value.x / length, y: value.y / length, z: value.z / length };
}

function normalizeQuaternion(value: Quaternion): Quaternion {
  const length = Math.hypot(value.x, value.y, value.z, value.w);
  if (!Number.isFinite(length) || length <= Number.EPSILON) throw new Error("Rotary relative-angle quaternion must be finite and non-zero");
  return { x: value.x / length, y: value.y / length, z: value.z / length, w: value.w / length };
}

function eulerXyzToQuaternion(rotation: SpatialVector3): Quaternion {
  finiteVector(rotation, "Rotary relative-angle rotation");
  const cx = Math.cos(rotation.x / 2); const sx = Math.sin(rotation.x / 2);
  const cy = Math.cos(rotation.y / 2); const sy = Math.sin(rotation.y / 2);
  const cz = Math.cos(rotation.z / 2); const sz = Math.sin(rotation.z / 2);
  return normalizeQuaternion({
    x: sx * cy * cz + cx * sy * sz,
    y: cx * sy * cz - sx * cy * sz,
    z: cx * cy * sz + sx * sy * cz,
    w: cx * cy * cz - sx * sy * sz
  });
}

function applyQuaternion(vector: SpatialVector3, quaternion: Quaternion): SpatialVector3 {
  const q = normalizeQuaternion(quaternion);
  const ix = q.w * vector.x + q.y * vector.z - q.z * vector.y;
  const iy = q.w * vector.y + q.z * vector.x - q.x * vector.z;
  const iz = q.w * vector.z + q.x * vector.y - q.y * vector.x;
  const iw = -q.x * vector.x - q.y * vector.y - q.z * vector.z;
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x
  };
}

function dot(left: SpatialVector3, right: SpatialVector3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function cross(left: SpatialVector3, right: SpatialVector3): SpatialVector3 {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x
  };
}

function localReferenceTangent(axisInput: SpatialVector3): SpatialVector3 {
  const axis = normalized(axisInput, "Rotary local axis");
  const seed = Math.abs(axis.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
  return normalized(cross(seed, axis), "Rotary local reference tangent");
}

function worldAxis(localAxis: SpatialVector3, rotation: SpatialVector3): SpatialVector3 {
  return normalized(applyQuaternion(normalized(localAxis, "Rotary local axis"), eulerXyzToQuaternion(rotation)), "Rotary world axis");
}

function worldReferenceTangent(localAxis: SpatialVector3, rotation: SpatialVector3): SpatialVector3 {
  return normalized(applyQuaternion(localReferenceTangent(localAxis), eulerXyzToQuaternion(rotation)), "Rotary world reference tangent");
}

export function normalizePrincipalAngle(radians: number): number {
  if (!Number.isFinite(radians)) throw new Error("Rotary relative angle must be finite");
  let normalizedAngle = Math.atan2(Math.sin(radians), Math.cos(radians));
  if (Object.is(normalizedAngle, -0) || Math.abs(normalizedAngle) <= ROTARY_RELATIVE_ANGLE_EPSILON) normalizedAngle = 0;
  return normalizedAngle;
}

export function rotaryJointRelativeAngle(
  driverAxisLocal: SpatialVector3,
  followerAxisLocal: SpatialVector3,
  driverRotation: SpatialVector3,
  followerRotation: SpatialVector3,
  epsilon = ROTARY_RELATIVE_ANGLE_EPSILON
): number {
  if (!Number.isFinite(epsilon) || epsilon < 0) throw new Error("Rotary relative-angle epsilon must be finite and non-negative");
  const driverAxisWorld = worldAxis(driverAxisLocal, driverRotation);
  const followerAxisWorld = worldAxis(followerAxisLocal, followerRotation);
  if (dot(driverAxisWorld, followerAxisWorld) < 1 - epsilon) throw new Error("Rotary relative angle requires aligned shaft axes");

  const driverTangentWorld = worldReferenceTangent(driverAxisLocal, driverRotation);
  const followerTangentWorld = worldReferenceTangent(followerAxisLocal, followerRotation);
  const cosine = Math.max(-1, Math.min(1, dot(driverTangentWorld, followerTangentWorld)));
  const sine = dot(driverAxisWorld, cross(driverTangentWorld, followerTangentWorld));
  return normalizePrincipalAngle(Math.atan2(sine, cosine));
}

export function rotaryJointTargetDelta(
  driverAxisLocal: SpatialVector3,
  followerAxisLocal: SpatialVector3,
  driverRotation: SpatialVector3,
  followerRotation: SpatialVector3,
  targetRadiansInput: number,
  epsilon = ROTARY_RELATIVE_ANGLE_EPSILON
): RotaryJointTargetDelta {
  if (!Number.isFinite(targetRadiansInput)) throw new Error("Rotary target angle must be finite");
  const currentRadians = rotaryJointRelativeAngle(driverAxisLocal, followerAxisLocal, driverRotation, followerRotation, epsilon);
  const targetRadians = normalizePrincipalAngle(targetRadiansInput);
  const deltaRadians = normalizePrincipalAngle(targetRadians - currentRadians);
  return { currentRadians, targetRadians, deltaRadians, mode: "principal-shortest" };
}
