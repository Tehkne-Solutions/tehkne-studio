import type { EngineeringEntity } from "../../engineering-core/src/index.js";
import type { SpatialEntityBinding, SpatialVector3 } from "../../spatial-runtime/src/index.js";

interface Quaternion { readonly x: number; readonly y: number; readonly z: number; readonly w: number; }

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseVector(value: unknown, label: string): SpatialVector3 {
  if (!Array.isArray(value) || value.length !== 3 || !value.every((item) => typeof item === "number" && Number.isFinite(item))) {
    throw new Error(`${label} must be [x,y,z]`);
  }
  return { x: Number(value[0]), y: Number(value[1]), z: Number(value[2]) };
}

function normalizeQuaternion(value: Quaternion): Quaternion {
  const length = Math.hypot(value.x, value.y, value.z, value.w);
  if (!Number.isFinite(length) || length <= Number.EPSILON) throw new Error("Mechanical port quaternion must be finite and non-zero");
  return { x: value.x / length, y: value.y / length, z: value.z / length, w: value.w / length };
}

function eulerXyzToQuaternion(rotation: SpatialVector3): Quaternion {
  if (![rotation.x, rotation.y, rotation.z].every(Number.isFinite)) throw new Error("Mechanical port rotation must be finite");
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

export function mechanicalPortLocalPosition(entity: EngineeringEntity, portId: string): SpatialVector3 {
  const direct = entity.metadata.mechanicalPortPositionMap;
  if (record(direct) && direct[portId] !== undefined) {
    return parseVector(direct[portId], `Mechanical port position ${entity.id}:${portId}`);
  }

  const proxy = entity.metadata.spatialProxy;
  if (record(proxy) && record(proxy.portAnchors)) {
    const anchor = proxy.portAnchors[portId];
    if (record(anchor) && anchor.position !== undefined) {
      return parseVector(anchor.position, `Mechanical proxy position ${entity.id}:${portId}`);
    }
  }

  throw new Error(`Mechanical command requires an authored local port position: ${entity.id}:${portId}`);
}

export function mechanicalPortWorldPosition(localPosition: SpatialVector3, binding: SpatialEntityBinding): SpatialVector3 {
  if (![localPosition.x, localPosition.y, localPosition.z].every(Number.isFinite)) throw new Error("Mechanical local port position must be finite");
  const scaled = {
    x: localPosition.x * binding.scale.x,
    y: localPosition.y * binding.scale.y,
    z: localPosition.z * binding.scale.z
  };
  const rotated = applyQuaternion(scaled, eulerXyzToQuaternion(binding.rotation));
  return {
    x: binding.position.x + rotated.x,
    y: binding.position.y + rotated.y,
    z: binding.position.z + rotated.z
  };
}
