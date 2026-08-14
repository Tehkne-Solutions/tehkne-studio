import type { EngineeringEntity } from "../../engineering-core/src/index.js";
import type { EngineeringRelationship } from "../../engineering-graph/src/index.js";
import type { BehaviorDefinition } from "../../behavior-runtime/src/index.js";

export const TEHKNE_STUDIO_SCHEMA_VERSION = "0.1" as const;

export interface TehkneStudioProject {
  readonly schemaVersion: typeof TEHKNE_STUDIO_SCHEMA_VERSION;
  readonly projectId: string;
  readonly name: string;
  readonly projectType: "teardown" | "invention" | "experiment";
  readonly rootEntityId: string;
  readonly entities: readonly EngineeringEntity[];
  readonly relationships: readonly EngineeringRelationship[];
  readonly behaviors?: readonly BehaviorDefinition[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export function validateProject(project: TehkneStudioProject): string[] {
  const errors: string[] = [];
  if (project.schemaVersion !== TEHKNE_STUDIO_SCHEMA_VERSION) {
    errors.push(`Unsupported schemaVersion: ${project.schemaVersion}`);
  }
  if (!project.projectId.trim()) errors.push("projectId is required");
  if (!project.name.trim()) errors.push("name is required");

  const ids = new Set(project.entities.map((entity) => entity.id));
  if (!ids.has(project.rootEntityId)) errors.push("rootEntityId must reference an entity");
  if (ids.size !== project.entities.length) errors.push("entity ids must be unique");

  for (const relationship of project.relationships) {
    if (!ids.has(relationship.source)) errors.push(`Missing relationship source: ${relationship.source}`);
    if (!ids.has(relationship.target)) errors.push(`Missing relationship target: ${relationship.target}`);
  }

  for (const behavior of project.behaviors ?? []) {
    if (!ids.has(behavior.trigger.signal.entityId)) errors.push(`Missing behavior signal entity: ${behavior.trigger.signal.entityId}`);
    if (!ids.has(behavior.action.targetEntityId)) errors.push(`Missing behavior action entity: ${behavior.action.targetEntityId}`);
  }
  return errors;
}
