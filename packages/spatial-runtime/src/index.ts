import type { EngineeringEntity, EntityId } from "../../engineering-core/src/index.js";

export interface SpatialVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SpatialEntityBinding {
  readonly entityId: EntityId;
  readonly position: SpatialVector3;
  readonly rotation: SpatialVector3;
  readonly scale: SpatialVector3;
  readonly selectable: boolean;
}

export interface SpatialSelection {
  readonly entity: EngineeringEntity;
  readonly binding: SpatialEntityBinding;
}

export function createSpatialBinding(
  entity: EngineeringEntity,
  input: Partial<Omit<SpatialEntityBinding, "entityId">> = {}
): SpatialEntityBinding {
  return {
    entityId: entity.id,
    position: input.position ?? { x: 0, y: 0, z: 0 },
    rotation: input.rotation ?? { x: 0, y: 0, z: 0 },
    scale: input.scale ?? { x: 1, y: 1, z: 1 },
    selectable: input.selectable ?? true
  };
}

export function resolveSpatialSelection(
  entity: EngineeringEntity,
  binding: SpatialEntityBinding
): SpatialSelection {
  if (binding.entityId !== entity.id) {
    throw new Error(`Spatial binding ${binding.entityId} does not match entity ${entity.id}`);
  }
  if (!binding.selectable) {
    throw new Error(`Entity ${entity.id} is not selectable in the current spatial context`);
  }
  return { entity, binding };
}
