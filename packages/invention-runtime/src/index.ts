import {
  createEngineeringEntity,
  type EngineeringEntity,
  type EngineeringPort,
  type EntityId
} from "../../engineering-core/src/index.js";
import {
  ComponentRegistry,
  portsAreCompatible
} from "../../component-library/src/index.js";
import type { EngineeringRelationship } from "../../engineering-graph/src/index.js";
import type { EngineeringSession } from "../../engineering-session/src/index.js";
import {
  TEHKNE_STUDIO_SCHEMA_VERSION,
  type TehkneStudioProject
} from "../../project-format/src/index.js";

export const INVENTION_RUNTIME_VERSION = "1" as const;
export const INVENTION_RUNTIME_SIGNATURE = "Tehkné Solutions" as const;
export const INVENTION_ROOT_ID = "invention.root" as const;

export interface InventionPortRef {
  readonly entityId: EntityId;
  readonly portId: string;
}

export interface InventionComponentSnapshot {
  readonly entityId: EntityId;
  readonly definitionId: string;
  readonly name: string;
  readonly state: string;
}

export interface InventionConnectionSnapshot {
  readonly id: string;
  readonly from: InventionPortRef;
  readonly to: InventionPortRef;
  readonly sharedInterfaces: readonly string[];
}

export interface InventionDocument {
  readonly runtimeVersion: typeof INVENTION_RUNTIME_VERSION;
  readonly signature: typeof INVENTION_RUNTIME_SIGNATURE;
  readonly projectId: string;
  readonly rootEntityId: typeof INVENTION_ROOT_ID;
  readonly components: readonly InventionComponentSnapshot[];
  readonly connections: readonly InventionConnectionSnapshot[];
  readonly simulationStatus: "not-requested";
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function portKey(ref: InventionPortRef): string {
  return `${ref.entityId}:${ref.portId}`;
}

function numericSuffix(id: string, prefix: string): number {
  if (!id.startsWith(prefix)) return 0;
  const value = Number(id.slice(prefix.length));
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function maximumSequence(ids: readonly string[], prefix: string): number {
  return ids.reduce((maximum, id) => Math.max(maximum, numericSuffix(id, prefix)), 0);
}

function isInventionConnection(relationship: EngineeringRelationship): boolean {
  return relationship.type === "connectedTo" && relationship.metadata.inventionRuntime === true;
}

function isInventionComponent(entity: EngineeringEntity): boolean {
  return entity.parentId === INVENTION_ROOT_ID && entity.metadata.inventionComponent === true;
}

function withPortState(entity: EngineeringEntity, portId: string, state: EngineeringPort["state"]): EngineeringEntity {
  const port = entity.ports[portId];
  if (!port) throw new Error(`Unknown invention port: ${entity.id}:${portId}`);
  return {
    ...entity,
    ports: {
      ...entity.ports,
      [portId]: { ...port, state }
    }
  };
}

function inventionRoot(name: string): EngineeringEntity {
  return createEngineeringEntity({
    id: INVENTION_ROOT_ID,
    type: "InventionProject",
    name,
    state: "editing",
    properties: {
      compositionStatus: {
        id: "compositionStatus",
        value: "blank",
        source: "studio",
        confidence: 1
      }
    },
    ports: {},
    capabilities: [
      { id: "inspect", label: "Inspecionar" },
      { id: "explain", label: "Explicar" }
    ],
    metadata: {
      inventionRuntimeVersion: INVENTION_RUNTIME_VERSION,
      signature: INVENTION_RUNTIME_SIGNATURE,
      preset: false,
      provenance: "blank-invention",
      simpleExplanation: "Projeto de invenção em branco composto livremente com componentes canônicos e interfaces validadas."
    }
  });
}

export function createBlankInventionProject(
  projectId = "blank-invention-01",
  name = "Blank Invention"
): TehkneStudioProject {
  const root = inventionRoot(name);
  return {
    schemaVersion: TEHKNE_STUDIO_SCHEMA_VERSION,
    projectId,
    name,
    projectType: "invention",
    rootEntityId: INVENTION_ROOT_ID,
    entities: [root],
    relationships: [],
    metadata: {
      signature: INVENTION_RUNTIME_SIGNATURE,
      inventionRuntimeVersion: INVENTION_RUNTIME_VERSION,
      preset: false,
      provenance: "user-authored-blank-project"
    }
  };
}

export class InventionBuilder {
  #instanceSequence = 0;
  #connectionSequence = 0;

  constructor(
    readonly session: EngineeringSession,
    readonly registry: ComponentRegistry
  ) {
    if (session.project.projectType !== "invention") {
      throw new Error(`InventionBuilder requires projectType invention, got ${session.project.projectType}`);
    }
    const root = session.graph.getEntity(session.project.rootEntityId);
    if (root.id !== INVENTION_ROOT_ID || root.type !== "InventionProject") {
      throw new Error(`InventionBuilder requires root ${INVENTION_ROOT_ID}`);
    }
    const snapshot = session.graph.snapshot();
    this.#instanceSequence = maximumSequence(
      snapshot.entities.filter(isInventionComponent).map((entity) => entity.id),
      "invention.component."
    );
    this.#connectionSequence = maximumSequence(
      snapshot.relationships.filter(isInventionConnection).map((relationship) => relationship.id),
      "invention-connection-"
    );
  }

