import type {
  EngineeringEntity,
  EngineeringPropertyValue,
  EntityId,
  PropertySource
} from "../../engineering-core/src/index.js";
import { hasCapability } from "../../engineering-core/src/index.js";
import { EngineeringGraph } from "../../engineering-graph/src/index.js";
import type { TehkneStudioProject } from "../../project-format/src/index.js";
import { CommandBus, type StudioCommand } from "../../command-bus/src/index.js";
import { InMemoryEventSink, type StudioDomainEvent } from "../../observability/src/index.js";
import {
  runFunctionalBoot,
  type BootDependencyInput,
  type BootRunResult
} from "../../simulation-runtime/src/index.js";

export type SupportedCapability =
  | "inspect"
  | "explain"
  | "open"
  | "explode"
  | "remove"
  | "insert"
  | "powerOn"
  | "why";

export interface InspectionProperty {
  readonly id: string;
  readonly value: string | number | boolean | null;
  readonly unit?: string;
  readonly source: PropertySource;
  readonly confidence?: number;
}

export interface CausalTraceStep {
  readonly entityId: EntityId;
  readonly label: string;
  readonly detail: string;
}

export interface CapabilityExecutionResult {
  readonly entity: EngineeringEntity;
  readonly capabilityId: string;
  readonly changed: boolean;
  readonly message: string;
  readonly inspection?: readonly InspectionProperty[];
  readonly explanation?: string;
  readonly affectedEntityIds?: readonly EntityId[];
  readonly bootRun?: BootRunResult;
  readonly causalTrace?: readonly CausalTraceStep[];
  readonly focusEntityId?: EntityId;
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
  "remove",
  "insert",
  "powerOn",
  "why"
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

function withProperty(
  entity: EngineeringEntity,
  propertyId: string,
  value: EngineeringPropertyValue
): EngineeringEntity {
  const property = entity.properties[propertyId];
  if (!property) throw new Error(`${entity.id} missing required property ${propertyId}`);
  return {
    ...entity,
    properties: {
      ...entity.properties,
      [propertyId]: { ...property, value }
    }
  };
}

function withProperties(
  entity: EngineeringEntity,
  values: Readonly<Record<string, EngineeringPropertyValue>>
): EngineeringEntity {
  return Object.entries(values).reduce(
    (current, [propertyId, value]) => withProperty(current, propertyId, value),
    entity
  );
}

function entityAvailable(entity: EngineeringEntity): boolean {
  if (["removed", "disconnected", "fault"].includes(entity.state)) return false;
  if (entity.properties.connected?.value === false) return false;
  return true;
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

  #bootProcessFor(root: EngineeringEntity): EngineeringEntity {
    const boot = this.graph
      .getDependencies(root.id, "contains")
      .find((candidate) => candidate.type === "BootProcess");
    if (!boot) throw new Error(`${root.id} has no BootProcess`);
    return boot;
  }

  #bootDependencies(boot: EngineeringEntity): BootDependencyInput[] {
    const relationships = this.graph
      .snapshot()
      .relationships.filter(
        (relationship) => relationship.source === boot.id && relationship.type === "dependsOn"
      );

