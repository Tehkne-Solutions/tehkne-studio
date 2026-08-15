import {
  createEngineeringEntity,
  type EngineeringEntity,
  type EngineeringPort,
  type EngineeringPropertyValue,
  type EntityId
} from "../../engineering-core/src/index.js";
import type { EngineeringRelationship } from "../../engineering-graph/src/index.js";
import type { EngineeringSession } from "../../engineering-session/src/index.js";

export const CIRCUIT_RUNTIME_VERSION = "1" as const;
export const CIRCUIT_RUNTIME_SIGNATURE = "Tehkné Solutions" as const;
export const CIRCUIT_ROOT_ID = "circuit.root" as const;

export type CircuitComponentKind = "dc-source" | "switch" | "resistor" | "led";
export type CircuitSimulationStatus = "incomplete" | "unsupported" | "open" | "pass" | "warning" | "fault";

export interface CircuitTerminalRef {
  readonly entityId: EntityId;
  readonly portId: string;
}

export interface CircuitComponentSnapshot {
  readonly entityId: EntityId;
  readonly kind: CircuitComponentKind;
  readonly name: string;
  readonly state: string;
}

export interface CircuitWireSnapshot {
  readonly id: string;
  readonly from: CircuitTerminalRef;
  readonly to: CircuitTerminalRef;
}

export interface CircuitDocument {
  readonly circuitVersion: typeof CIRCUIT_RUNTIME_VERSION;
  readonly signature: typeof CIRCUIT_RUNTIME_SIGNATURE;
  readonly rootEntityId: typeof CIRCUIT_ROOT_ID;
  readonly components: readonly CircuitComponentSnapshot[];
  readonly wires: readonly CircuitWireSnapshot[];
}

export interface CircuitResistorResult {
  readonly entityId: EntityId;
  readonly resistanceOhm: number;
  readonly voltageDropV: number;
  readonly powerW: number;
  readonly powerRatingW: number;
}

export interface CircuitSimulationResult {
  readonly id: string;
  readonly occurredAt: string;
  readonly status: CircuitSimulationStatus;
  readonly message: string;
  readonly circuitCurrentA: number;
  readonly sourceVoltageV: number;
  readonly totalResistanceOhm: number;
  readonly ledVoltageV: number;
  readonly currentMarginPercent: number;
  readonly orderedComponentIds: readonly EntityId[];
  readonly resistors: readonly CircuitResistorResult[];
  readonly terminalPotentialsV: Readonly<Record<string, number>>;
  readonly issues: readonly string[];
  readonly provenance: "calculated";
}

export interface CircuitVoltageProbeRecord {
  readonly id: string;
  readonly entityId: EntityId;
  readonly label: string;
  readonly positive: CircuitTerminalRef;
  readonly negative: CircuitTerminalRef;
  readonly valueV: number | null;
  readonly simulationId: string | null;
  readonly source: "calculated";
}

export interface CircuitBuilderRestoreState {
  readonly records?: readonly CircuitSimulationResult[];
  readonly probes?: readonly CircuitVoltageProbeRecord[];
}

interface ComponentTemplate {
  readonly type: string;
  readonly label: string;
  readonly entryPort: string | null;
  readonly exitPort: string | null;
  readonly defaultState: string;
  readonly properties: EngineeringEntity["properties"];
  readonly ports: EngineeringEntity["ports"];
  readonly explanation: string;
}

