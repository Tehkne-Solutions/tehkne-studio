import type { EngineeringPort, EntityId } from "../../engineering-core/src/index.js";
import type { EngineeringRelationship } from "../../engineering-graph/src/index.js";
import type { EngineeringSession } from "../../engineering-session/src/index.js";
import { INVENTION_SPATIAL_BOUNDS } from "../../invention-spatial-runtime/src/index.js";
import type { SpatialEntityBinding, SpatialVector3 } from "../../spatial-runtime/src/index.js";

export const INVENTION_ASSEMBLY_VERSION = "1" as const;
export const INVENTION_ASSEMBLY_SIGNATURE = "Tehkné Solutions" as const;
export const ASSEMBLY_POSITION_EPSILON = 0.00001;

export interface MechanicalAssemblyPortRef { readonly entityId: EntityId; readonly portId: string; }
export interface MechanicalAssemblyConstraint {
  readonly relationshipId: string;
  readonly driver: MechanicalAssemblyPortRef;
  readonly follower: MechanicalAssemblyPortRef;
  readonly sharedInterfaces: readonly string[];
  readonly constraint: "coincident";
  readonly derivedFrom: "engineering-graph";
}
export interface PlannedAssemblyMove { readonly entityId: EntityId; readonly from: SpatialVector3; readonly to: SpatialVector3; }
export type MechanicalRotationAxis = "x" | "y" | "z";
export interface PlannedAssemblyRotation {
  readonly entityId: EntityId;
  readonly fromPosition: SpatialVector3;
  readonly toPosition: SpatialVector3;
  readonly fromRotation: SpatialVector3;
  readonly toRotation: SpatialVector3;
}
interface Quaternion { readonly x: number; readonly y: number; readonly z: number; readonly w: number; }

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
function clampUnit(value: number): number { return Math.max(-1, Math.min(1, value)); }
function normalizeQuaternion(value: Quaternion): Quaternion {
  const length = Math.hypot(value.x, value.y, value.z, value.w);
  if (!Number.isFinite(length) || length === 0) throw new Error("Mechanical assembly quaternion must be finite and non-zero");
  return { x: value.x / length, y: value.y / length, z: value.z / length, w: value.w / length };
}
function multiplyQuaternion(left: Quaternion, right: Quaternion): Quaternion {
  return normalizeQuaternion({
    x: left.w * right.x + left.x * right.w + left.y * right.z - left.z * right.y,
    y: left.w * right.y - left.x * right.z + left.y * right.w + left.z * right.x,
    z: left.w * right.z + left.x * right.y - left.y * right.x + left.z * right.w,
    w: left.w * right.w - left.x * right.x - left.y * right.y - left.z * right.z
  });
}
function eulerXyzToQuaternion(rotation: SpatialVector3): Quaternion {
  finiteVector(rotation, "Mechanical assembly rotation");
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
function quaternionToEulerXyz(input: Quaternion): SpatialVector3 {
  const { x, y, z, w } = normalizeQuaternion(input);
  const m11 = 1 - 2 * (y * y + z * z);
  const m12 = 2 * (x * y - w * z);
  const m13 = 2 * (x * z + w * y);
  const m22 = 1 - 2 * (x * x + z * z);
  const m23 = 2 * (y * z - w * x);
  const m32 = 2 * (y * z + w * x);
  const m33 = 1 - 2 * (x * x + y * y);
  const ry = Math.asin(clampUnit(m13));
  if (Math.abs(m13) < 0.9999999) {
    return { x: Math.atan2(-m23, m33), y: ry, z: Math.atan2(-m12, m11) };
  }
  return { x: Math.atan2(m32, m22), y: ry, z: 0 };
}
function axisQuaternion(axis: MechanicalRotationAxis, radians: number): Quaternion {
  if (!Number.isFinite(radians)) throw new Error("Mechanical assembly rotation radians must be finite");
  const sine = Math.sin(radians / 2); const cosine = Math.cos(radians / 2);
  if (axis === "x") return { x: sine, y: 0, z: 0, w: cosine };
  if (axis === "y") return { x: 0, y: sine, z: 0, w: cosine };
  if (axis === "z") return { x: 0, y: 0, z: sine, w: cosine };
  throw new Error(`Unsupported mechanical assembly rotation axis: ${String(axis)}`);
}
function rotateOffset(offset: SpatialVector3, axis: MechanicalRotationAxis, radians: number): SpatialVector3 {
  const cosine = Math.cos(radians); const sine = Math.sin(radians);
  if (axis === "x") return { x: offset.x, y: offset.y * cosine - offset.z * sine, z: offset.y * sine + offset.z * cosine };
  if (axis === "y") return { x: offset.x * cosine + offset.z * sine, y: offset.y, z: -offset.x * sine + offset.z * cosine };
  return { x: offset.x * cosine - offset.y * sine, y: offset.x * sine + offset.y * cosine, z: offset.z };
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

export function planMechanicalAssemblyRotation(
  bindings: readonly SpatialEntityBinding[],
  memberIds: readonly EntityId[],
  pivotEntityId: EntityId,
  axis: MechanicalRotationAxis,
  radians: number
): readonly PlannedAssemblyRotation[] {
  if (!Number.isFinite(radians)) throw new Error("Mechanical assembly rotation radians must be finite");
  const bindingMap = new Map(bindings.map((binding) => [binding.entityId, binding]));
  const pivotBinding = bindingMap.get(pivotEntityId);
  if (!pivotBinding) throw new Error(`Mechanical assembly missing pivot spatial binding: ${pivotEntityId}`);
  if (!memberIds.includes(pivotEntityId)) throw new Error(`Mechanical assembly pivot ${pivotEntityId} is not part of the planned member set`);
  const deltaQuaternion = axisQuaternion(axis, radians);
  const plans = memberIds.map((entityId) => {
    const binding = bindingMap.get(entityId);
    if (!binding) throw new Error(`Mechanical assembly missing spatial binding: ${entityId}`);
    finiteVector(binding.position, `Mechanical assembly ${entityId} position`);
    finiteVector(binding.rotation, `Mechanical assembly ${entityId} rotation`);
    const offset = {
      x: binding.position.x - pivotBinding.position.x,
      y: binding.position.y - pivotBinding.position.y,
      z: binding.position.z - pivotBinding.position.z
    };
    const rotatedOffset = rotateOffset(offset, axis, radians);
    const toPosition = {
      x: pivotBinding.position.x + rotatedOffset.x,
      y: pivotBinding.position.y + rotatedOffset.y,
      z: pivotBinding.position.z + rotatedOffset.z
    };
    if (!withinBounds(toPosition)) throw new Error(`Mechanical assembly rotation would place ${entityId} outside invention workspace bounds`);
    const currentQuaternion = eulerXyzToQuaternion(binding.rotation);
    const toRotation = quaternionToEulerXyz(multiplyQuaternion(deltaQuaternion, currentQuaternion));
    finiteVector(toRotation, `Mechanical assembly ${entityId} planned rotation`);
    return {
      entityId,
      fromPosition: { ...binding.position },
      toPosition,
      fromRotation: { ...binding.rotation },
      toRotation
    };
  });
  return plans;
}