  components(): readonly EngineeringEntity[] {
    return this.session.graph.snapshot().entities.filter(isInventionComponent);
  }

  connections(): readonly EngineeringRelationship[] {
    return this.session.graph.snapshot().relationships.filter(isInventionConnection);
  }

  document(): InventionDocument {
    return {
      runtimeVersion: INVENTION_RUNTIME_VERSION,
      signature: INVENTION_RUNTIME_SIGNATURE,
      projectId: this.session.project.projectId,
      rootEntityId: INVENTION_ROOT_ID,
      components: this.components().map((entity) => ({
        entityId: entity.id,
        definitionId: String(entity.metadata.componentDefinitionId ?? ""),
        name: entity.name,
        state: entity.state
      })),
      connections: this.connections().map((relationship) => ({
        id: relationship.id,
        from: {
          entityId: relationship.source,
          portId: String(relationship.metadata.sourcePortId)
        },
        to: {
          entityId: relationship.target,
          portId: String(relationship.metadata.targetPortId)
        },
        sharedInterfaces: Array.isArray(relationship.metadata.sharedInterfaces)
          ? relationship.metadata.sharedInterfaces.map(String)
          : []
      })),
      simulationStatus: "not-requested"
    };
  }

  addComponent(definitionId: string, name?: string): EngineeringEntity {
    const definition = this.registry.get(definitionId);
    let sequence = ++this.#instanceSequence;
    let instanceId = `invention.component.${sequence}`;
    const ids = new Set(this.session.graph.snapshot().entities.map((entity) => entity.id));
    while (ids.has(instanceId)) {
      sequence = ++this.#instanceSequence;
      instanceId = `invention.component.${sequence}`;
    }

    const entity = this.registry.instantiate(definitionId, instanceId, {
      parentId: INVENTION_ROOT_ID,
      ...(name?.trim() ? { name: name.trim() } : {}),
      metadata: {
        inventionComponent: true,
        inventionRuntimeVersion: INVENTION_RUNTIME_VERSION,
        signature: INVENTION_RUNTIME_SIGNATURE
      }
    });
    this.session.graph.addEntity(entity);
    this.session.graph.connect({
      id: `invention-contains-${sequence}`,
      source: INVENTION_ROOT_ID,
      target: entity.id,
      type: "contains",
      metadata: {
        definitionId: definition.definitionId,
        role: "invention-component",
        signature: INVENTION_RUNTIME_SIGNATURE
      }
    });
    this.#updateRootStatus();
    return clone(this.session.getEntity(entity.id));
  }

  removeComponent(entityId: EntityId): void {
    const entity = this.session.getEntity(entityId);
    if (!isInventionComponent(entity)) throw new Error(`${entityId} is not an invention component`);
    const active = this.connections().filter((relationship) => relationship.source === entityId || relationship.target === entityId);
    if (active.length > 0) {
      throw new Error(`Disconnect ${active.length} invention connection(s) before removing ${entityId}`);
    }
    this.session.graph.removeEntity(entityId);
    this.#updateRootStatus();
  }