const templates: Readonly<Record<CircuitComponentKind, ComponentTemplate>> = {
  "dc-source": {
    type: "DcPowerSource",
    label: "Fonte DC",
    entryPort: "negative",
    exitPort: "positive",
    defaultState: "ready",
    properties: {
      voltageV: { id: "voltageV", value: 5, unit: "V", source: "user", confidence: 1, min: 0.1, max: 24 },
      currentLimitA: { id: "currentLimitA", value: 1, unit: "A", source: "studio", confidence: 0.9, min: 0.001, max: 5 },
      measuredCurrentA: { id: "measuredCurrentA", value: 0, unit: "A", source: "calculated", confidence: 1 }
    },
    ports: {
      positive: { id: "positive", kind: "electrical", direction: "out", compatibility: ["electronics.dc-node"], state: "available" },
      negative: { id: "negative", kind: "electrical", direction: "in", compatibility: ["electronics.dc-node"], state: "available" }
    },
    explanation: "A fonte estabelece a diferença de potencial e limita a corrente disponível ao circuito."
  },
  switch: {
    type: "CircuitSwitch",
    label: "Chave",
    entryPort: "input",
    exitPort: "output",
    defaultState: "open",
    properties: {
      closed: { id: "closed", value: false, source: "user", confidence: 1 }
    },
    ports: {
      input: { id: "input", kind: "electrical", direction: "in", compatibility: ["electronics.dc-node"], state: "available" },
      output: { id: "output", kind: "electrical", direction: "out", compatibility: ["electronics.dc-node"], state: "available" }
    },
    explanation: "A chave abre ou fecha o caminho de corrente sem criar energia no circuito."
  },
  resistor: {
    type: "Resistor",
    label: "Resistor",
    entryPort: "input",
    exitPort: "output",
    defaultState: "ready",
    properties: {
      resistanceOhm: { id: "resistanceOhm", value: 330, unit: "Ω", source: "user", confidence: 1, min: 1, max: 1_000_000 },
      powerRatingW: { id: "powerRatingW", value: 0.25, unit: "W", source: "studio", confidence: 0.9, min: 0.01, max: 100 },
      voltageDropV: { id: "voltageDropV", value: 0, unit: "V", source: "calculated", confidence: 1 },
      powerW: { id: "powerW", value: 0, unit: "W", source: "calculated", confidence: 1 }
    },
    ports: {
      input: { id: "input", kind: "electrical", direction: "in", compatibility: ["electronics.dc-node"], state: "available" },
      output: { id: "output", kind: "electrical", direction: "out", compatibility: ["electronics.dc-node"], state: "available" }
    },
    explanation: "O resistor limita corrente e dissipa potência conforme a tensão aplicada e sua resistência."
  },
  led: {
    type: "Led",
    label: "LED",
    entryPort: "anode",
    exitPort: "cathode",
    defaultState: "off",
    properties: {
      forwardVoltageV: { id: "forwardVoltageV", value: 2, unit: "V", source: "studio", confidence: 0.85, min: 0.5, max: 6 },
      maxCurrentA: { id: "maxCurrentA", value: 0.02, unit: "A", source: "studio", confidence: 0.85, min: 0.001, max: 1 },
      currentA: { id: "currentA", value: 0, unit: "A", source: "calculated", confidence: 1 },
      powerW: { id: "powerW", value: 0, unit: "W", source: "calculated", confidence: 1 }
    },
    ports: {
      anode: { id: "anode", kind: "electrical", direction: "in", compatibility: ["electronics.dc-node"], state: "available" },
      cathode: { id: "cathode", kind: "electrical", direction: "out", compatibility: ["electronics.dc-node"], state: "available" }
    },
    explanation: "O LED conduz no sentido ânodo-cátodo acima de sua tensão direta e deve operar dentro do limite de corrente."
  }
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function terminalKey(ref: CircuitTerminalRef): string {
  return `${ref.entityId}:${ref.portId}`;
}

function componentKind(entity: EngineeringEntity): CircuitComponentKind | null {
  const value = entity.metadata.circuitKind;
  return value === "dc-source" || value === "switch" || value === "resistor" || value === "led" ? value : null;
}

function replaceValues(
  session: EngineeringSession,
  entityId: EntityId,
  values: Readonly<Record<string, EngineeringPropertyValue>>,
  state?: string
): void {
  const before = session.getEntity(entityId);
  const properties = { ...before.properties };
  for (const [propertyId, value] of Object.entries(values)) {
    const property = properties[propertyId];
    if (!property) throw new Error(`${entityId} missing circuit property ${propertyId}`);
    if (typeof value === "number") {
      if (typeof property.min === "number" && value < property.min) throw new Error(`${entityId}.${propertyId} below minimum ${property.min}`);
      if (typeof property.max === "number" && value > property.max) throw new Error(`${entityId}.${propertyId} above maximum ${property.max}`);
    }
    properties[propertyId] = { ...property, value };
  }
  session.graph.replaceEntity({ ...before, properties, ...(state !== undefined ? { state } : {}) });
}

function rootEntity(): EngineeringEntity {
  return createEngineeringEntity({
    id: CIRCUIT_ROOT_ID,
    type: "CircuitProject",
    name: "Circuit Builder",
    state: "editing",
    properties: {
      topologyStatus: { id: "topologyStatus", value: "incomplete", source: "calculated", confidence: 1 },
      lastCurrentA: { id: "lastCurrentA", value: 0, unit: "A", source: "calculated", confidence: 1 }
    },
    ports: {},
    capabilities: [{ id: "inspect", label: "Inspecionar" }, { id: "explain", label: "Explicar" }],
    metadata: {
      circuitRuntimeVersion: CIRCUIT_RUNTIME_VERSION,
      signature: CIRCUIT_RUNTIME_SIGNATURE,
      voiceAliases: ["circuit builder", "circuito livre", "circuito criado", "montagem livre"],
      simpleExplanation: "Um Circuit Project registra componentes, terminais, fios e probes como um grafo editável de engenharia."
    }
  });
}

function compatible(from: EngineeringPort, to: EngineeringPort): boolean {
  if (from.kind !== "electrical" || to.kind !== "electrical") return false;
  if (from.direction === "in" || to.direction === "out") return false;
  return from.compatibility.some((token) => to.compatibility.includes(token));
}

export class CircuitBuilder {
  readonly #records: CircuitSimulationResult[];
  readonly #probes: CircuitVoltageProbeRecord[];
  #simulationSequence = 0;
  #probeSequence = 0;

  constructor(readonly session: EngineeringSession, restore: CircuitBuilderRestoreState = {}) {
    if (session.project.projectId !== "electronics-workbench-01") {
      throw new Error(`CircuitBuilder requires electronics-workbench-01, got ${session.project.projectId}`);
    }
    const snapshot = session.graph.snapshot();
    if (!snapshot.entities.some((entity) => entity.id === CIRCUIT_ROOT_ID)) {
      session.graph.addEntity(rootEntity());
      session.graph.connect({
        id: "electronics-contains-circuit-builder",
        source: "electronics.root",
        target: CIRCUIT_ROOT_ID,
        type: "contains",
        metadata: { role: "circuit-project", signature: CIRCUIT_RUNTIME_SIGNATURE }
      });
    }
    this.#records = (restore.records ?? []).map(clone);
    this.#probes = (restore.probes ?? []).map(clone);
    this.#simulationSequence = this.#records.length;
    this.#probeSequence = Math.max(0, ...this.#probes.map((probe) => Number(probe.id.split("-").at(-1)) || 0));
  }

  records(): readonly CircuitSimulationResult[] {
    return this.#records.map(clone);
  }

  probes(): readonly CircuitVoltageProbeRecord[] {
    return this.#probes.map(clone);
  }

  components(): readonly EngineeringEntity[] {
    return this.session.graph.snapshot().entities.filter((entity) => entity.parentId === CIRCUIT_ROOT_ID && componentKind(entity) !== null);
  }

  wires(): readonly EngineeringRelationship[] {
    return this.session.graph.snapshot().relationships.filter((relationship) => relationship.type === "connectedTo" && relationship.metadata.circuitBuilder === true);
  }

  document(): CircuitDocument {
    return {
      circuitVersion: CIRCUIT_RUNTIME_VERSION,
      signature: CIRCUIT_RUNTIME_SIGNATURE,
      rootEntityId: CIRCUIT_ROOT_ID,
      components: this.components().map((entity) => ({
        entityId: entity.id,
        kind: componentKind(entity)!,
        name: entity.name,
        state: entity.state
      })),
      wires: this.wires().map((wire) => ({
        id: wire.id,
        from: { entityId: wire.source, portId: String(wire.metadata.sourcePortId) },
        to: { entityId: wire.target, portId: String(wire.metadata.targetPortId) }
      }))
    };
  }

  reset(): void {
    for (const entity of [...this.components(), ...this.session.graph.snapshot().entities.filter((item) => item.parentId === CIRCUIT_ROOT_ID && item.type === "VoltageProbe")]) {
      this.session.graph.removeEntity(entity.id);
    }
    this.#records.splice(0);
    this.#probes.splice(0);
    this.#simulationSequence = 0;
    this.#probeSequence = 0;
    replaceValues(this.session, CIRCUIT_ROOT_ID, { topologyStatus: "incomplete", lastCurrentA: 0 }, "editing");
  }

  addComponent(kind: CircuitComponentKind, values: Readonly<Record<string, EngineeringPropertyValue>> = {}): EngineeringEntity {
    const template = templates[kind];
    const sequence = this.components().filter((entity) => componentKind(entity) === kind).length + 1;
    const id = `circuit.${kind}.${sequence}`;
    if (this.session.graph.snapshot().entities.some((entity) => entity.id === id)) throw new Error(`Circuit component already exists: ${id}`);
    const entity = createEngineeringEntity({
      id,
      type: template.type,
      name: `${template.label} ${sequence}`,
      state: template.defaultState,
      parentId: CIRCUIT_ROOT_ID,
      properties: clone(template.properties),
      ports: clone(template.ports),
      capabilities: [{ id: "inspect", label: "Inspecionar" }, { id: "explain", label: "Explicar" }],
      metadata: {
        circuitKind: kind,
        circuitRuntimeVersion: CIRCUIT_RUNTIME_VERSION,
        signature: CIRCUIT_RUNTIME_SIGNATURE,
        voiceAliases: [template.label.toLowerCase(), kind, `${kind} ${sequence}`],
        simpleExplanation: template.explanation
      }
    });
    this.session.graph.addEntity(entity);
    this.session.graph.connect({
      id: `circuit-contains-${kind}-${sequence}`,
      source: CIRCUIT_ROOT_ID,
      target: id,
      type: "contains",
      metadata: { kind, signature: CIRCUIT_RUNTIME_SIGNATURE }
    });
    if (Object.keys(values).length > 0) replaceValues(this.session, id, values);
    return this.session.getEntity(id);
  }

  removeComponent(entityId: EntityId): void {
    const entity = this.session.getEntity(entityId);
    if (entity.parentId !== CIRCUIT_ROOT_ID || !componentKind(entity)) throw new Error(`${entityId} is not a Circuit Builder component`);
    this.session.graph.removeEntity(entityId);
  }

  setComponentValue(entityId: EntityId, propertyId: string, value: EngineeringPropertyValue): void {
    const entity = this.session.getEntity(entityId);
    if (entity.parentId !== CIRCUIT_ROOT_ID || !componentKind(entity)) throw new Error(`${entityId} is not a Circuit Builder component`);
    replaceValues(this.session, entityId, { [propertyId]: value });
  }

  setSwitchClosed(entityId: EntityId, closed: boolean): void {
    const entity = this.session.getEntity(entityId);
    if (componentKind(entity) !== "switch") throw new Error(`${entityId} is not a Circuit Builder switch`);
    replaceValues(this.session, entityId, { closed }, closed ? "closed" : "open");
  }

  availableOutputs(): readonly CircuitTerminalRef[] {
    const occupied = new Set(this.wires().map((wire) => terminalKey({ entityId: wire.source, portId: String(wire.metadata.sourcePortId) })));
    return this.components().flatMap((entity) => Object.values(entity.ports)
      .filter((port) => port.direction !== "in")
      .map((port) => ({ entityId: entity.id, portId: port.id }))
      .filter((terminal) => !occupied.has(terminalKey(terminal))));
  }

  availableInputs(): readonly CircuitTerminalRef[] {
    const occupied = new Set(this.wires().map((wire) => terminalKey({ entityId: wire.target, portId: String(wire.metadata.targetPortId) })));
    return this.components().flatMap((entity) => Object.values(entity.ports)
      .filter((port) => port.direction !== "out")
      .map((port) => ({ entityId: entity.id, portId: port.id }))
      .filter((terminal) => !occupied.has(terminalKey(terminal))));
  }

  connect(from: CircuitTerminalRef, to: CircuitTerminalRef): CircuitWireSnapshot {
    if (from.entityId === to.entityId) throw new Error("Circuit wire cannot connect a component to itself");
    const fromEntity = this.session.getEntity(from.entityId);
    const toEntity = this.session.getEntity(to.entityId);
    if (fromEntity.parentId !== CIRCUIT_ROOT_ID || toEntity.parentId !== CIRCUIT_ROOT_ID) throw new Error("Circuit wire endpoints must belong to Circuit Builder");
    const fromPort = fromEntity.ports[from.portId];
    const toPort = toEntity.ports[to.portId];
    if (!fromPort || !toPort) throw new Error("Circuit wire references an unknown terminal");
    if (!compatible(fromPort, toPort)) throw new Error(`Incompatible circuit terminals: ${terminalKey(from)} → ${terminalKey(to)}`);
    const occupiedOutputs = new Set(this.wires().map((wire) => terminalKey({ entityId: wire.source, portId: String(wire.metadata.sourcePortId) })));
    const occupiedInputs = new Set(this.wires().map((wire) => terminalKey({ entityId: wire.target, portId: String(wire.metadata.targetPortId) })));
    if (occupiedOutputs.has(terminalKey(from))) throw new Error(`Circuit output terminal already connected: ${terminalKey(from)}`);
    if (occupiedInputs.has(terminalKey(to))) throw new Error(`Circuit input terminal already connected: ${terminalKey(to)}`);
    const id = `circuit-wire-${this.wires().length + 1}`;
    this.session.graph.connect({
      id,
      source: from.entityId,
      target: to.entityId,
      type: "connectedTo",
      metadata: {
        circuitBuilder: true,
        sourcePortId: from.portId,
        targetPortId: to.portId,
        interface: "electronics.dc-node",
        signature: CIRCUIT_RUNTIME_SIGNATURE
      }
    });
    return { id, from: clone(from), to: clone(to) };
  }

  disconnect(wireId: string): void {
    const wire = this.wires().find((item) => item.id === wireId);
    if (!wire) throw new Error(`Unknown Circuit Builder wire: ${wireId}`);
    this.session.graph.disconnect(wireId);
  }

  createSeriesLedCircuit(): CircuitDocument {
    this.reset();
    const source = this.addComponent("dc-source", { voltageV: 5, currentLimitA: 1 });
    const switchEntity = this.addComponent("switch");
    const resistor = this.addComponent("resistor", { resistanceOhm: 330, powerRatingW: 0.25 });
    const led = this.addComponent("led", { forwardVoltageV: 2, maxCurrentA: 0.02 });
    this.connect({ entityId: source.id, portId: "positive" }, { entityId: switchEntity.id, portId: "input" });
    this.connect({ entityId: switchEntity.id, portId: "output" }, { entityId: resistor.id, portId: "input" });
    this.connect({ entityId: resistor.id, portId: "output" }, { entityId: led.id, portId: "anode" });
    this.connect({ entityId: led.id, portId: "cathode" }, { entityId: source.id, portId: "negative" });
    return this.document();
  }

  #topology(): { ordered: EngineeringEntity[]; source: EngineeringEntity | null; led: EngineeringEntity | null; issues: string[] } {
    const components = this.components();
    const sources = components.filter((entity) => componentKind(entity) === "dc-source");
    const leds = components.filter((entity) => componentKind(entity) === "led");
    const resistors = components.filter((entity) => componentKind(entity) === "resistor");
    const issues: string[] = [];
    if (sources.length !== 1) issues.push(`series solver requires exactly one DC source, got ${sources.length}`);
    if (leds.length !== 1) issues.push(`series solver requires exactly one LED, got ${leds.length}`);
    if (resistors.length < 1) issues.push("series solver requires at least one resistor");
    if (issues.length > 0) return { ordered: [], source: sources[0] ?? null, led: leds[0] ?? null, issues };

    const source = sources[0]!;
    const led = leds[0]!;
    const wires = this.wires();
    const ordered: EngineeringEntity[] = [];
    const visited = new Set<EntityId>([source.id]);
    let currentEntity = source;
    let exitPort = templates[componentKind(currentEntity)!].exitPort!;

    for (let step = 0; step <= components.length; step += 1) {
      const outgoing = wires.filter((wire) => wire.source === currentEntity.id && wire.metadata.sourcePortId === exitPort);
      if (outgoing.length !== 1) {
        issues.push(`${currentEntity.id}:${exitPort} requires exactly one outgoing wire`);
        break;
      }
      const wire = outgoing[0]!;
      const target = this.session.getEntity(wire.target);
      const targetPortId = String(wire.metadata.targetPortId);
      if (target.id === source.id) {
        if (targetPortId !== "negative") issues.push("series loop must return to source negative terminal");
        if (ordered.length !== components.length - 1) issues.push("series loop does not include every Circuit Builder component exactly once");
        break;
      }
      if (visited.has(target.id)) {
        issues.push(`series loop contains a repeated component: ${target.id}`);
        break;
      }
      const kind = componentKind(target);
      if (!kind) {
        issues.push(`unsupported circuit entity in series path: ${target.id}`);
        break;
      }
      const template = templates[kind];
      if (targetPortId !== template.entryPort) {
        issues.push(`${target.id} must be entered through ${template.entryPort}`);
        break;
      }
      ordered.push(target);
      visited.add(target.id);
      currentEntity = target;
      exitPort = template.exitPort!;
    }
    return { ordered, source, led, issues };
  }

  simulate(): CircuitSimulationResult {
    const topology = this.#topology();
    const occurredAt = new Date().toISOString();
    const incomplete = this.components().length < 4 || this.wires().length < 4;
    if (topology.issues.length > 0) {
      const status: CircuitSimulationStatus = incomplete ? "incomplete" : "unsupported";
      const result: CircuitSimulationResult = {
        id: `circuit-sim-${++this.#simulationSequence}`,
        occurredAt,
        status,
        message: `${status === "incomplete" ? "Circuito incompleto" : "Topologia não suportada"}: ${topology.issues.join("; ")}`,
        circuitCurrentA: 0,
        sourceVoltageV: topology.source ? Number(topology.source.properties.voltageV?.value ?? 0) : 0,
        totalResistanceOhm: 0,
        ledVoltageV: 0,
        currentMarginPercent: 0,
        orderedComponentIds: topology.ordered.map((entity) => entity.id),
        resistors: [],
        terminalPotentialsV: {},
        issues: [...topology.issues],
        provenance: "calculated"
      };
      this.#records.push(result);
      replaceValues(this.session, CIRCUIT_ROOT_ID, { topologyStatus: status, lastCurrentA: 0 }, status);
      return clone(result);
    }

    const source = topology.source!;
    const led = topology.led!;
    const sourceVoltageV = Number(source.properties.voltageV?.value);
    const sourceCurrentLimitA = Number(source.properties.currentLimitA?.value);
    const ledForwardVoltageV = Number(led.properties.forwardVoltageV?.value);
    const ledMaxCurrentA = Number(led.properties.maxCurrentA?.value);
    const resistors = topology.ordered.filter((entity) => componentKind(entity) === "resistor");
    const switches = topology.ordered.filter((entity) => componentKind(entity) === "switch");
    const totalResistanceOhm = resistors.reduce((sum, entity) => sum + Number(entity.properties.resistanceOhm?.value), 0);
    const allClosed = switches.every((entity) => entity.properties.closed?.value === true);
    const rawCurrentA = allClosed && sourceVoltageV > ledForwardVoltageV ? (sourceVoltageV - ledForwardVoltageV) / totalResistanceOhm : 0;
    const circuitCurrentA = round(rawCurrentA);
    const limitingCurrentA = Math.min(sourceCurrentLimitA, ledMaxCurrentA);
    const currentMarginPercent = limitingCurrentA > 0 ? round(((limitingCurrentA - circuitCurrentA) / limitingCurrentA) * 100, 2) : 0;
    const resistorResults = resistors.map((entity) => {
      const resistanceOhm = Number(entity.properties.resistanceOhm?.value);
      const powerRatingW = Number(entity.properties.powerRatingW?.value);
      return {
        entityId: entity.id,
        resistanceOhm,
        voltageDropV: round(circuitCurrentA * resistanceOhm),
        powerW: round(circuitCurrentA ** 2 * resistanceOhm),
        powerRatingW
      } satisfies CircuitResistorResult;
    });
    const ledVoltageV = round(circuitCurrentA > 0 ? ledForwardVoltageV : 0);
    const resistorFault = resistorResults.some((item) => item.powerW > item.powerRatingW);
    const currentRatio = limitingCurrentA > 0 ? circuitCurrentA / limitingCurrentA : 0;

    let status: CircuitSimulationStatus = "open";
    let message = "Circuito série válido, porém aberto por uma chave.";
    if (allClosed) {
      if (currentRatio > 1 || resistorFault) {
        status = "fault";
        message = currentRatio > 1
          ? `Sobrecorrente: ${round(circuitCurrentA * 1000, 2)} mA excede o limite de ${round(limitingCurrentA * 1000, 2)} mA.`
          : "Falha por potência: ao menos um resistor excede sua potência nominal.";
      } else if (currentRatio >= 0.8 || resistorResults.some((item) => item.powerW >= item.powerRatingW * 0.8)) {
        status = "warning";
        message = "Circuito série válido com margem elétrica abaixo de 20%.";
      } else {
        status = "pass";
        message = circuitCurrentA > 0 ? "Circuito série criado e operando dentro dos limites." : "Circuito série fechado, mas sem tensão suficiente para condução do LED.";
      }
    }

    const potentials: Record<string, number> = {
      [terminalKey({ entityId: source.id, portId: "positive" })]: round(sourceVoltageV),
      [terminalKey({ entityId: source.id, portId: "negative" })]: 0
    };
    let potential = sourceVoltageV;
    for (const entity of topology.ordered) {
      const kind = componentKind(entity)!;
      const template = templates[kind];
      potentials[terminalKey({ entityId: entity.id, portId: template.entryPort! })] = round(potential);
      if (kind === "resistor") {
        const result = resistorResults.find((item) => item.entityId === entity.id)!;
        potential -= result.voltageDropV;
      } else if (kind === "led" && circuitCurrentA > 0) {
        potential -= ledForwardVoltageV;
      }
      potentials[terminalKey({ entityId: entity.id, portId: template.exitPort! })] = round(potential);
    }

    replaceValues(this.session, CIRCUIT_ROOT_ID, { topologyStatus: status, lastCurrentA: circuitCurrentA }, status);
    replaceValues(this.session, source.id, { measuredCurrentA: circuitCurrentA });
    for (const item of resistorResults) {
      replaceValues(this.session, item.entityId, { voltageDropV: item.voltageDropV, powerW: item.powerW }, item.powerW > item.powerRatingW ? "fault" : "ready");
    }
    replaceValues(this.session, led.id, { currentA: circuitCurrentA, powerW: round(circuitCurrentA * ledVoltageV) }, status === "fault" ? "fault" : circuitCurrentA > 0 ? "on" : "off");

    const result: CircuitSimulationResult = {
      id: `circuit-sim-${++this.#simulationSequence}`,
      occurredAt,
      status,
      message,
      circuitCurrentA,
      sourceVoltageV,
      totalResistanceOhm: round(totalResistanceOhm, 3),
      ledVoltageV,
      currentMarginPercent,
      orderedComponentIds: topology.ordered.map((entity) => entity.id),
      resistors: resistorResults,
      terminalPotentialsV: potentials,
      issues: [],
      provenance: "calculated"
    };
    this.#records.push(result);
    this.session.events.record({
      id: `circuit-event-${this.#simulationSequence}`,
      type: status === "fault" ? "CircuitFaultDetected" : "CircuitSimulationCompleted",
      occurredAt,
      source: "simulation",
      payload: {
        simulationId: result.id,
        status,
        circuitCurrentA,
        componentIds: result.orderedComponentIds,
        signature: CIRCUIT_RUNTIME_SIGNATURE
      }
    });
    return clone(result);
  }

  placeVoltageProbe(label: string, positive: CircuitTerminalRef, negative: CircuitTerminalRef): CircuitVoltageProbeRecord {
    if (!label.trim()) throw new Error("Voltage probe label is required");
    const positiveEntity = this.session.getEntity(positive.entityId);
    const negativeEntity = this.session.getEntity(negative.entityId);
    if (!positiveEntity.ports[positive.portId] || !negativeEntity.ports[negative.portId]) throw new Error("Voltage probe references an unknown terminal");
    if (positiveEntity.parentId !== CIRCUIT_ROOT_ID || negativeEntity.parentId !== CIRCUIT_ROOT_ID) throw new Error("Voltage probe endpoints must belong to Circuit Builder");
    const id = `circuit-probe-${++this.#probeSequence}`;
    const entityId = `circuit.probe.${this.#probeSequence}`;
    const entity = createEngineeringEntity({
      id: entityId,
      type: "VoltageProbe",
      name: label,
      state: "placed",
      parentId: CIRCUIT_ROOT_ID,
      properties: {
        lastValueV: { id: "lastValueV", value: 0, unit: "V", source: "calculated", confidence: 1 }
      },
      ports: {},
      capabilities: [{ id: "inspect", label: "Inspecionar" }, { id: "explain", label: "Explicar" }],
      metadata: {
        positive: clone(positive),
        negative: clone(negative),
        signature: CIRCUIT_RUNTIME_SIGNATURE,
        simpleExplanation: "Um probe de tensão mede diferença de potencial entre dois terminais sem alterar o circuito ideal."
      }
    });
    this.session.graph.addEntity(entity);
    this.session.graph.connect({
      id: `circuit-contains-probe-${this.#probeSequence}`,
      source: CIRCUIT_ROOT_ID,
      target: entityId,
      type: "contains",
      metadata: { role: "voltage-probe", signature: CIRCUIT_RUNTIME_SIGNATURE }
    });
    const record: CircuitVoltageProbeRecord = { id, entityId, label: label.trim(), positive: clone(positive), negative: clone(negative), valueV: null, simulationId: null, source: "calculated" };
    this.#probes.push(record);
    return clone(record);
  }

  measureProbe(probeId: string): CircuitVoltageProbeRecord {
    const index = this.#probes.findIndex((probe) => probe.id === probeId);
    if (index < 0) throw new Error(`Unknown voltage probe: ${probeId}`);
    const simulation = this.#records.at(-1) ?? this.simulate();
    if (simulation.status === "incomplete" || simulation.status === "unsupported") {
      throw new Error(`Cannot measure unsupported circuit topology: ${simulation.issues.join("; ")}`);
    }
    const probe = this.#probes[index]!;
    const positive = simulation.terminalPotentialsV[terminalKey(probe.positive)];
    const negative = simulation.terminalPotentialsV[terminalKey(probe.negative)];
    if (positive === undefined || negative === undefined) throw new Error("Probe terminals do not have solved potentials in the current circuit");
    const measured = { ...probe, valueV: round(positive - negative), simulationId: simulation.id };
    this.#probes[index] = measured;
    replaceValues(this.session, measured.entityId, { lastValueV: measured.valueV });
    this.session.events.record({
      id: `circuit-measurement-${this.#simulationSequence}-${index + 1}`,
      type: "CircuitVoltageMeasured",
      occurredAt: new Date().toISOString(),
      source: "simulation",
      payload: { probeId, valueV: measured.valueV, simulationId: simulation.id, signature: CIRCUIT_RUNTIME_SIGNATURE }
    });
    return clone(measured);
  }
}
