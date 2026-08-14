import type { EngineeringEntity, EntityId, PropertySource } from "../../engineering-core/src/index.js";
import type { EngineeringSession } from "../../engineering-session/src/index.js";
import {
  assessArmLoad,
  buildFailureTrace,
  type ArmActuatorEnvelope,
  type ArmLoadAssessment,
  type FailureTraceStep
} from "../../failure-simulation/src/index.js";

export interface FailureExperimentRecord {
  readonly id: string;
  readonly targetEntityId: EntityId;
  readonly assessment: ArmLoadAssessment;
  readonly occurredAt: string;
}

export interface ArmFailureLabRestoreState {
  readonly records?: readonly FailureExperimentRecord[];
}

export interface FailureExplanation {
  readonly assessment: ArmLoadAssessment;
  readonly trace: readonly FailureTraceStep[];
  readonly message: string;
}

function numeric(entity: EngineeringEntity, propertyId: string): number {
  const value = entity.properties[propertyId]?.value;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${entity.id}.${propertyId} must be numeric`);
  return value;
}

function cloneRecord(record: FailureExperimentRecord): FailureExperimentRecord {
  return JSON.parse(JSON.stringify(record)) as FailureExperimentRecord;
}

function sequenceFrom(records: readonly FailureExperimentRecord[]): number {
  return records.reduce((max, record) => {
    const match = record.id.match(/failure-experiment-(\d+)$/);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 0);
}

function withSimulatedProperty(
  entity: EngineeringEntity,
  propertyId: string,
  value: string | number | boolean | null,
  unit?: string,
  source: PropertySource = "simulated"
): EngineeringEntity {
  const existing = entity.properties[propertyId];
  return {
    ...entity,
    properties: {
      ...entity.properties,
      [propertyId]: existing
        ? { ...existing, value }
        : {
            id: propertyId,
            value,
            source,
            confidence: 1,
            ...(unit ? { unit } : {})
          }
    }
  };
}

function replaceExistingProperty(
  session: EngineeringSession,
  entityId: EntityId,
  propertyId: string,
  value: string | number | boolean | null
): EngineeringEntity {
  const entity = session.getEntity(entityId);
  const existing = entity.properties[propertyId];
  if (!existing) throw new Error(`${entityId}.${propertyId} does not exist`);
  const updated: EngineeringEntity = {
    ...entity,
    properties: {
      ...entity.properties,
      [propertyId]: { ...existing, value }
    }
  };
  session.graph.replaceEntity(updated);
  return updated;
}

export class ArmFailureLab {
  readonly #records: FailureExperimentRecord[] = [];
  #sequence = 0;

  constructor(
    readonly session: EngineeringSession,
    readonly envelope: ArmActuatorEnvelope,
    readonly targetEntityId: EntityId = "object.cube.red",
    restore: ArmFailureLabRestoreState = {}
  ) {
    const records = restore.records ?? [];
    const ids = new Set<string>();
    for (const record of records) {
      if (!record.id || ids.has(record.id)) throw new Error(`Invalid restored Failure Lab record id: ${record.id}`);
      ids.add(record.id);
      this.session.getEntity(record.targetEntityId);
      if (record.targetEntityId !== this.targetEntityId) throw new Error(`Restored Failure Lab target mismatch: ${record.targetEntityId}`);
      if (Number.isNaN(Date.parse(record.occurredAt))) throw new Error(`Invalid restored Failure Lab timestamp: ${record.id}`);
      this.#records.push(cloneRecord(record));
    }
    this.#sequence = Math.max(records.length, sequenceFrom(records));
  }

  records(): readonly FailureExperimentRecord[] {
    return this.#records.map(cloneRecord);
  }

  latest(): FailureExperimentRecord | null {
    const record = this.#records.at(-1);
    return record ? cloneRecord(record) : null;
  }

  setPayloadMass(payloadKg: number): EngineeringEntity {
    if (!Number.isFinite(payloadKg) || payloadKg <= 0) throw new Error("payloadKg must be positive");
    const updated = replaceExistingProperty(this.session, this.targetEntityId, "massKg", payloadKg);
    this.session.events.record({
      id: `failure-event-${this.session.events.list().length + 1}`,
      type: "PayloadChanged",
      occurredAt: new Date().toISOString(),
      source: "simulation",
      payload: { targetEntityId: this.targetEntityId, payloadKg }
    });
    return updated;
  }

  run(payloadKg?: number): FailureExperimentRecord {
    if (payloadKg !== undefined) this.setPayloadMass(payloadKg);
    const target = this.session.getEntity(this.targetEntityId);
    if (target.state !== "free") throw new Error("Failure Lab requires a free workpiece before pickup");

    const xM = numeric(target, "xM");
    const zM = numeric(target, "zM");
    const massKg = numeric(target, "massKg");
    const horizontalReachM = Math.hypot(xM, zM);
    const assessment = assessArmLoad({ payloadKg: massKg, horizontalReachM, envelope: this.envelope });
    const occurredAt = new Date().toISOString();

    let robot = this.session.getEntity("arm.root");
    for (const [id, value, unit] of [
      ["requiredTorqueNm", assessment.requiredTorqueNm, "N·m"],
      ["motorCurrentA", assessment.currentA, "A"],
      ["motorTemperatureC", assessment.temperatureC, "°C"],
      ["limitingMarginPercent", assessment.limitingMarginPercent, "%"],
      ["failureMode", assessment.failureMode, undefined]
    ] as const) {
      robot = withSimulatedProperty(robot, id, value, unit);
    }
    robot = {
      ...robot,
      state: assessment.status === "fault" ? "fault" : assessment.status === "warning" ? "degraded" : "idle"
    };
    this.session.graph.replaceEntity(robot);

    let controller = this.session.getEntity("arm.controller");
    controller = withSimulatedProperty(controller, "loadAssessmentStatus", assessment.status);
    const motionState = assessment.status === "fault" ? "blocked" : assessment.status === "warning" ? "limited" : "idle";
    controller = replaceControllerMotionState(controller, motionState);
    this.session.graph.replaceEntity(controller);

    const record: FailureExperimentRecord = {
      id: `failure-experiment-${++this.#sequence}`,
      targetEntityId: target.id,
      assessment,
      occurredAt
    };
    this.#records.push(record);

    this.session.events.record({
      id: `failure-event-${this.session.events.list().length + 1}`,
      type: assessment.status === "fault"
        ? "FailureDetected"
        : assessment.status === "warning"
          ? "FailureRiskObserved"
          : "FailureExperimentPassed",
      occurredAt,
      source: "simulation",
      payload: {
        experimentId: record.id,
        targetEntityId: target.id,
        assessment,
        envelopeProfileId: this.envelope.profileId
      }
    });
    return cloneRecord(record);
  }

  explainLatest(): FailureExplanation {
    const latest = this.latest();
    if (!latest) throw new Error("No failure experiment is available to explain");
    const trace = buildFailureTrace(latest.assessment, this.envelope);
    const message = latest.assessment.status === "fault"
      ? `ARM-01 falhou porque a carga de ${latest.assessment.payloadKg} kg levou o sistema além do envelope do atuador (${latest.assessment.failureMode}).`
      : latest.assessment.status === "warning"
        ? `ARM-01 ainda não falhou, mas a carga reduziu a menor margem de engenharia para ${latest.assessment.limitingMarginPercent}%.`
        : `ARM-01 permanece dentro do envelope; a menor margem é ${latest.assessment.limitingMarginPercent}%.`;

    this.session.events.record({
      id: `failure-event-${this.session.events.list().length + 1}`,
      type: "FailureCausalityExplained",
      occurredAt: new Date().toISOString(),
      source: "simulation",
      payload: {
        experimentId: latest.id,
        status: latest.assessment.status,
        failureMode: latest.assessment.failureMode,
        trace
      }
    });
    return { assessment: latest.assessment, trace, message };
  }
}

function replaceControllerMotionState(entity: EngineeringEntity, value: string): EngineeringEntity {
  const existing = entity.properties.motionState;
  if (!existing) throw new Error(`${entity.id}.motionState does not exist`);
  return {
    ...entity,
    state: value === "blocked" ? "fault" : value === "limited" ? "degraded" : "idle",
    properties: {
      ...entity.properties,
      motionState: { ...existing, value }
    }
  };
}