  availablePorts(entityId: EntityId): readonly EngineeringPort[] {
    const entity = this.session.getEntity(entityId);
    if (!isInventionComponent(entity)) throw new Error(`${entityId} is not an invention component`);
    return Object.values(entity.ports).filter((port) => port.state === "available").map(clone);
  }

  compatibleTargets(from: InventionPortRef): readonly InventionPortRef[] {
    const source = this.#resolvePort(from);
    return this.components().flatMap((entity) => entity.id === from.entityId
      ? []
      : Object.values(entity.ports)
          .filter((port) => port.state === "available" && portsAreCompatible(source.port, port))
          .map((port) => ({ entityId: entity.id, portId: port.id }))
    );
  }

  connect(from: InventionPortRef, to: InventionPortRef): InventionConnectionSnapshot {
    if (from.entityId === to.entityId) throw new Error("Invention connection cannot connect a component to itself");
    const source = this.#resolvePort(from);
    const target = this.#resolvePort(to);
    if (source.port.state !== "available") throw new Error(`Invention port already occupied: ${portKey(from)}`);
    if (target.port.state !== "available") throw new Error(`Invention port already occupied: ${portKey(to)}`);
    if (!portsAreCompatible(source.port, target.port)) {
      throw new Error(`Incompatible invention ports: ${portKey(from)} → ${portKey(to)}`);
    }

    const sharedInterfaces = source.port.compatibility.filter((token) => target.port.compatibility.includes(token));
    const id = `invention-connection-${++this.#connectionSequence}`;
    this.session.graph.connect({
      id,
      source: from.entityId,
      target: to.entityId,
      type: "connectedTo",
      metadata: {
        inventionRuntime: true,
        sourcePortId: from.portId,
        targetPortId: to.portId,
        sharedInterfaces,
        validatedBy: "component-library",
        signature: INVENTION_RUNTIME_SIGNATURE
      }
    });
    this.session.graph.replaceEntity(withPortState(source.entity, from.portId, "connected"));
    this.session.graph.replaceEntity(withPortState(target.entity, to.portId, "connected"));
    this.#updateRootStatus();
    return { id, from: clone(from), to: clone(to), sharedInterfaces };
  }

  disconnect(connectionId: string): void {
    const connection = this.connections().find((relationship) => relationship.id === connectionId);
    if (!connection) throw new Error(`Unknown invention connection: ${connectionId}`);
    const sourcePortId = String(connection.metadata.sourcePortId);
    const targetPortId = String(connection.metadata.targetPortId);
    this.session.graph.disconnect(connectionId);
    const source = this.session.getEntity(connection.source);
    const target = this.session.getEntity(connection.target);
    this.session.graph.replaceEntity(withPortState(source, sourcePortId, "available"));
    this.session.graph.replaceEntity(withPortState(target, targetPortId, "available"));
    this.#updateRootStatus();
  }

  #resolvePort(ref: InventionPortRef): { entity: EngineeringEntity; port: EngineeringPort } {
    const entity = this.session.getEntity(ref.entityId);
    if (!isInventionComponent(entity)) throw new Error(`${ref.entityId} is not an invention component`);
    const port = entity.ports[ref.portId];
    if (!port) throw new Error(`Unknown invention port: ${portKey(ref)}`);
    if (port.state === "disabled") throw new Error(`Disabled invention port: ${portKey(ref)}`);
    return { entity, port };
  }

  #updateRootStatus(): void {
    const root = this.session.getEntity(INVENTION_ROOT_ID);
    const components = this.components().length;
    const connections = this.connections().length;
    const compositionStatus = components === 0 ? "blank" : connections === 0 ? "components-added" : "composed";
    const property = root.properties.compositionStatus;
    if (!property) throw new Error("Invention root missing compositionStatus");
    this.session.graph.replaceEntity({
      ...root,
      state: components === 0 ? "editing" : "composing",
      properties: {
        ...root.properties,
        compositionStatus: { ...property, value: compositionStatus }
      }
    });
  }
}
