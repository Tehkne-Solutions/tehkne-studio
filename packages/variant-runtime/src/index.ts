import {
  assessArmLoad,
  type ArmActuatorEnvelope,
  type ArmLoadAssessment
} from "../../failure-simulation/src/index.js";

export type VariantValidationStatus = "pass" | "warning" | "fault";

export interface VariantDesignChange {
  readonly id: string;
  readonly label: string;
  readonly property: string;
  readonly before: number | string;
  readonly after: number | string;
  readonly unit?: string;
  readonly rationale: string;
}

export interface VariantImpact {
  readonly id: string;
  readonly category: "mechanical" | "electrical" | "thermal" | "cost" | "manufacturing";
  readonly label: string;
  readonly direction: "increase" | "decrease" | "changed";
  readonly before: number | string;
  readonly after: number | string;
  readonly unit?: string;
  readonly provenance: "authored-estimate" | "simulated";
}

export interface ArmVariantProfile {
  readonly variantId: string;
  readonly name: string;
  readonly parentVariantId: string;
  readonly projectId: string;
  readonly actuatorEnvelope: ArmActuatorEnvelope;
  readonly actuatorMassKg: number;
  readonly estimatedActuatorCostBrl: number;
  readonly supplyCurrentCapacityA: number;
  readonly provenance: {
    readonly kind: "studio-variant-profile";
    readonly maturity: "functional-model";
    readonly note: string;
  };
}

export interface ArmVariantComparison {
  readonly payloadKg: number;
  readonly horizontalReachM: number;
  readonly base: {
    readonly variantId: string;
    readonly assessment: ArmLoadAssessment;
  };
  readonly candidate: {
    readonly variantId: string;
    readonly assessment: ArmLoadAssessment;
  };
  readonly changes: readonly VariantDesignChange[];
  readonly impacts: readonly VariantImpact[];
  readonly validationStatus: VariantValidationStatus;
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function compareArmVariant(
  payloadKg: number,
  horizontalReachM: number,
  baseVariantId: string,
  baseEnvelope: ArmActuatorEnvelope,
  baseActuatorMassKg: number,
  baseActuatorCostBrl: number,
  baseSupplyCurrentCapacityA: number,
  candidate: ArmVariantProfile
): ArmVariantComparison {
  const baseAssessment = assessArmLoad({ payloadKg, horizontalReachM, envelope: baseEnvelope });
  const candidateAssessment = assessArmLoad({
    payloadKg,
    horizontalReachM,
    envelope: candidate.actuatorEnvelope
  });

  const changes: VariantDesignChange[] = [
    {
      id: "torque-envelope",
      label: "Actuator torque envelope",
      property: "torqueLimitNm",
      before: baseEnvelope.torqueLimitNm,
      after: candidate.actuatorEnvelope.torqueLimitNm,
      unit: "N·m",
      rationale: "A falha-base excedeu o envelope de torque no payload-alvo."
    },
    {
      id: "torque-constant",
      label: "Torque constant",
      property: "torqueConstantNmPerA",
      before: baseEnvelope.torqueConstantNmPerA,
      after: candidate.actuatorEnvelope.torqueConstantNmPerA,
      unit: "N·m/A",
      rationale: "A variante usa um atuador funcionalmente mais eficiente para produzir torque com menor corrente no mesmo ponto de operação."
    },
    {
      id: "supply-capacity",
      label: "Power current capacity",
      property: "supplyCurrentCapacityA",
      before: baseSupplyCurrentCapacityA,
      after: candidate.supplyCurrentCapacityA,
      unit: "A",
      rationale: "O subsistema elétrico precisa suportar o novo envelope do atuador, mesmo que a corrente simulada neste caso seja menor."
    }
  ];

  const impacts: VariantImpact[] = [
    {
      id: "mass-impact",
      category: "mechanical",
      label: "Actuator mass",
      direction: candidate.actuatorMassKg >= baseActuatorMassKg ? "increase" : "decrease",
      before: baseActuatorMassKg,
      after: candidate.actuatorMassKg,
      unit: "kg",
      provenance: "authored-estimate"
    },
    {
      id: "cost-impact",
      category: "cost",
      label: "Estimated actuator cost",
      direction: candidate.estimatedActuatorCostBrl >= baseActuatorCostBrl ? "increase" : "decrease",
      before: baseActuatorCostBrl,
      after: candidate.estimatedActuatorCostBrl,
      unit: "BRL",
      provenance: "authored-estimate"
    },
    {
      id: "current-impact",
      category: "electrical",
      label: "Simulated current at target load",
      direction: candidateAssessment.currentA >= baseAssessment.currentA ? "increase" : "decrease",
      before: baseAssessment.currentA,
      after: candidateAssessment.currentA,
      unit: "A",
      provenance: "simulated"
    },
    {
      id: "thermal-impact",
      category: "thermal",
      label: "Simulated actuator temperature",
      direction: candidateAssessment.temperatureC >= baseAssessment.temperatureC ? "increase" : "decrease",
      before: baseAssessment.temperatureC,
      after: candidateAssessment.temperatureC,
      unit: "°C",
      provenance: "simulated"
    },
    {
      id: "margin-impact",
      category: "mechanical",
      label: "Limiting engineering margin",
      direction: candidateAssessment.limitingMarginPercent >= baseAssessment.limitingMarginPercent ? "increase" : "decrease",
      before: baseAssessment.limitingMarginPercent,
      after: candidateAssessment.limitingMarginPercent,
      unit: "%",
      provenance: "simulated"
    }
  ];

  return {
    payloadKg: round(payloadKg, 3),
    horizontalReachM: round(horizontalReachM, 3),
    base: { variantId: baseVariantId, assessment: baseAssessment },
    candidate: { variantId: candidate.variantId, assessment: candidateAssessment },
    changes,
    impacts,
    validationStatus: candidateAssessment.status
  };
}
