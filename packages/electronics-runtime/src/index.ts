import {
  createEngineeringEntity,
  type EngineeringEntity,
  type EngineeringPropertyValue,
  type EntityId
} from "../../engineering-core/src/index.js";
import type { EngineeringRelationship } from "../../engineering-graph/src/index.js";
import type { EngineeringSession } from "../../engineering-session/src/index.js";
import type { TehkneStudioProject } from "../../project-format/src/index.js";

export const ELECTRONICS_WORKBENCH_VERSION = "1" as const;
export const ELECTRONICS_WORKBENCH_SIGNATURE = "Tehkné Solutions" as const;

export interface ElectronicsWorkbenchProfile {
  readonly electronicsVersion: typeof ELECTRONICS_WORKBENCH_VERSION;
  readonly profileId: string;
  readonly projectId: string;
  readonly name: string;
  readonly signature: typeof ELECTRONICS_WORKBENCH_SIGNATURE;
  readonly sourceVoltageV: number;
  readonly sourceCurrentLimitA: number;
  readonly resistorOhms: number;
  readonly resistorPowerRatingW: number;
  readonly ledForwardVoltageV: number;
  readonly ledMaxCurrentA: number;
  readonly switchClosed: boolean;
}

export type ElectronicsSimulationStatus = "open" | "pass" | "warning" | "fault";

export interface ElectronicsSimulationResult {
  readonly id: string;
  readonly occurredAt: string;
  readonly status: ElectronicsSimulationStatus;
  readonly sourceVoltageV: number;
  readonly resistorOhms: number;
  readonly switchClosed: boolean;
  readonly circuitCurrentA: number;
  readonly resistorVoltageV: number;
  readonly ledVoltageV: number;
  readonly resistorPowerW: number;
  readonly ledPowerW: number;
  readonly limitingCurrentA: number;
  readonly currentMarginPercent: number;
  readonly message: string;
  readonly provenance: "calculated";
}

export type ElectronicsMeasurementKind =
  | "source-voltage"
  | "circuit-current"
  | "resistor-voltage"
  | "led-voltage"
  | "resistor-power"
  | "led-power";

export interface ElectronicsMeasurement {
  readonly kind: ElectronicsMeasurementKind;
  readonly value: number;
  readonly unit: "V" | "A" | "W";
  readonly source: "calculated";
  readonly simulationId: string;
}

export interface ElectronicsBenchRestoreState {
  readonly records?: readonly ElectronicsSimulationResult[];
}

function finitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function validateElectronicsWorkbenchProfile(profile: ElectronicsWorkbenchProfile): string[] {
  const errors: string[] = [];
  if (profile.electronicsVersion !== ELECTRONICS_WORKBENCH_VERSION) errors.push(`electronicsVersion must be ${ELECTRONICS_WORKBENCH_VERSION}`);
  if (!profile.profileId.trim()) errors.push("profileId is required");
  if (!profile.projectId.trim()) errors.push("projectId is required");
  if (!profile.name.trim()) errors.push("name is required");
  if (profile.signature !== ELECTRONICS_WORKBENCH_SIGNATURE) errors.push("electronics workbench signature must be Tehkné Solutions");
  if (!finitePositive(profile.sourceVoltageV) || profile.sourceVoltageV > 24) errors.push("sourceVoltageV must be > 0 and <= 24 V");
  if (!finitePositive(profile.sourceCurrentLimitA) || profile.sourceCurrentLimitA > 5) errors.push("sourceCurrentLimitA must be > 0 and <= 5 A");
  if (!finitePositive(profile.resistorOhms) || profile.resistorOhms > 1_000_000) errors.push("resistorOhms must be > 0 and <= 1 Mohm");
  if (!finitePositive(profile.resistorPowerRatingW) || profile.resistorPowerRatingW > 100) errors.push("resistorPowerRatingW must be > 0 and <= 100 W");
  if (!finitePositive(profile.ledForwardVoltageV) || profile.ledForwardVoltageV >= profile.sourceVoltageV) errors.push("ledForwardVoltageV must be positive and below source voltage");
  if (!finitePositive(profile.ledMaxCurrentA) || profile.ledMaxCurrentA > 1) errors.push("ledMaxCurrentA must be > 0 and <= 1 A");
  return errors;
}

