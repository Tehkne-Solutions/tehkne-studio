import type { EngineeringEntity, EntityId, PropertySource } from "../../engineering-core/src/index.js";
import { hasCapability } from "../../engineering-core/src/index.js";
import { EngineeringGraph } from "../../engineering-graph/src/index.js";
import type { TehkneStudioProject } from "../../project-format/src/index.js";
import { CommandBus, type StudioCommand } from "../../command-bus/src/index.js";
import { InMemoryEventSink, type StudioDomainEvent } from "../../observability/src/index.js";

export type SupportedCapability = "inspect" | "explain" | "open" | "explode" | "remove";

export interface InspectionProperty {
  readonly id: string;
  readonly value: string | number | boolean | null;
  readonly unit?: string;
  readonly source: PropertySource;
  readonly confidence?: number;
}

export interface CapabilityExecutionResult {
  readonly entity: EngineeringEntity;
  readonly capabilityId: string;
  readonly changed: boolean;
  readonly message: string;
  readonly inspection?: readonly InspectionProperty[];
  readonly explanation?: string;
  readonly affectedEntityIds?: readonly EntityId[];
}

export interface SemanticHistoryEntry {
  readonly id: string;
  readonly commandId: string;
  readonly action: string;
  readonly targetId: EntityId;
  readonly label: string;
  readonly occurredAt: string;
  readonly beforeState: string;
  readonly afterState: string;
}

interface CapabilityPayload {
  readonly capabilityId: string;
}

const SUPPORTED_CAPABILITIES = new Set<SupportedCapability>([
  "inspect",
  "explain",
  "open",
  "explode",
  "remove"
]);

function cloneEntity(entity: EngineeringEntity): EngineeringEntity {
  return {
    ...entity,
    properties: Object.fromEntries(
      Object.entries(entity.properties).map(([id, property]) => [id, { ...property }])
    ),
    ports: Object.fromEntries(Object.entries(entity.ports).map(([id, port]) => [id, { ...port }])),
    capabilities: entity.capabilities.map((capability) => ({ ...capability })),
    metadata: { ...entity.metadata }
  };
}

function propertySnapshot(entity: EngineeringEntity): InspectionProperty[] {
  return Object.values(entity.properties).map((property) => ({
    id: property.id,
    value: property.value,
    source: property.source,
    ...(property.unit !== undefined ? { unit: property.unit } : {}),
    ...(property.confidence !== undefined ? { confidence: property.confidence } : {})
  }));
}

export class EngineeringSession {
  readonly graph = new EngineeringGraph();
  readonly commands = new CommandBus();
  readonly events = new InMemoryEventSink();
  readonly #history: SemanticHistoryEntry[] = [];
  #sequence = 0;

  constructor(readonly project: TehkneStudioProject) {
    for (const entity of project.entities) this.graph.addEntity(cloneEntity(entity));
    for (const relationship of project.relationships) this.graph.connect(relationship);
    this.graph.assertIntegrity();

    this.commands.register("capability.execute", (command) =>
      this.#executeCapability(command as StudioCommand<CapabilityPayload>)
    );
  }

  getEntity(id: EntityId): EngineeringEntity {
    return this.graph.getEntity(id);
  }

  history(): readonly SemanticHistoryEntry[] {
    return [...this.#history];
  }

  canExecuteCapability(capabilityId: string): capabilityId is SupportedCapability {
    return SUPPORTED_CAPABILITIES.has(capabilityId as SupportedCapability);
  }

  async executeCapability(
    targetId: EntityId,
    capabilityId: string,
    source: StudioCommand["source"] = "ui"
  ) {
    const issuedAt = new Date().toISOString();
    const command: StudioCommand<CapabilityPayload> = {
      id: `cmd-${++this.#sequence}`,
      type: "capability.execute",
      targetId,
      payload: { capabilityId },
      source,
      issuedAt
    };
    return this.commands.dispatch<CapabilityExecutionResult>(command);
  }

  #recordEvent(event: StudioDomainEvent): void {
    this.events.record(event);
  }

