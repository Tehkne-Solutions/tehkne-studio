import { setEngineeringProperty, type EngineeringEntity, type EngineeringPropertyValue } from "../../engineering-core/src/index.js";
import type { ProductMaterializationResult } from "./index.js";

export interface ProductSlotTuning {
  readonly slotId: string;
  readonly propertyValues: Readonly<Record<string, EngineeringPropertyValue>>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function applyProductSlotTuning(
  materialized: ProductMaterializationResult,
  tuning: readonly ProductSlotTuning[]
): ProductMaterializationResult {
  const byId = new Map(materialized.project.entities.map((entity) => [entity.id, clone(entity)]));
  const seen = new Set<string>();

  for (const entry of tuning) {
    if (!entry.slotId.trim()) throw new Error("Product tuning slotId is required");
    if (seen.has(entry.slotId)) throw new Error(`Product tuning repeats slot: ${entry.slotId}`);
    seen.add(entry.slotId);
    const entityId = materialized.slotEntities[entry.slotId];
    if (!entityId) throw new Error(`Product tuning targets unknown slot: ${entry.slotId}`);
    let entity = byId.get(entityId);
    if (!entity) throw new Error(`Product tuning entity is missing: ${entityId}`);
    for (const [propertyId, value] of Object.entries(entry.propertyValues)) {
      if (!entity.properties[propertyId]) throw new Error(`Product tuning targets unknown property: ${entry.slotId}.${propertyId}`);
      entity = setEngineeringProperty(entity, propertyId, value);
    }
    byId.set(entityId, entity);
  }

  return {
    ...materialized,
    project: {
      ...materialized.project,
      entities: materialized.project.entities.map((entity) => byId.get(entity.id) as EngineeringEntity)
    }
  };
}
