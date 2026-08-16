import type { EngineeringEntity, EntityId } from "../../engineering-core/src/index.js";
import type { EngineeringRelationship } from "../../engineering-graph/src/index.js";
import type { EngineeringSession } from "../../engineering-session/src/index.js";
import {
  createSpatialBinding,
  resolveSpatialSelection,
  type SpatialEntityBinding,
  type SpatialSelection,
  type SpatialVector3
} from "../../spatial-runtime/src/index.js";

export const INVENTION_SPATIAL_VERSION = "1" as const;
export const INVENTION_SPATIAL_SIGNATURE = "Tehkné Solutions" as const;
export const INVENTION_SPATIAL_AUTO_LAYOUT_CAPACITY = 24 as const;

export const INVENTION_SPATIAL_BOUNDS = Object.freeze({
  min: { x: -0.5, y: -0.3, z: -0.1 },
  max: { x: 0.5, y: 0.3, z: 0.3 }
});

export interface InventionSpatialDocument {
  readonly version: typeof INVENTION_SPATIAL_VERSION;
  readonly signature: typeof INVENTION_SPATIAL_SIGNATURE;
  readonly projectId: string;
  readonly bindings: readonly SpatialEntityBinding[];
}

export interface InventionSpatialConnectionSegment {
  readonly relationshipId: string;
  readonly sourceEntityId: EntityId;
  readonly sourcePortId: string;
  readonly targetEntityId: EntityId;
  readonly targetPortId: string;
  readonly source: SpatialVector3;
  readonly target: SpatialVector3;
  readonly sharedInterfaces: readonly string[];
}

export interface InventionSpatialTransformMutation {
  readonly entityId: EntityId;
  readonly position: SpatialVector3;
  readonly rotation: SpatialVector3;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isInventionComponent(entity: EngineeringEntity): boolean {
  return entity.metadata.inventionComponent === true && entity.parentId === "invention.root";
}

function assertFiniteVector(vector: SpatialVector3, label: string): void {
  for (const [axis, value] of Object.entries(vector)) {
    if (!Number.isFinite(value)) throw new Error(`${label} ${axis} must be finite`);
  }
}

function assertFinitePosition(position: SpatialVector3): void {
  assertFiniteVector(position, "Spatial position");
  const { min, max } = INVENTION_SPATIAL_BOUNDS;
  if (position.x < min.x || position.x > max.x || position.y < min.y || position.y > max.y || position.z < min.z || position.z > max.z) {
    throw new Error(`Spatial position outside invention workspace bounds: ${position.x},${position.y},${position.z}`);
  }
}

function assertFiniteRotation(rotation: SpatialVector3): void {
  assertFiniteVector(rotation, "Spatial rotation");
}

function defaultPosition(index: number): SpatialVector3 {
  const columns = 4;
  const rows = 6;
  if (index < 0 || index >= columns * rows) {
    throw new Error("Invention spatial auto-layout capacity exceeded; place the component explicitly");
  }
  const column = index % columns;
  const row = Math.floor(index / columns);
  const position = {
    x: -0.36 + column * 0.24,
    y: 0.15 - row * 0.08,
    z: 0
  };
  assertFinitePosition(position);
  return position;
}

function samePosition(left: SpatialVector3, right: SpatialVector3): boolean {
  return left.x === right.x && left.y === right.y && left.z === right.z;
}

function parseBinding(value: unknown): SpatialEntityBinding {
  if (!value || typeof value !== "object") throw new Error("Invalid invention spatial binding");
  const candidate = value as Partial<SpatialEntityBinding>;
  if (typeof candidate.entityId !== "string" || !candidate.entityId) throw new Error("Invalid invention spatial entityId");
  if (!candidate.position || !candidate.rotation || !candidate.scale) throw new Error(`Incomplete invention spatial binding: ${candidate.entityId}`);
  assertFinitePosition(candidate.position);
  assertFiniteRotation(candidate.rotation);
  assertFiniteVector(candidate.scale, "Spatial scale");
  if (typeof candidate.selectable !== "boolean") throw new Error(`Invalid invention spatial selectable flag: ${candidate.entityId}`);
  return clone(candidate as SpatialEntityBinding);
}

function relationshipPortId(relationship: EngineeringRelationship, key: "sourcePortId" | "targetPortId"): string {
  const value = relationship.metadata[key];
  if (typeof value !== "string" || !value) {
    throw new Error(`Spatial wiring requires ${key} on ${relationship.id}`);
  }
  return value;
}

export function parseInventionSpatialDocument(value: unknown): InventionSpatialDocument {
  if (!value || typeof value !== "object") throw new Error("Invalid invention spatial document");
  const candidate = value as Partial<InventionSpatialDocument>;
  if (candidate.version !== INVENTION_SPATIAL_VERSION) throw new Error(`Unsupported invention spatial version: ${String(candidate.version)}`);
  if (candidate.signature !== INVENTION_SPATIAL_SIGNATURE) throw new Error("Invalid invention spatial signature");
  if (typeof candidate.projectId !== "string" || !candidate.projectId) throw new Error("Invalid invention spatial projectId");
  if (!Array.isArray(candidate.bindings)) throw new Error("Invalid invention spatial bindings");
  const bindings = candidate.bindings.map(parseBinding);
  if (new Set(bindings.map((binding) => binding.entityId)).size !== bindings.length) {
    throw new Error("Duplicate invention spatial entity binding");
  }
  return {
    version: INVENTION_SPATIAL_VERSION,
    signature: INVENTION_SPATIAL_SIGNATURE,
    projectId: candidate.projectId,
    bindings
  };
}

export class InventionSpatialScene {
  readonly #bindings = new Map<EntityId, SpatialEntityBinding>();