  #recordHistory(
    command: StudioCommand<CapabilityPayload>,
    entity: EngineeringEntity,
    beforeState: string,
    afterState: string,
    label: string
  ): void {
    this.#history.push({
      id: `history-${this.#history.length + 1}`,
      commandId: command.id,
      action: command.payload.capabilityId,
      targetId: entity.id,
      label,
      occurredAt: command.issuedAt,
      beforeState,
      afterState
    });
  }

  #replaceAndRecord(
    command: StudioCommand<CapabilityPayload>,
    before: EngineeringEntity,
    after: EngineeringEntity,
    eventType: string,
    label: string
  ): CapabilityExecutionResult {
    this.graph.replaceEntity(after);
    this.#recordEvent({
      id: `event-${this.events.list().length + 1}`,
      type: eventType,
      occurredAt: command.issuedAt,
      source: command.source,
      payload: {
        commandId: command.id,
        entityId: after.id,
        beforeState: before.state,
        afterState: after.state
      }
    });
    this.#recordHistory(command, after, before.state, after.state, label);
    return {
      entity: after,
      capabilityId: command.payload.capabilityId,
      changed: true,
      message: label
    };
  }

  #explode(command: StudioCommand<CapabilityPayload>, entity: EngineeringEntity): CapabilityExecutionResult {
    if (entity.state === "closed") {
      throw new Error(`${entity.name} must be open before explode`);
    }
    if (entity.state === "exploded") {
      const affectedEntityIds = this.graph.getDependencies(entity.id, "contains").map((child) => child.id);
      return {
        entity,
        capabilityId: "explode",
        changed: false,
        message: `${entity.name} já está explodido.`,
        affectedEntityIds
      };
    }

    const affectedEntityIds = this.graph.getDependencies(entity.id, "contains").map((child) => child.id);
    if (affectedEntityIds.length === 0) {
      throw new Error(`${entity.name} has no contained entities to explode`);
    }

    const exploded: EngineeringEntity = { ...entity, state: "exploded" };
    this.graph.replaceEntity(exploded);
    this.#recordEvent({
      id: `event-${this.events.list().length + 1}`,
      type: "EntityExploded",
      occurredAt: command.issuedAt,
      source: command.source,
      payload: {
        commandId: command.id,
        entityId: exploded.id,
        beforeState: entity.state,
        afterState: exploded.state,
        affectedEntityIds
      }
    });
    this.#recordHistory(command, exploded, entity.state, exploded.state, `Explodido: ${entity.name}`);

    return {
      entity: exploded,
      capabilityId: "explode",
      changed: true,
      message: `Explodido: ${entity.name} · ${affectedEntityIds.length} entidades do Engineering Graph separadas.`,
      affectedEntityIds
    };
  }

  #executeCapability(command: StudioCommand<CapabilityPayload>): CapabilityExecutionResult {
    if (!command.targetId) throw new Error("Capability command requires targetId");
    const entity = this.graph.getEntity(command.targetId);
    const capabilityId = command.payload.capabilityId;

    if (!hasCapability(entity, capabilityId)) {
      throw new Error(`${entity.id} does not expose capability ${capabilityId}`);
    }
    if (!this.canExecuteCapability(capabilityId)) {
      throw new Error(`Capability ${capabilityId} is not executable in S1.4`);
    }

    if (capabilityId === "inspect") {
      const properties = propertySnapshot(entity);
      const message = properties.length
        ? `${entity.name}: ${properties.length} propriedade(s) técnica(s) disponível(is).`
        : `${entity.name}: nenhuma propriedade técnica publicada nesta etapa.`;
      this.#recordEvent({
        id: `event-${this.events.list().length + 1}`,
        type: "EntityInspected",
        occurredAt: command.issuedAt,
        source: command.source,
        payload: { commandId: command.id, entityId: entity.id }
      });
      this.#recordHistory(command, entity, entity.state, entity.state, `Inspecionado: ${entity.name}`);
      return {
        entity,
        capabilityId,
        changed: false,
        message,
        inspection: properties
      };
    }

    if (capabilityId === "explain") {
      const authored = entity.metadata.simpleExplanation;
      const explanation =
        typeof authored === "string"
          ? authored
          : `${entity.name} é uma entidade ${entity.type} do Engineering Graph.`;
      this.#recordEvent({
        id: `event-${this.events.list().length + 1}`,
        type: "EntityExplained",
        occurredAt: command.issuedAt,
        source: command.source,
        payload: { commandId: command.id, entityId: entity.id }
      });
      this.#recordHistory(command, entity, entity.state, entity.state, `Explicado: ${entity.name}`);
      return {
        entity,
        capabilityId,
        changed: false,
        message: explanation,
        explanation
      };
    }

    if (capabilityId === "open") {
      if (entity.state === "open" || entity.state === "exploded") {
        return { entity, capabilityId, changed: false, message: `${entity.name} já está aberto.` };
      }
      return this.#replaceAndRecord(
        command,
        entity,
        { ...entity, state: "open" },
        "EntityOpened",
        `Aberto: ${entity.name}`
      );
    }

    if (capabilityId === "explode") {
      return this.#explode(command, entity);
    }

    if (entity.state === "removed") {
      return { entity, capabilityId, changed: false, message: `${entity.name} já está removido.` };
    }

    const connectedProperty = entity.properties.connected;
    const nextProperties = connectedProperty
      ? {
          ...entity.properties,
          connected: { ...connectedProperty, value: false }
        }
      : entity.properties;
    const nextPorts = Object.fromEntries(
      Object.entries(entity.ports).map(([id, port]) => [
        id,
        port.state === "connected" ? { ...port, state: "available" as const } : port
      ])
    );
    const removed: EngineeringEntity = {
      ...entity,
      state: "removed",
      properties: nextProperties,
      ports: nextPorts
    };
    return this.#replaceAndRecord(command, entity, removed, "EntityRemoved", `Removido: ${entity.name}`);
  }
}