    return relationships.map((relationship) => {
      const dependency = this.graph.getEntity(relationship.target);
      const authoredReason = relationship.metadata.reason;
      return {
        id: dependency.id,
        type: dependency.type,
        name: dependency.name,
        available: entityAvailable(dependency),
        reason: typeof authoredReason === "string" ? authoredReason : "required boot dependency"
      };
    });
  }

  #powerOn(command: StudioCommand<CapabilityPayload>, root: EngineeringEntity): CapabilityExecutionResult {
    const boot = this.#bootProcessFor(root);
    const run = runFunctionalBoot(this.#bootDependencies(boot));
    const beforePower = String(root.properties.powerState?.value ?? "unknown");
    const afterPower = run.status === "success" ? "on" : "fault";
    const updatedRoot = withProperty(root, "powerState", afterPower);
    const fault = run.fault;
    const updatedBoot = {
      ...withProperties(boot, {
        status: run.status,
        stage: fault?.stage ?? run.finalStage,
        faultCode: fault?.code ?? null,
        faultEntityId: fault?.entityId ?? null,
        faultReason: fault?.reason ?? null
      }),
      state: run.status === "success" ? "running" : "fault"
    };

    this.graph.replaceEntity(updatedRoot);
    this.graph.replaceEntity(updatedBoot);
    this.#recordEvent({
      id: `event-${this.events.list().length + 1}`,
      type: run.status === "success" ? "BootSucceeded" : "BootFailed",
      occurredAt: command.issuedAt,
      source: command.source,
      payload: {
        commandId: command.id,
        entityId: root.id,
        bootEntityId: boot.id,
        status: run.status,
        finalStage: run.finalStage,
        timeline: run.timeline,
        fault: run.fault
      }
    });

    const label = run.status === "success"
      ? "Power On: POST concluído e sistema em RUNNING"
      : `Power On: falha em ${fault?.stage ?? "FAULT"} · ${fault?.entityName ?? "dependência"}`;
    this.#recordHistory(
      command,
      updatedRoot,
      `${root.state}/${beforePower}`,
      `${updatedRoot.state}/${afterPower}`,
      label
    );

    return {
      entity: updatedRoot,
      capabilityId: "powerOn",
      changed: true,
      message: run.status === "success"
        ? "POST concluído. CPU, memória, armazenamento e plataforma estão disponíveis; o sistema chegou a RUNNING."
        : `POST interrompido em ${fault?.stage ?? "FAULT"}: ${fault?.entityName ?? "uma dependência"} está indisponível.`,
      bootRun: run,
      focusEntityId: boot.id
    };
  }

  #why(command: StudioCommand<CapabilityPayload>, boot: EngineeringEntity): CapabilityExecutionResult {
    const faultEntityId = boot.properties.faultEntityId?.value;
    const stage = String(boot.properties.stage?.value ?? "UNKNOWN");

    if (boot.state !== "fault" || typeof faultEntityId !== "string") {
      const message = "Não existe uma falha de boot ativa para explicar.";
      return { entity: boot, capabilityId: "why", changed: false, message, explanation: message };
    }

    const dependency = this.graph.getEntity(faultEntityId);
    const relationship = this.graph
      .snapshot()
      .relationships.find(
        (candidate) =>
          candidate.source === boot.id &&
          candidate.target === dependency.id &&
          candidate.type === "dependsOn"
      );
    const reason = typeof relationship?.metadata.reason === "string"
      ? relationship.metadata.reason
      : "dependência necessária ao boot";
    const connected = dependency.properties.connected?.value;
    const availabilityDetail = connected === false
      ? `${dependency.name} está ${dependency.state} e connected=false.`
      : `${dependency.name} está no estado ${dependency.state}.`;
    const causalTrace: CausalTraceStep[] = [
      {
        entityId: boot.id,
        label: `${boot.name} · ${stage}`,
        detail: `O processo parou na etapa ${stage}.`
      },
      {
        entityId: dependency.id,
        label: `dependsOn → ${dependency.name}`,
        detail: `Esta dependência existe por: ${reason}.`
      },
      {
        entityId: dependency.id,
        label: `${dependency.name} indisponível`,
        detail: availabilityDetail
      }
    ];
    const explanation = `${boot.name} falhou em ${stage} porque depende de ${dependency.name} para ${reason}, mas essa entidade está indisponível.`;

    this.#recordEvent({
      id: `event-${this.events.list().length + 1}`,
      type: "CausalityExplained",
      occurredAt: command.issuedAt,
      source: command.source,
      payload: {
        commandId: command.id,
        entityId: boot.id,
        faultEntityId: dependency.id,
        stage,
        relationshipId: relationship?.id ?? null,
        reason
      }
    });
    this.#recordHistory(command, boot, boot.state, boot.state, `Causa explicada: ${dependency.name}`);

    return {
      entity: boot,
      capabilityId: "why",
      changed: false,
      message: explanation,
      explanation,
      causalTrace
    };
  }

  #insert(command: StudioCommand<CapabilityPayload>, entity: EngineeringEntity): CapabilityExecutionResult {
    if (entity.state !== "removed" && entity.properties.connected?.value !== false) {
      return { entity, capabilityId: "insert", changed: false, message: `${entity.name} já está instalado.` };
    }

    const connectedProperty = entity.properties.connected;
    const nextProperties = connectedProperty
      ? {
          ...entity.properties,
          connected: { ...connectedProperty, value: true }
        }
      : entity.properties;
    const nextPorts = Object.fromEntries(
      Object.entries(entity.ports).map(([id, port]) => [
        id,
        port.state === "available" ? { ...port, state: "connected" as const } : port
      ])
    );
    const inserted: EngineeringEntity = {
      ...entity,
      state: "connected",
      properties: nextProperties,
      ports: nextPorts
    };
    return this.#replaceAndRecord(command, entity, inserted, "EntityInserted", `Reinstalado: ${entity.name}`);
  }

  #remove(command: StudioCommand<CapabilityPayload>, entity: EngineeringEntity): CapabilityExecutionResult {
    if (entity.state === "removed") {
      return { entity, capabilityId: "remove", changed: false, message: `${entity.name} já está removido.` };
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

  #executeCapability(command: StudioCommand<CapabilityPayload>): CapabilityExecutionResult {
    if (!command.targetId) throw new Error("Capability command requires targetId");
    const entity = this.graph.getEntity(command.targetId);
    const capabilityId = command.payload.capabilityId;

    if (!hasCapability(entity, capabilityId)) {
      throw new Error(`${entity.id} does not expose capability ${capabilityId}`);
    }
    if (!this.canExecuteCapability(capabilityId)) {
      throw new Error(`Capability ${capabilityId} is not executable in S1.5`);
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

    if (capabilityId === "explode") return this.#explode(command, entity);
    if (capabilityId === "powerOn") return this.#powerOn(command, entity);
    if (capabilityId === "why") return this.#why(command, entity);
    if (capabilityId === "insert") return this.#insert(command, entity);
    return this.#remove(command, entity);
  }
}
