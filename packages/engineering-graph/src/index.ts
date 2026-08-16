import type { EngineeringEntity, EntityId } from "../../engineering-core/src/index.js";

export type RelationshipType =
  | "contains"
  | "mountedTo"
  | "connectedTo"
  | "poweredBy"
  | "controlledBy"
  | "dependsOn"
  | "moves"
  | "reads"
  | "attachedTo";

export interface EngineeringRelationship {
  readonly id: string;
  readonly source: EntityId;
  readonly target: EntityId;
  readonly type: RelationshipType;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export class EngineeringGraph {
  readonly #entities = new Map<EntityId, EngineeringEntity>();
  readonly #relationships = new Map<string, EngineeringRelationship>();

  addEntity(entity: EngineeringEntity): void {
    if (this.#entities.has(entity.id)) throw new Error(`Duplicate entity: ${entity.id}`);
    this.#entities.set(entity.id, entity);
  }

  getEntity(id: EntityId): EngineeringEntity {
    const entity = this.#entities.get(id);
    if (!entity) throw new Error(`Unknown entity: ${id}`);
    return entity;
  }

  replaceEntity(entity: EngineeringEntity): void {
    if (!this.#entities.has(entity.id)) throw new Error(`Unknown entity: ${entity.id}`);
    this.#entities.set(entity.id, entity);
  }

  removeEntity(id: EntityId): void {
    if (!this.#entities.delete(id)) throw new Error(`Unknown entity: ${id}`);
    for (const [relationshipId, relationship] of this.#relationships) {
      if (relationship.source === id || relationship.target === id) {
        this.#relationships.delete(relationshipId);
      }
    }
  }

  connect(relationship: EngineeringRelationship): void {
    if (this.#relationships.has(relationship.id)) {
      throw new Error(`Duplicate relationship: ${relationship.id}`);
    }
    this.getEntity(relationship.source);
    this.getEntity(relationship.target);
    this.#relationships.set(relationship.id, relationship);
  }

  replaceRelationship(relationship: EngineeringRelationship): void {
    if (!this.#relationships.has(relationship.id)) {
      throw new Error(`Unknown relationship: ${relationship.id}`);
    }
    this.getEntity(relationship.source);
    this.getEntity(relationship.target);
    this.#relationships.set(relationship.id, relationship);
  }

  disconnect(relationshipId: string): void {
    if (!this.#relationships.delete(relationshipId)) {
      throw new Error(`Unknown relationship: ${relationshipId}`);
    }
  }

  getDependencies(id: EntityId, type?: RelationshipType): EngineeringEntity[] {
    this.getEntity(id);
    const targetIds = [...this.#relationships.values()]
      .filter((relationship) => relationship.source === id && (!type || relationship.type === type))
      .map((relationship) => relationship.target);
    return targetIds.map((targetId) => this.getEntity(targetId));
  }

  getDependents(id: EntityId, type?: RelationshipType): EngineeringEntity[] {
    this.getEntity(id);
    const sourceIds = [...this.#relationships.values()]
      .filter((relationship) => relationship.target === id && (!type || relationship.type === type))
      .map((relationship) => relationship.source);
    return sourceIds.map((sourceId) => this.getEntity(sourceId));
  }

  trace(startId: EntityId, relationshipType?: RelationshipType): EntityId[] {
    this.getEntity(startId);
    const visited = new Set<EntityId>();
    const queue: EntityId[] = [startId];
    const order: EntityId[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      order.push(current);
      for (const entity of this.getDependencies(current, relationshipType)) {
        if (!visited.has(entity.id)) queue.push(entity.id);
      }
    }

    return order;
  }

  assertIntegrity(): void {
    for (const relationship of this.#relationships.values()) {
      this.getEntity(relationship.source);
      this.getEntity(relationship.target);
    }
  }

  snapshot(): { entities: EngineeringEntity[]; relationships: EngineeringRelationship[] } {
    return {
      entities: [...this.#entities.values()],
      relationships: [...this.#relationships.values()]
    };
  }
}
