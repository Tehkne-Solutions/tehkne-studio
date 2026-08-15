import type { EngineeringPort, EntityId } from "../../engineering-core/src/index.js";
import type { EngineeringRelationship } from "../../engineering-graph/src/index.js";
import type { EngineeringSession } from "../../engineering-session/src/index.js";
import { INVENTION_SPATIAL_BOUNDS } from "../../invention-spatial-runtime/src/index.js";
import type { SpatialEntityBinding, SpatialVector3 } from "../../spatial-runtime/src/index.js";

export const INVENTION_ASSEMBLY_VERSION = "1" as const;
export const INVENTION_ASSEMBLY_SIGNATURE = "Tehkné Solutions" as const;
export const ASSEMBLY_POSITION_EPSILON = 0.00001;

export interface MechanicalAssemblyPortRef {
  readonly entityId: EntityId;
  readonly portId: string;
}

export interface MechanicalAssemblyConstraint {
  readonly relationshipId: string;
  readonly driver: MechanicalAssemblyPortRef;
  readonly follower: MechanicalAssemblyPortRef;
  readonly sharedInterfaces: readonly string[];
  readonly constraint: "coincident";
  readonly derivedFrom: "engineering-graph";
}

export interface PlannedAssemblyMove {
  readonly entityId: EntityId;
  readonly from: SpatialVector3;
  readonly to: SpatialVector3;
}

function metadataPortId(relationship: EngineeringRelationship, key: "sourcePortId" | "targetPortId"): string {
  const value = relationship.metadata[key];
  if (typeof value !== "string" || !value) {
    throw new Error(`Mechanical assembly requires ${key} on ${relationship.id}`);
  }
  return value;
}

function port(session: EngineeringSession, entityId: EntityId, portId: string): EngineeringPort {
  const entity = session.getEntity(entityId);
  const value = entity.ports[portId];
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
  return position.x >= min.x && position.x <= max.x
    && position.y >= min.y && position.y <= max.y
    && position.z >= min.z && position.z <= max.z;
}

function vectorLabel(value: SpatialVector3): string {
  return `${value.x.toFixed(6)},${value.y.toFixed(6)},${value.z.toFixed(6)}`;
}

export function deriveMechanicalAssemblyConstraints(
  session: EngineeringSession,
  relationships: readonly EngineeringRelationship[]
): readonly MechanicalAssemblyConstraint[] {
  return relationships
    .filter((relationship) => relationship.type === "connectedTo" && relationship.metadata.inventionRuntime === true)
    .flatMap((relationship) => {
      const sourcePortId = metadataPortId(relationship, "sourcePortId");
      const targetPortId = metadataPortId(relationship, "targetPortId");
      const source = port(session, relationship.source, sourcePortId);
      const target = port(session, relationship.target, targetPortId);
      if (source.kind !== "mechanical" && target.kind !== "mechanical") return [];
      if (source.kind !== "mechanical" || target.kind !== "mechanical") {
        throw new Error(`Mechanical assembly kind mismatch on ${relationship.id}`);
      }
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

export function mechanicalAssemblyMembers(
  constraints: readonly MechanicalAssemblyConstraint[],
  origin: EntityId
): readonly EntityId[] {
  const adjacency = new Map<EntityId, Set<EntityId>>();
  for (const constraint of constraints) {
    const driver = adjacency.get(constraint.driver.entityId) ?? new Set<EntityId>();
    driver.add(constraint.follower.entityId);
    adjacency.set(constraint.driver.entityId, driver);
    const follower = adjacency.get(constraint.follower.entityId) ?? new Set<EntityId>();
    follower.add(constraint.driver.entityId);
    adjacency.set(constraint.follower.entityId, follower);
  }
  if (!adjacency.has(origin)) return [origin];
  const visited = new Set<EntityId>();
  const queue: EntityId[] = [origin];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const neighbour of adjacency.get(current) ?? []) {
      if (!visited.has(neighbour)) queue.push(neighbour);
    }
  }
  return [...visited];
}

export function coincidentFollowerPosition(
  driverEndpoint: SpatialVector3,
  followerEndpoint: SpatialVector3,
  followerBinding: SpatialEntityBinding
): SpatialVector3 {
  finiteVector(driverEndpoint, "Mechanical driver endpoint");
  finiteVector(followerEndpoint, "Mechanical follower endpoint");
  const next = {
    x: followerBinding.position.x + driverEndpoint.x - followerEndpoint.x,
    y: followerBinding.position.y + driverEndpoint.y - followerEndpoint.y,
    z: followerBinding.position.z + driverEndpoint.z - followerEndpoint.z
  };
  if (!withinBounds(next)) {
    throw new Error(
      `Mechanical snap would move ${followerBinding.entityId} outside invention workspace bounds; `
      + `driver=${vectorLabel(driverEndpoint)} follower=${vectorLabel(followerEndpoint)} next=${vectorLabel(next)}`
    );
  }
  return next;
}

export function endpointsAreCoincident(
  left: SpatialVector3,
  right: SpatialVector3,
  epsilon = ASSEMBLY_POSITION_EPSILON
): boolean {
  return Math.abs(left.x - right.x) <= epsilon
    && Math.abs(left.y - right.y) <= epsilon
    && Math.abs(left.z - right.z) <= epsilon;
}

export function planMechanicalAssemblyTranslation(
  bindings: readonly SpatialEntityBinding[],
  memberIds: readonly EntityId[],
  delta: SpatialVector3
): readonly PlannedAssemblyMove[] {
  finiteVector(delta, "Mechanical assembly translation");
  const bindingMap = new Map(bindings.map((binding) => [binding.entityId, binding]));
  return memberIds.map((entityId) => {
    const binding = bindingMap.get(entityId);
    if (!binding) throw new Error(`Mechanical assembly missing spatial binding: ${entityId}`);
    const to = {
      x: binding.position.x + delta.x,
      y: binding.position.y + delta.y,
      z: binding.position.z + delta.z
    };
    if (!withinBounds(to)) throw new Error(`Mechanical assembly move would place ${entityId} outside invention workspace bounds`);
    return { entityId, from: { ...binding.position }, to };
  });
}