  constructor(
    readonly session: EngineeringSession,
    document?: InventionSpatialDocument
  ) {
    if (session.project.projectType !== "invention" || session.project.rootEntityId !== "invention.root") {
      throw new Error("InventionSpatialScene requires an invention project");
    }
    if (!document) return;
    if (document.projectId !== session.project.projectId) throw new Error("Invention spatial document belongs to another project");
    for (const binding of document.bindings) {
      const entity = session.getEntity(binding.entityId);
      if (!isInventionComponent(entity)) throw new Error(`Spatial binding references non-invention component: ${binding.entityId}`);
      this.#bindings.set(binding.entityId, clone(binding));
    }
    const componentIds = new Set(
      session.graph.snapshot().entities.filter(isInventionComponent).map((entity) => entity.id)
    );
    if (this.#bindings.size !== componentIds.size || [...componentIds].some((id) => !this.#bindings.has(id))) {
      throw new Error("Invention spatial document does not cover the current component graph");
    }
  }

  bindings(): readonly SpatialEntityBinding[] {
    return [...this.#bindings.values()].map(clone);
  }

  document(): InventionSpatialDocument {
    return {
      version: INVENTION_SPATIAL_VERSION,
      signature: INVENTION_SPATIAL_SIGNATURE,
      projectId: this.session.project.projectId,
      bindings: this.bindings()
    };
  }

  ensureComponent(entityId: EntityId, position?: SpatialVector3): SpatialEntityBinding {
    const existing = this.#bindings.get(entityId);
    if (existing) return clone(existing);
    const entity = this.session.getEntity(entityId);
    if (!isInventionComponent(entity)) throw new Error(`${entityId} is not an invention component`);
    const nextPosition = position ?? this.#firstFreeDefaultPosition();
    assertFinitePosition(nextPosition);
    const binding = createSpatialBinding(entity, { position: nextPosition });
    this.#bindings.set(entityId, binding);
    return clone(binding);
  }

  removeComponent(entityId: EntityId): void {
    if (!this.#bindings.delete(entityId)) throw new Error(`Unknown invention spatial binding: ${entityId}`);
  }

  move(entityId: EntityId, position: SpatialVector3): SpatialEntityBinding {
    const binding = this.#bindings.get(entityId);
    if (!binding) throw new Error(`Unknown invention spatial binding: ${entityId}`);
    return this.transform(entityId, position, binding.rotation);
  }

  rotate(entityId: EntityId, rotation: SpatialVector3): SpatialEntityBinding {
    const binding = this.#bindings.get(entityId);
    if (!binding) throw new Error(`Unknown invention spatial binding: ${entityId}`);
    return this.transform(entityId, binding.position, rotation);
  }

  transform(entityId: EntityId, position: SpatialVector3, rotation: SpatialVector3): SpatialEntityBinding {
    const transformed = this.transformBatch([{ entityId, position, rotation }]);
    const next = transformed[0];
    if (!next) throw new Error(`Spatial transform did not produce a binding: ${entityId}`);
    return next;
  }

  transformBatch(mutations: readonly InventionSpatialTransformMutation[]): readonly SpatialEntityBinding[] {
    if (!Array.isArray(mutations)) throw new Error("Spatial transform batch must be an array");
    const seen = new Set<EntityId>();
    const prepared = mutations.map((mutation) => {
      if (!mutation || typeof mutation.entityId !== "string" || !mutation.entityId) throw new Error("Spatial transform requires entityId");
      if (seen.has(mutation.entityId)) throw new Error(`Duplicate spatial transform entity: ${mutation.entityId}`);
      seen.add(mutation.entityId);
      const binding = this.#bindings.get(mutation.entityId);
      if (!binding) throw new Error(`Unknown invention spatial binding: ${mutation.entityId}`);
      assertFinitePosition(mutation.position);
      assertFiniteRotation(mutation.rotation);
      return {
        ...binding,
        position: clone(mutation.position),
        rotation: clone(mutation.rotation)
      } satisfies SpatialEntityBinding;
    });

    for (const next of prepared) this.#bindings.set(next.entityId, next);
    return prepared.map(clone);
  }

  binding(entityId: EntityId): SpatialEntityBinding {
    const binding = this.#bindings.get(entityId);
    if (!binding) throw new Error(`Unknown invention spatial binding: ${entityId}`);
    return clone(binding);
  }

  select(entityId: EntityId): SpatialSelection {
    return resolveSpatialSelection(this.session.getEntity(entityId), this.binding(entityId));
  }

  connectionSegments(relationships: readonly EngineeringRelationship[]): readonly InventionSpatialConnectionSegment[] {
    return relationships
      .filter((relationship) => relationship.type === "connectedTo" && relationship.metadata.inventionRuntime === true)
      .map((relationship) => {
        const source = this.#bindings.get(relationship.source);
        const target = this.#bindings.get(relationship.target);
        if (!source || !target) throw new Error(`Spatial wiring requires bindings for ${relationship.source} and ${relationship.target}`);
        return {
          relationshipId: relationship.id,
          sourceEntityId: relationship.source,
          sourcePortId: relationshipPortId(relationship, "sourcePortId"),
          targetEntityId: relationship.target,
          targetPortId: relationshipPortId(relationship, "targetPortId"),
          source: clone(source.position),
          target: clone(target.position),
          sharedInterfaces: Array.isArray(relationship.metadata.sharedInterfaces)
            ? relationship.metadata.sharedInterfaces.map(String)
            : []
        };
      });
  }

  #firstFreeDefaultPosition(): SpatialVector3 {
    const occupied = [...this.#bindings.values()].map((binding) => binding.position);
    for (let index = 0; index < INVENTION_SPATIAL_AUTO_LAYOUT_CAPACITY; index += 1) {
      const candidate = defaultPosition(index);
      if (!occupied.some((position) => samePosition(position, candidate))) return candidate;
    }
    throw new Error("Invention spatial auto-layout capacity exceeded; place the component explicitly");
  }
}