function componentEntity(input: {
  id: EntityId;
  type: string;
  name: string;
  state: string;
  parentId: EntityId;
  properties: EngineeringEntity["properties"];
  ports: EngineeringEntity["ports"];
  aliases: readonly string[];
  explanation: string;
}): EngineeringEntity {
  return createEngineeringEntity({
    id: input.id,
    type: input.type,
    name: input.name,
    state: input.state,
    parentId: input.parentId,
    properties: input.properties,
    ports: input.ports,
    capabilities: [{ id: "inspect", label: "Inspecionar" }, { id: "explain", label: "Explicar" }],
    metadata: {
      voiceAliases: [...input.aliases],
      simpleExplanation: input.explanation,
      provenance: "electronics-workbench",
      signature: ELECTRONICS_WORKBENCH_SIGNATURE
    }
  });
}

export function createElectronicsWorkbenchProject(profile: ElectronicsWorkbenchProfile): TehkneStudioProject {
  const errors = validateElectronicsWorkbenchProfile(profile);
  if (errors.length > 0) throw new Error(`Invalid electronics workbench profile: ${errors.join("; ")}`);

  const root = createEngineeringEntity({
    id: "electronics.root",
    type: "ElectronicsWorkbench",
    name: profile.name,
    state: "ready",
    properties: {
      circuitStatus: { id: "circuitStatus", value: "open", source: "simulated", confidence: 1 },
      lastCurrentA: { id: "lastCurrentA", value: 0, unit: "A", source: "calculated", confidence: 1 }
    },
    ports: {},
    capabilities: [{ id: "inspect", label: "Inspecionar" }, { id: "explain", label: "Explicar" }],
    metadata: {
      preset: true,
      profileId: profile.profileId,
      voiceAliases: ["bancada eletronica", "bancada eletrônica", "circuito", "laboratorio eletronico", "laboratório eletrônico"],
      simpleExplanation: "Uma bancada eletrônica permite montar, energizar, medir e diagnosticar circuitos de forma controlada.",
      signature: ELECTRONICS_WORKBENCH_SIGNATURE
    }
  });

  const source = componentEntity({
    id: "electronics.source",
    type: "DcPowerSource",
    name: "Fonte DC Ajustável",
    state: "ready",
    parentId: root.id,
    properties: {
      voltageV: { id: "voltageV", value: profile.sourceVoltageV, unit: "V", source: "user", confidence: 1, min: 0.1, max: 24 },
      currentLimitA: { id: "currentLimitA", value: profile.sourceCurrentLimitA, unit: "A", source: "studio", confidence: 0.9, min: 0.001, max: 5 },
      measuredCurrentA: { id: "measuredCurrentA", value: 0, unit: "A", source: "calculated", confidence: 1 }
    },
    ports: {
      positive: { id: "positive", kind: "electrical", direction: "out", compatibility: ["electronics.dc-node"], state: "connected" },
      negative: { id: "negative", kind: "electrical", direction: "in", compatibility: ["electronics.dc-node"], state: "connected" }
    },
    aliases: ["fonte", "fonte dc", "alimentacao", "alimentação"],
    explanation: "A fonte DC fornece tensão ao circuito e limita a corrente máxima disponível."
  });

  const switchEntity = componentEntity({
    id: "electronics.switch",
    type: "CircuitSwitch",
    name: "Chave do Circuito",
    state: profile.switchClosed ? "closed" : "open",
    parentId: root.id,
    properties: { closed: { id: "closed", value: profile.switchClosed, source: "user", confidence: 1 } },
    ports: {
      input: { id: "input", kind: "electrical", direction: "in", compatibility: ["electronics.dc-node"], state: "connected" },
      output: { id: "output", kind: "electrical", direction: "out", compatibility: ["electronics.dc-node"], state: "connected" }
    },
    aliases: ["chave", "interruptor", "switch"],
    explanation: "A chave abre ou fecha o caminho elétrico. Aberta, interrompe a corrente; fechada, completa o circuito."
  });

  const resistor = componentEntity({
    id: "electronics.resistor",
    type: "Resistor",
    name: "Resistor Limitador",
    state: "ready",
    parentId: root.id,
    properties: {
      resistanceOhm: { id: "resistanceOhm", value: profile.resistorOhms, unit: "Ω", source: "user", confidence: 1, min: 1, max: 1_000_000 },
      powerRatingW: { id: "powerRatingW", value: profile.resistorPowerRatingW, unit: "W", source: "studio", confidence: 0.9, min: 0.01, max: 100 },
      voltageDropV: { id: "voltageDropV", value: 0, unit: "V", source: "calculated", confidence: 1 },
      powerW: { id: "powerW", value: 0, unit: "W", source: "calculated", confidence: 1 }
    },
    ports: {
      input: { id: "input", kind: "electrical", direction: "in", compatibility: ["electronics.dc-node"], state: "connected" },
      output: { id: "output", kind: "electrical", direction: "out", compatibility: ["electronics.dc-node"], state: "connected" }
    },
    aliases: ["resistor", "resistencia", "resistência"],
    explanation: "O resistor limita a corrente convertendo parte da energia elétrica em calor."
  });

  const led = componentEntity({
    id: "electronics.led",
    type: "Led",
    name: "LED Vermelho",
    state: "off",
    parentId: root.id,
    properties: {
      forwardVoltageV: { id: "forwardVoltageV", value: profile.ledForwardVoltageV, unit: "V", source: "studio", confidence: 0.85, min: 0.5, max: 6 },
      maxCurrentA: { id: "maxCurrentA", value: profile.ledMaxCurrentA, unit: "A", source: "studio", confidence: 0.85, min: 0.001, max: 1 },
      currentA: { id: "currentA", value: 0, unit: "A", source: "calculated", confidence: 1 },
      powerW: { id: "powerW", value: 0, unit: "W", source: "calculated", confidence: 1 }
    },
    ports: {
      anode: { id: "anode", kind: "electrical", direction: "in", compatibility: ["electronics.dc-node"], state: "connected" },
      cathode: { id: "cathode", kind: "electrical", direction: "out", compatibility: ["electronics.dc-node"], state: "connected" }
    },
    aliases: ["led", "luz", "diodo emissor"],
    explanation: "O LED conduz acima de sua tensão direta e emite luz, mas precisa de corrente limitada para não ser danificado."
  });

  const meter = componentEntity({
    id: "electronics.multimeter",
    type: "VirtualMultimeter",
    name: "Multímetro Virtual",
    state: "ready",
    parentId: root.id,
    properties: {
      mode: { id: "mode", value: "voltage", source: "user", confidence: 1 },
      lastValue: { id: "lastValue", value: 0, source: "calculated", confidence: 1 },
      lastUnit: { id: "lastUnit", value: "V", source: "calculated", confidence: 1 }
    },
    ports: {
      red: { id: "red", kind: "electrical", direction: "bidirectional", compatibility: ["electronics.measurement-probe"], state: "available" },
      black: { id: "black", kind: "electrical", direction: "bidirectional", compatibility: ["electronics.measurement-probe"], state: "available" }
    },
    aliases: ["multimetro", "multímetro", "tester", "medidor"],
    explanation: "O multímetro mede grandezas elétricas sem alterar o modelo ideal do circuito nesta etapa."
  });

  const relationships: EngineeringRelationship[] = [source, switchEntity, resistor, led, meter].map((entity) => ({
    id: `electronics-contains-${entity.id.split(".").at(-1)}`,
    source: root.id,
    target: entity.id,
    type: "contains",
    metadata: { role: entity.type }
  }));
  relationships.push(
    { id: "electronics-wire-source-switch", source: source.id, target: switchEntity.id, type: "connectedTo", metadata: { sourcePortId: "positive", targetPortId: "input", net: "V+" } },
    { id: "electronics-wire-switch-resistor", source: switchEntity.id, target: resistor.id, type: "connectedTo", metadata: { sourcePortId: "output", targetPortId: "input", net: "SW" } },
    { id: "electronics-wire-resistor-led", source: resistor.id, target: led.id, type: "connectedTo", metadata: { sourcePortId: "output", targetPortId: "anode", net: "LED_A" } },
    { id: "electronics-wire-led-return", source: led.id, target: source.id, type: "connectedTo", metadata: { sourcePortId: "cathode", targetPortId: "negative", net: "GND" } }
  );

  return {
    schemaVersion: "0.1",
    projectId: profile.projectId,
    name: profile.name,
    projectType: "experiment",
    rootEntityId: root.id,
    entities: [root, source, switchEntity, resistor, led, meter],
    relationships,
    metadata: {
      preset: true,
      profileId: profile.profileId,
      electronicsWorkbenchVersion: ELECTRONICS_WORKBENCH_VERSION,
      signature: ELECTRONICS_WORKBENCH_SIGNATURE
    }
  };
}

