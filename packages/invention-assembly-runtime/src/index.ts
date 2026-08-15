import type { EngineeringEntity, EngineeringPort, EntityId } from "../../engineering-core/src/index.js";
import type { EngineeringRelationship } from "../../engineering-graph/src/index.js";
import type { EngineeringSession } from "../../engineering-session/src/index.js";
import { INVENTION_SPATIAL_BOUNDS } from "../../invention-spatial-runtime/src/index.js";
import type { SpatialEntityBinding, SpatialVector3 } from "../../spatial-runtime/src/index.js";

export const INVENTION_ASSEMBLY_VERSION = "1" as const;
export const INVENTION_ASSEMBLY_SIGNATURE = "Tehkné Solutions" as const;
export const ASSEMBLY_POSITION_EPSILON = 0.00001;
export const ASSEMBLY_AXIS_EPSILON = 0.00001;

export interface MechanicalAssemblyPortRef { readonly entityId: EntityId; readonly portId: string; }
export interface MechanicalAssemblyConstraint {
  readonly relationshipId: string;
  readonly driver: MechanicalAssemblyPortRef;
  readonly follower: MechanicalAssemblyPortRef;
  readonly sharedInterfaces: readonly string[];
  readonly constraint: "coincident";
  readonly derivedFrom: "engineering-graph";
}
export interface MechanicalOrientationConstraint {
  readonly relationshipId: string;
  readonly driver: MechanicalAssemblyPortRef;
  readonly follower: MechanicalAssemblyPortRef;
  readonly driverAxisLocal: SpatialVector3;
  readonly followerAxisLocal: SpatialVector3;
  readonly sharedInterfaces: readonly string[];
  readonly constraint: "axis-aligned";
  readonly derivedFrom: "engineering-graph";
}
export interface PlannedAssemblyMove { readonly entityId: EntityId; readonly from: SpatialVector3; readonly to: SpatialVector3; }

type Quaternion = { readonly x: number; readonly y: number; readonly z: number; readonly w: number };

