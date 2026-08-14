export type FailureAssessmentStatus = "pass" | "warning" | "fault";
export type FailureMode = "none" | "torque_limit" | "current_limit" | "thermal_limit" | "multi_limit";

export interface ArmActuatorEnvelope {
  readonly profileId: string;
  readonly gravityMps2: number;
  readonly torqueLimitNm: number;
  readonly currentLimitA: number;
  readonly maxTemperatureC: number;
  readonly torqueConstantNmPerA: number;
  readonly windingResistanceOhm: number;
  readonly thermalGainCPerW: number;
  readonly ambientTemperatureC: number;
  readonly warningMarginPercent: number;
}

export interface ArmLoadAssessmentInput {
  readonly payloadKg: number;
  readonly horizontalReachM: number;
  readonly envelope: ArmActuatorEnvelope;
}

export interface ArmLoadAssessment {
  readonly status: FailureAssessmentStatus;
  readonly failureMode: FailureMode;
  readonly payloadKg: number;
  readonly horizontalReachM: number;
  readonly requiredTorqueNm: number;
  readonly currentA: number;
  readonly copperLossW: number;
  readonly temperatureC: number;
  readonly torqueMarginPercent: number;
  readonly currentMarginPercent: number;
  readonly temperatureMarginPercent: number;
  readonly limitingMarginPercent: number;
}

export interface FailureTraceStep {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly value?: number;
  readonly unit?: string;
}

function finitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive finite number`);
}

function round(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function margin(limit: number, observed: number): number {
  return ((limit - observed) / limit) * 100;
}

export function assessArmLoad(input: ArmLoadAssessmentInput): ArmLoadAssessment {
  const { payloadKg, horizontalReachM, envelope } = input;
  finitePositive(payloadKg, "payloadKg");
  finitePositive(horizontalReachM, "horizontalReachM");
  finitePositive(envelope.gravityMps2, "gravityMps2");
  finitePositive(envelope.torqueLimitNm, "torqueLimitNm");
  finitePositive(envelope.currentLimitA, "currentLimitA");
  finitePositive(envelope.maxTemperatureC, "maxTemperatureC");
  finitePositive(envelope.torqueConstantNmPerA, "torqueConstantNmPerA");
  finitePositive(envelope.windingResistanceOhm, "windingResistanceOhm");
  finitePositive(envelope.thermalGainCPerW, "thermalGainCPerW");

  const requiredTorqueNm = payloadKg * envelope.gravityMps2 * horizontalReachM;
  const currentA = requiredTorqueNm / envelope.torqueConstantNmPerA;
  const copperLossW = currentA ** 2 * envelope.windingResistanceOhm;
  const temperatureC = envelope.ambientTemperatureC + copperLossW * envelope.thermalGainCPerW;
  const torqueMarginPercent = margin(envelope.torqueLimitNm, requiredTorqueNm);
  const currentMarginPercent = margin(envelope.currentLimitA, currentA);
  const temperatureMarginPercent = margin(envelope.maxTemperatureC, temperatureC);
  const limitingMarginPercent = Math.min(torqueMarginPercent, currentMarginPercent, temperatureMarginPercent);

  const exceeded = [
    requiredTorqueNm > envelope.torqueLimitNm ? "torque_limit" : null,
    currentA > envelope.currentLimitA ? "current_limit" : null,
    temperatureC > envelope.maxTemperatureC ? "thermal_limit" : null
  ].filter((value): value is Exclude<FailureMode, "none" | "multi_limit"> => value !== null);

  const failureMode: FailureMode = exceeded.length === 0
    ? "none"
    : exceeded.length === 1
      ? exceeded[0]!
      : "multi_limit";
  const status: FailureAssessmentStatus = exceeded.length > 0
    ? "fault"
    : limitingMarginPercent <= envelope.warningMarginPercent
      ? "warning"
      : "pass";

  return {
    status,
    failureMode,
    payloadKg: round(payloadKg),
    horizontalReachM: round(horizontalReachM),
    requiredTorqueNm: round(requiredTorqueNm),
    currentA: round(currentA),
    copperLossW: round(copperLossW),
    temperatureC: round(temperatureC),
    torqueMarginPercent: round(torqueMarginPercent, 2),
    currentMarginPercent: round(currentMarginPercent, 2),
    temperatureMarginPercent: round(temperatureMarginPercent, 2),
    limitingMarginPercent: round(limitingMarginPercent, 2)
  };
}

export function buildFailureTrace(assessment: ArmLoadAssessment, envelope: ArmActuatorEnvelope): FailureTraceStep[] {
  const trace: FailureTraceStep[] = [
    {
      id: "payload",
      label: "Payload",
      detail: `A massa aplicada é ${assessment.payloadKg} kg.`,
      value: assessment.payloadKg,
      unit: "kg"
    },
    {
      id: "lever-arm",
      label: "Lever arm",
      detail: `O objeto está a ${assessment.horizontalReachM} m do eixo vertical da base.`,
      value: assessment.horizontalReachM,
      unit: "m"
    },
    {
      id: "required-torque",
      label: "Required torque",
      detail: `Payload × gravidade × alcance exige ${assessment.requiredTorqueNm} N·m; envelope ${envelope.torqueLimitNm} N·m.`,
      value: assessment.requiredTorqueNm,
      unit: "N·m"
    },
    {
      id: "motor-current",
      label: "Motor current",
      detail: `O torque solicitado implica ${assessment.currentA} A; envelope ${envelope.currentLimitA} A.`,
      value: assessment.currentA,
      unit: "A"
    },
    {
      id: "thermal",
      label: "Thermal stress",
      detail: `Perdas resistivas elevam a estimativa térmica para ${assessment.temperatureC} °C; limite ${envelope.maxTemperatureC} °C.`,
      value: assessment.temperatureC,
      unit: "°C"
    },
    {
      id: "margin",
      label: assessment.status === "fault" ? "Failure envelope exceeded" : "Remaining engineering margin",
      detail: assessment.status === "fault"
        ? `Um ou mais limites foram excedidos (${assessment.failureMode}); a execução deve permanecer bloqueada.`
        : `A menor margem restante é ${assessment.limitingMarginPercent}%.`,
      value: assessment.limitingMarginPercent,
      unit: "%"
    }
  ];
  return trace;
}