function replaceProperties(
  session: EngineeringSession,
  entityId: EntityId,
  values: Readonly<Record<string, EngineeringPropertyValue>>,
  state?: string
): EngineeringEntity {
  const before = session.getEntity(entityId);
  const properties = { ...before.properties };
  for (const [propertyId, value] of Object.entries(values)) {
    const property = properties[propertyId];
    if (!property) throw new Error(`${entityId} missing electronics property ${propertyId}`);
    properties[propertyId] = { ...property, value };
  }
  const after: EngineeringEntity = { ...before, properties, ...(state !== undefined ? { state } : {}) };
  session.graph.replaceEntity(after);
  return after;
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export class ElectronicsBench {
  readonly #records: ElectronicsSimulationResult[];
  #sequence = 0;

  constructor(readonly session: EngineeringSession, restore: ElectronicsBenchRestoreState = {}) {
    if (session.project.projectId !== "electronics-workbench-01") {
      throw new Error(`ElectronicsBench requires electronics-workbench-01, got ${session.project.projectId}`);
    }
    this.#records = (restore.records ?? []).map((record) => ({ ...record }));
    this.#sequence = this.#records.length;
  }

  records(): readonly ElectronicsSimulationResult[] {
    return this.#records.map((record) => ({ ...record }));
  }

  setSourceVoltage(voltageV: number): void {
    if (!Number.isFinite(voltageV) || voltageV <= 0 || voltageV > 24) throw new Error("Fonte deve ficar entre 0 e 24 V.");
    replaceProperties(this.session, "electronics.source", { voltageV: round(voltageV, 3) });
  }

  setResistance(resistanceOhm: number): void {
    if (!Number.isFinite(resistanceOhm) || resistanceOhm < 1 || resistanceOhm > 1_000_000) throw new Error("Resistor deve ficar entre 1 Ω e 1 MΩ.");
    replaceProperties(this.session, "electronics.resistor", { resistanceOhm: round(resistanceOhm, 3) });
  }

  setSwitchClosed(closed: boolean): void {
    replaceProperties(this.session, "electronics.switch", { closed }, closed ? "closed" : "open");
  }

  simulate(): ElectronicsSimulationResult {
    const source = this.session.getEntity("electronics.source");
    const resistor = this.session.getEntity("electronics.resistor");
    const led = this.session.getEntity("electronics.led");
    const switchEntity = this.session.getEntity("electronics.switch");

    const sourceVoltageV = Number(source.properties.voltageV?.value);
    const sourceCurrentLimitA = Number(source.properties.currentLimitA?.value);
    const resistorOhms = Number(resistor.properties.resistanceOhm?.value);
    const resistorPowerRatingW = Number(resistor.properties.powerRatingW?.value);
    const ledForwardVoltageV = Number(led.properties.forwardVoltageV?.value);
    const ledMaxCurrentA = Number(led.properties.maxCurrentA?.value);
    const switchClosed = switchEntity.properties.closed?.value === true;

    for (const [label, value] of Object.entries({ sourceVoltageV, sourceCurrentLimitA, resistorOhms, resistorPowerRatingW, ledForwardVoltageV, ledMaxCurrentA })) {
      if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid electronics runtime value: ${label}`);
    }

    const limitingCurrentA = Math.min(sourceCurrentLimitA, ledMaxCurrentA);
    const rawCurrentA = switchClosed && sourceVoltageV > ledForwardVoltageV
      ? (sourceVoltageV - ledForwardVoltageV) / resistorOhms
      : 0;
    const circuitCurrentA = round(rawCurrentA);
    const resistorVoltageV = round(circuitCurrentA * resistorOhms);
    const ledVoltageV = round(circuitCurrentA > 0 ? ledForwardVoltageV : 0);
    const resistorPowerW = round(circuitCurrentA ** 2 * resistorOhms);
    const ledPowerW = round(circuitCurrentA * ledVoltageV);
    const currentMarginPercent = limitingCurrentA > 0
      ? round(((limitingCurrentA - circuitCurrentA) / limitingCurrentA) * 100, 2)
      : 0;

    let status: ElectronicsSimulationStatus = "open";
    let message = "Circuito aberto: a chave interrompe a corrente.";
    if (switchClosed) {
      const currentRatio = circuitCurrentA / limitingCurrentA;
      const resistorOverPower = resistorPowerW > resistorPowerRatingW;
      if (currentRatio > 1 || resistorOverPower) {
        status = "fault";
        message = currentRatio > 1
          ? `Sobrecorrente: ${round(circuitCurrentA * 1000, 2)} mA excede o limite de ${round(limitingCurrentA * 1000, 2)} mA.`
          : `Sobrecarga do resistor: ${resistorPowerW} W excede ${resistorPowerRatingW} W.`;
      } else if (currentRatio >= 0.8 || resistorPowerW >= resistorPowerRatingW * 0.8) {
        status = "warning";
        message = "Circuito funciona, mas a margem elétrica está abaixo de 20%.";
      } else {
        status = "pass";
        message = circuitCurrentA > 0 ? "Circuito saudável: LED energizado dentro dos limites." : "Circuito fechado, mas a tensão não supera a tensão direta do LED.";
      }
    }

    replaceProperties(this.session, "electronics.root", { circuitStatus: status, lastCurrentA: circuitCurrentA });
    replaceProperties(this.session, "electronics.source", { measuredCurrentA: circuitCurrentA });
    replaceProperties(this.session, "electronics.resistor", { voltageDropV: resistorVoltageV, powerW: resistorPowerW }, resistorPowerW > resistorPowerRatingW ? "fault" : "ready");
    replaceProperties(this.session, "electronics.led", { currentA: circuitCurrentA, powerW: ledPowerW }, status === "fault" ? "fault" : circuitCurrentA > 0 ? "on" : "off");

    const record: ElectronicsSimulationResult = {
      id: `electronics-sim-${++this.#sequence}`,
      occurredAt: new Date().toISOString(),
      status,
      sourceVoltageV,
      resistorOhms,
      switchClosed,
      circuitCurrentA,
      resistorVoltageV,
      ledVoltageV,
      resistorPowerW,
      ledPowerW,
      limitingCurrentA,
      currentMarginPercent,
      message,
      provenance: "calculated"
    };
    this.#records.push(record);
    this.session.events.record({
      id: `electronics-event-${this.#sequence}`,
      type: status === "fault" ? "ElectronicsFaultDetected" : "ElectronicsSimulationCompleted",
      occurredAt: record.occurredAt,
      source: "simulation",
      payload: {
        simulationId: record.id,
        status,
        circuitCurrentA,
        resistorPowerW,
        ledPowerW,
        signature: ELECTRONICS_WORKBENCH_SIGNATURE
      }
    });
    return { ...record };
  }

  measure(kind: ElectronicsMeasurementKind): ElectronicsMeasurement {
    const simulation = this.#records.at(-1) ?? this.simulate();
    const values: Record<ElectronicsMeasurementKind, readonly [number, "V" | "A" | "W"]> = {
      "source-voltage": [simulation.sourceVoltageV, "V"],
      "circuit-current": [simulation.circuitCurrentA, "A"],
      "resistor-voltage": [simulation.resistorVoltageV, "V"],
      "led-voltage": [simulation.ledVoltageV, "V"],
      "resistor-power": [simulation.resistorPowerW, "W"],
      "led-power": [simulation.ledPowerW, "W"]
    };
    const [value, unit] = values[kind];
    replaceProperties(this.session, "electronics.multimeter", { lastValue: value, lastUnit: unit });
    return { kind, value, unit, source: "calculated", simulationId: simulation.id };
  }
}
