import type { EntityId } from "../../engineering-core/src/index.js";
import type { ArmFailureLab } from "../../studio-failure/src/index.js";
import {
  compareArmVariant,
  type ArmVariantComparison,
  type ArmVariantProfile
} from "../../variant-runtime/src/index.js";
import type { ArmActuatorEnvelope } from "../../failure-simulation/src/index.js";

export interface BaseVariantProfile extends ArmActuatorEnvelope {
  readonly variantId: string;
  readonly actuatorMassKg: number;
  readonly estimatedActuatorCostBrl: number;
  readonly supplyCurrentCapacityA: number;
}

export interface EngineeringVariantRecord {
  readonly id: string;
  readonly name: string;
  readonly parentVariantId: string;
  readonly sourceFailureExperimentId: string;
  readonly sourceEntityId: EntityId;
  readonly decision: string;
  readonly comparison: ArmVariantComparison;
  readonly createdAt: string;
  readonly status: "validated";
}

export interface ArmVariantLabRestoreState {
  readonly records?: readonly EngineeringVariantRecord[];
}

export interface StudioVariantSummary {
  readonly variantId: string;
  readonly name: string;
  readonly parentVariantId: string;
  readonly validationStatus: "pass";
  readonly message: string;
}

function cloneRecord(record: EngineeringVariantRecord): EngineeringVariantRecord {
  return JSON.parse(JSON.stringify(record)) as EngineeringVariantRecord;
}

export class ArmVariantLab {
  readonly #records: EngineeringVariantRecord[] = [];

  constructor(
    readonly failureLab: ArmFailureLab,
    readonly baseProfile: BaseVariantProfile,
    readonly candidateProfile: ArmVariantProfile,
    readonly sourceEntityId: EntityId = "arm.root",
    restore: ArmVariantLabRestoreState = {}
  ) {
    const records = restore.records ?? [];
    const ids = new Set<string>();
    for (const record of records) {
      if (!record.id || ids.has(record.id)) throw new Error(`Invalid restored variant id: ${record.id}`);
      ids.add(record.id);
      if (record.parentVariantId !== this.baseProfile.variantId) throw new Error(`Restored variant parent mismatch: ${record.id}`);
      if (record.id !== this.candidateProfile.variantId) throw new Error(`Restored variant profile mismatch: ${record.id}`);
      if (record.sourceEntityId !== this.sourceEntityId) throw new Error(`Restored variant source entity mismatch: ${record.sourceEntityId}`);
      if (record.status !== "validated" || record.comparison.candidate.assessment.status !== "pass") {
        throw new Error(`Restored variant is not validated: ${record.id}`);
      }
      if (record.comparison.base.assessment.status !== "fault") throw new Error(`Restored variant lost base failure evidence: ${record.id}`);
      if (Number.isNaN(Date.parse(record.createdAt))) throw new Error(`Invalid restored variant timestamp: ${record.id}`);
      this.failureLab.session.getEntity(record.sourceEntityId);
      this.#records.push(cloneRecord(record));
    }
  }

  records(): readonly EngineeringVariantRecord[] {
    return this.#records.map(cloneRecord);
  }

  latest(): EngineeringVariantRecord | null {
    const record = this.#records.at(-1);
    return record ? cloneRecord(record) : null;
  }

  createHighTorqueVariant(): StudioVariantSummary {
    const evidence = this.failureLab.latest();
    if (!evidence) throw new Error("A variante exige um experimento de falha anterior como evidência.");
    if (evidence.assessment.status !== "fault") {
      throw new Error("A variante high-torque só pode ser criada a partir de uma condição de falha confirmada.");
    }
    if (this.candidateProfile.parentVariantId !== this.baseProfile.variantId) {
      throw new Error("Variant parent does not match the current base variant.");
    }

    const comparison = compareArmVariant(
      evidence.assessment.payloadKg,
      evidence.assessment.horizontalReachM,
      this.baseProfile.variantId,
      this.baseProfile,
      this.baseProfile.actuatorMassKg,
      this.baseProfile.estimatedActuatorCostBrl,
      this.baseProfile.supplyCurrentCapacityA,
      this.candidateProfile
    );

    if (comparison.base.assessment.status !== "fault") {
      throw new Error("Source evidence no longer reproduces the base failure.");
    }
    if (comparison.candidate.assessment.status !== "pass") {
      throw new Error("Candidate variant does not close the source failure with a healthy engineering margin.");
    }

    const existing = this.#records.find((record) => record.id === this.candidateProfile.variantId);
    if (existing) {
      return {
        variantId: existing.id,
        name: existing.name,
        parentVariantId: existing.parentVariantId,
        validationStatus: "pass",
        message: `${existing.name} já existe e permanece validada para ${comparison.payloadKg} kg.`
      };
    }

    const createdAt = new Date().toISOString();
    const record: EngineeringVariantRecord = {
      id: this.candidateProfile.variantId,
      name: this.candidateProfile.name,
      parentVariantId: this.candidateProfile.parentVariantId,
      sourceFailureExperimentId: evidence.id,
      sourceEntityId: this.sourceEntityId,
      decision: `Aumentar o envelope do atuador para eliminar a falha ${evidence.assessment.failureMode} observada em ${evidence.assessment.payloadKg} kg, preservando rastreabilidade de massa, custo, corrente e temperatura.`,
      comparison,
      createdAt,
      status: "validated"
    };
    this.#records.push(record);

    const events = this.failureLab.session.events;
    events.record({
      id: `variant-event-${events.list().length + 1}`,
      type: "VariantCreated",
      occurredAt: createdAt,
      source: "simulation",
      payload: {
        variantId: record.id,
        parentVariantId: record.parentVariantId,
        sourceFailureExperimentId: record.sourceFailureExperimentId,
        changes: comparison.changes
      }
    });
    events.record({
      id: `variant-event-${events.list().length + 1}`,
      type: "ImpactAnalysisCompleted",
      occurredAt: createdAt,
      source: "simulation",
      payload: { variantId: record.id, impacts: comparison.impacts }
    });
    events.record({
      id: `variant-event-${events.list().length + 1}`,
      type: "VariantValidated",
      occurredAt: createdAt,
      source: "simulation",
      payload: {
        variantId: record.id,
        payloadKg: comparison.payloadKg,
        baseStatus: comparison.base.assessment.status,
        candidateStatus: comparison.candidate.assessment.status,
        candidateMarginPercent: comparison.candidate.assessment.limitingMarginPercent
      }
    });

    return {
      variantId: record.id,
      name: record.name,
      parentVariantId: record.parentVariantId,
      validationStatus: "pass",
      message: `${record.name} criada a partir da falha-base: ${comparison.payloadKg} kg muda de FAULT para PASS com margem mínima de ${comparison.candidate.assessment.limitingMarginPercent}%.`
    };
  }
}