function metadataPortId(relationship: EngineeringRelationship, key: "sourcePortId" | "targetPortId"): string {
  const value = relationship.metadata[key];
  if (typeof value !== "string" || !value) throw new Error(`Mechanical assembly requires ${key} on ${relationship.id}`);
  return value;
}
function port(session: EngineeringSession, entityId: EntityId, portId: string): EngineeringPort {
  const value = session.getEntity(entityId).ports[portId];
  if (!value) throw new Error(`Mechanical assembly references unknown port ${entityId}:${portId}`);
  return value;
}
function sharedMechanicalInterfaces(source: EngineeringPort, target: EngineeringPort): readonly string[] {
  return source.compatibility.filter((token) => target.compatibility.includes(token) && token.startsWith("mechanical."));
}
function finiteVector(value: SpatialVector3, label: string): void {
  if (![value.x, value.y, value.z].every(Number.isFinite)) throw new Error(`${label} must be finite`);
}
function withinBounds(position: SpatialVector3): boolean {
  const { min, max } = INVENTION_SPATIAL_BOUNDS;
  return position.x >= min.x && position.x <= max.x && position.y >= min.y && position.y <= max.y && position.z >= min.z && position.z <= max.z;
}
function vectorLabel(value: SpatialVector3): string { return `${value.x.toFixed(6)},${value.y.toFixed(6)},${value.z.toFixed(6)}`; }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function parseAxis(value: unknown, label: string): SpatialVector3 {
  if (!Array.isArray(value) || value.length !== 3 || !value.every((item) => typeof item === "number" && Number.isFinite(item))) throw new Error(`${label} must be [x,y,z]`);
  const axis = { x: Number(value[0]), y: Number(value[1]), z: Number(value[2]) };
  const length = Math.hypot(axis.x, axis.y, axis.z);
  if (length <= Number.EPSILON) throw new Error(`${label} must be non-zero`);
  return { x: axis.x / length, y: axis.y / length, z: axis.z / length };
}
function mechanicalPortLocalAxis(entity: EngineeringEntity, portId: string): SpatialVector3 {
  const direct = entity.metadata.mechanicalPortAxisMap;
  if (record(direct) && direct[portId] !== undefined) return parseAxis(direct[portId], `Mechanical port axis ${entity.id}:${portId}`);
  const proxy = entity.metadata.spatialProxy;
  if (record(proxy) && record(proxy.portAnchors)) {
    const anchor = proxy.portAnchors[portId];
    if (record(anchor) && anchor.axis !== undefined) return parseAxis(anchor.axis, `Mechanical proxy axis ${entity.id}:${portId}`);
  }
  throw new Error(`Mechanical orientation requires an authored local axis: ${entity.id}:${portId}`);
}
function normalized(value: SpatialVector3, label: string): SpatialVector3 {
  finiteVector(value, label);
  const length = Math.hypot(value.x, value.y, value.z);
  if (length <= Number.EPSILON) throw new Error(`${label} must be non-zero`);
  return { x: value.x / length, y: value.y / length, z: value.z / length };
}
function quaternionNormalize(value: Quaternion): Quaternion {
  const length = Math.hypot(value.x, value.y, value.z, value.w);
  if (length <= Number.EPSILON) return { x: 0, y: 0, z: 0, w: 1 };
  return { x: value.x / length, y: value.y / length, z: value.z / length, w: value.w / length };
}
function quaternionFromEulerXYZ(rotation: SpatialVector3): Quaternion {
  finiteVector(rotation, "Mechanical rotation");
  const c1 = Math.cos(rotation.x / 2), c2 = Math.cos(rotation.y / 2), c3 = Math.cos(rotation.z / 2);
  const s1 = Math.sin(rotation.x / 2), s2 = Math.sin(rotation.y / 2), s3 = Math.sin(rotation.z / 2);
  return quaternionNormalize({
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3
  });
}
function quaternionMultiply(left: Quaternion, right: Quaternion): Quaternion {
  return quaternionNormalize({
    x: left.w * right.x + left.x * right.w + left.y * right.z - left.z * right.y,
    y: left.w * right.y - left.x * right.z + left.y * right.w + left.z * right.x,
    z: left.w * right.z + left.x * right.y - left.y * right.x + left.z * right.w,
    w: left.w * right.w - left.x * right.x - left.y * right.y - left.z * right.z
  });
}
function quaternionFromUnitVectors(fromInput: SpatialVector3, toInput: SpatialVector3): Quaternion {
  const from = normalized(fromInput, "Mechanical source axis");
  const to = normalized(toInput, "Mechanical target axis");
  const dot = from.x * to.x + from.y * to.y + from.z * to.z;
  if (dot < -0.999999) {
    const candidate = Math.abs(from.x) > Math.abs(from.z)
      ? { x: -from.y, y: from.x, z: 0 }
      : { x: 0, y: -from.z, z: from.y };
    const axis = normalized(candidate, "Mechanical antiparallel correction axis");
    return { x: axis.x, y: axis.y, z: axis.z, w: 0 };
  }
  return quaternionNormalize({
    x: from.y * to.z - from.z * to.y,
    y: from.z * to.x - from.x * to.z,
    z: from.x * to.y - from.y * to.x,
    w: 1 + dot
  });
}
function applyQuaternion(vector: SpatialVector3, quaternion: Quaternion): SpatialVector3 {
  const q = quaternionNormalize(quaternion);
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
function quaternionToEulerXYZ(input: Quaternion): SpatialVector3 {
  const q = quaternionNormalize(input);
  const xx = q.x * q.x, yy = q.y * q.y, zz = q.z * q.z;
  const m11 = 1 - 2 * (yy + zz);
  const m12 = 2 * (q.x * q.y - q.w * q.z);
  const m13 = 2 * (q.x * q.z + q.w * q.y);
  const m22 = 1 - 2 * (xx + zz);
  const m23 = 2 * (q.y * q.z - q.w * q.x);
  const m32 = 2 * (q.y * q.z + q.w * q.x);
  const m33 = 1 - 2 * (xx + yy);
  const y = Math.asin(Math.max(-1, Math.min(1, m13)));
  if (Math.abs(m13) < 0.9999999) return { x: Math.atan2(-m23, m33), y, z: Math.atan2(-m12, m11) };
  return { x: Math.atan2(m32, m22), y, z: 0 };
}

export function deriveMechanicalAssemblyConstraints(session: EngineeringSession, relationships: readonly EngineeringRelationship[]): readonly MechanicalAssemblyConstraint[] {
  return relationships
    .filter((relationship) => relationship.type === "connectedTo" && relationship.metadata.inventionRuntime === true)
    .flatMap((relationship) => {
      const sourcePortId = metadataPortId(relationship, "sourcePortId");
      const targetPortId = metadataPortId(relationship, "targetPortId");
      const source = port(session, relationship.source, sourcePortId);
      const target = port(session, relationship.target, targetPortId);
      if (source.kind !== "mechanical" && target.kind !== "mechanical") return [];
      if (source.kind !== "mechanical" || target.kind !== "mechanical") throw new Error(`Mechanical assembly kind mismatch on ${relationship.id}`);
      const sharedInterfaces = sharedMechanicalInterfaces(source, target);
      if (sharedInterfaces.length === 0) throw new Error(`Mechanical assembly has no shared mechanical interface: ${relationship.id}`);
      return [{
        relationshipId: relationship.id,
        driver: { entityId: relationship.source, portId: sourcePortId },
        follower: { entityId: relationship.target, portId: targetPortId },
        sharedInterfaces,
        constraint: "coincident" as const,
        derivedFrom: "engineering-graph" as const
      }];
    });
}

export function deriveMechanicalOrientationConstraints(session: EngineeringSession, relationships: readonly EngineeringRelationship[]): readonly MechanicalOrientationConstraint[] {
  return deriveMechanicalAssemblyConstraints(session, relationships).map((constraint) => ({
    relationshipId: constraint.relationshipId,
    driver: constraint.driver,
    follower: constraint.follower,
    driverAxisLocal: mechanicalPortLocalAxis(session.getEntity(constraint.driver.entityId), constraint.driver.portId),
    followerAxisLocal: mechanicalPortLocalAxis(session.getEntity(constraint.follower.entityId), constraint.follower.portId),
    sharedInterfaces: constraint.sharedInterfaces,
    constraint: "axis-aligned" as const,
    derivedFrom: "engineering-graph" as const
  }));
}

export function mechanicalAssemblyMembers(constraints: readonly MechanicalAssemblyConstraint[], origin: EntityId): readonly EntityId[] {
  const adjacency = new Map<EntityId, Set<EntityId>>();
  for (const constraint of constraints) {
    const driver = adjacency.get(constraint.driver.entityId) ?? new Set<EntityId>(); driver.add(constraint.follower.entityId); adjacency.set(constraint.driver.entityId, driver);
    const follower = adjacency.get(constraint.follower.entityId) ?? new Set<EntityId>(); follower.add(constraint.driver.entityId); adjacency.set(constraint.follower.entityId, follower);
  }
  if (!adjacency.has(origin)) return [origin];
  const visited = new Set<EntityId>(); const queue: EntityId[] = [origin];
  while (queue.length > 0) {
    const current = queue.shift(); if (!current || visited.has(current)) continue; visited.add(current);
    for (const neighbour of adjacency.get(current) ?? []) if (!visited.has(neighbour)) queue.push(neighbour);
  }
  return [...visited];
}

export function coincidentFollowerPosition(driverEndpoint: SpatialVector3, followerEndpoint: SpatialVector3, followerBinding: SpatialEntityBinding): SpatialVector3 {
  finiteVector(driverEndpoint, "Mechanical driver endpoint"); finiteVector(followerEndpoint, "Mechanical follower endpoint");
  const next = {
    x: followerBinding.position.x + driverEndpoint.x - followerEndpoint.x,
    y: followerBinding.position.y + driverEndpoint.y - followerEndpoint.y,
    z: followerBinding.position.z + driverEndpoint.z - followerEndpoint.z
  };
  if (!withinBounds(next)) throw new Error(`Mechanical snap would move ${followerBinding.entityId} outside invention workspace bounds; driver=${vectorLabel(driverEndpoint)} follower=${vectorLabel(followerEndpoint)} next=${vectorLabel(next)}`);
  return next;
}

export function endpointsAreCoincident(left: SpatialVector3, right: SpatialVector3, epsilon = ASSEMBLY_POSITION_EPSILON): boolean {
  return Math.abs(left.x - right.x) <= epsilon && Math.abs(left.y - right.y) <= epsilon && Math.abs(left.z - right.z) <= epsilon;
}

export function mechanicalWorldAxis(localAxis: SpatialVector3, rotation: SpatialVector3): SpatialVector3 {
  return normalized(applyQuaternion(normalized(localAxis, "Mechanical local axis"), quaternionFromEulerXYZ(rotation)), "Mechanical world axis");
}

export function mechanicalAxesAreAligned(left: SpatialVector3, right: SpatialVector3, epsilon = ASSEMBLY_AXIS_EPSILON): boolean {
  const a = normalized(left, "Mechanical left axis");
  const b = normalized(right, "Mechanical right axis");
  const dot = a.x * b.x + a.y * b.y + a.z * b.z;
  return dot >= 1 - epsilon;
}

export function alignedFollowerRotation(driverAxisLocal: SpatialVector3, followerAxisLocal: SpatialVector3, driverRotation: SpatialVector3, followerRotation: SpatialVector3): SpatialVector3 {
  const driverWorld = mechanicalWorldAxis(driverAxisLocal, driverRotation);
  const followerWorld = mechanicalWorldAxis(followerAxisLocal, followerRotation);
  if (mechanicalAxesAreAligned(driverWorld, followerWorld)) return { ...followerRotation };
  const correction = quaternionFromUnitVectors(followerWorld, driverWorld);
  return quaternionToEulerXYZ(quaternionMultiply(correction, quaternionFromEulerXYZ(followerRotation)));
}

export function planMechanicalAssemblyTranslation(bindings: readonly SpatialEntityBinding[], memberIds: readonly EntityId[], delta: SpatialVector3): readonly PlannedAssemblyMove[] {
  finiteVector(delta, "Mechanical assembly translation");
  const bindingMap = new Map(bindings.map((binding) => [binding.entityId, binding]));
  return memberIds.map((entityId) => {
    const binding = bindingMap.get(entityId); if (!binding) throw new Error(`Mechanical assembly missing spatial binding: ${entityId}`);
    const to = { x: binding.position.x + delta.x, y: binding.position.y + delta.y, z: binding.position.z + delta.z };
    if (!withinBounds(to)) throw new Error(`Mechanical assembly move would place ${entityId} outside invention workspace bounds`);
    return { entityId, from: { ...binding.position }, to };
  });
}
