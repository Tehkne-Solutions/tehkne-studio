import { normalizePrincipalAngle } from "./rotary-relative-angle.js";

export const ROTARY_TAU = Math.PI * 2;
export const ROTARY_CONTINUOUS_EPSILON = 0.000001;

export interface RotaryContinuousState {
  readonly principalRadians: number;
  readonly continuousRadians: number;
  readonly revolutions: number;
}

function finite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
}

export function rotaryContinuousState(
  principalRadiansInput: number,
  continuousRadiansInput: number,
  epsilon = ROTARY_CONTINUOUS_EPSILON
): RotaryContinuousState {
  finite(principalRadiansInput, "Rotary principal angle");
  finite(continuousRadiansInput, "Rotary continuous angle");
  finite(epsilon, "Rotary continuous epsilon");
  if (epsilon < 0) throw new Error("Rotary continuous epsilon must be non-negative");

  const principalRadians = normalizePrincipalAngle(principalRadiansInput);
  const continuousRadians = Math.abs(continuousRadiansInput) <= Number.EPSILON ? 0 : continuousRadiansInput;
  const turnsFloat = (continuousRadians - principalRadians) / ROTARY_TAU;
  const revolutions = Math.round(turnsFloat);
  const residual = Math.abs(turnsFloat - revolutions) * ROTARY_TAU;
  if (residual > epsilon) {
    throw new Error(`Rotary continuous angle is inconsistent with principal evidence: residual=${residual}`);
  }
  return { principalRadians, continuousRadians, revolutions };
}

export function advanceRotaryContinuousState(
  beforeContinuousRadians: number,
  commandedDeltaRadians: number,
  afterPrincipalRadians: number,
  epsilon = ROTARY_CONTINUOUS_EPSILON
): RotaryContinuousState {
  finite(beforeContinuousRadians, "Rotary continuous before angle");
  finite(commandedDeltaRadians, "Rotary commanded delta");
  finite(afterPrincipalRadians, "Rotary principal after angle");
  const continuousRadians = beforeContinuousRadians + commandedDeltaRadians;
  return rotaryContinuousState(afterPrincipalRadians, continuousRadians, epsilon);
}
