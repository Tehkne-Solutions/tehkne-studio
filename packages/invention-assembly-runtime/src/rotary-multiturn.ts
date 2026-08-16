export const ROTARY_MULTITURN_VERSION = "1" as const;
export const ROTARY_MULTITURN_EPSILON = 0.0001;
export const ROTARY_MULTITURN_MAX_STEP_RAD = Math.PI;

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return value;
}

function principal(value: number, label: string): number {
  finite(value, label);
  const normalized = Math.atan2(Math.sin(value), Math.cos(value));
  if (Math.abs(value - normalized) > ROTARY_MULTITURN_EPSILON) {
    throw new Error(`${label} must be a principal angle in [-pi, pi]`);
  }
  return Object.is(normalized, -0) ? 0 : normalized;
}

function revolutionCount(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error("Rotary revolution count must be a safe integer");
  return value;
}

export function rotaryJointUnwrappedAngle(principalAngle: number, revolutions: number): number {
  const angle = principal(principalAngle, "Rotary principal angle");
  const turns = revolutionCount(revolutions);
  return turns * Math.PI * 2 + angle;
}

export function advanceRotaryRevolutionCount(
  currentRevolutions: number,
  previousPrincipalAngle: number,
  nextPrincipalAngle: number,
  commandedDeltaRad: number,
  epsilon = ROTARY_MULTITURN_EPSILON
): number {
  const turns = revolutionCount(currentRevolutions);
  const previous = principal(previousPrincipalAngle, "Previous rotary principal angle");
  const next = principal(nextPrincipalAngle, "Next rotary principal angle");
  const delta = finite(commandedDeltaRad, "Rotary commanded delta");
  if (!Number.isFinite(epsilon) || epsilon < 0) throw new Error("Rotary multi-turn epsilon must be finite and non-negative");
  if (Math.abs(delta) >= ROTARY_MULTITURN_MAX_STEP_RAD - epsilon) {
    throw new Error("Rotary multi-turn step must remain below pi to resolve revolution direction unambiguously");
  }

  let nextTurns = turns;
  const principalJump = next - previous;
  if (delta > epsilon && principalJump < -Math.PI) nextTurns += 1;
  if (delta < -epsilon && principalJump > Math.PI) nextTurns -= 1;

  const beforeUnwrapped = rotaryJointUnwrappedAngle(previous, turns);
  const afterUnwrapped = rotaryJointUnwrappedAngle(next, nextTurns);
  if (Math.abs((afterUnwrapped - beforeUnwrapped) - delta) > Math.max(epsilon, Math.abs(delta) * 0.001)) {
    throw new Error("Rotary multi-turn transition does not match the commanded geometric step");
  }
  return nextTurns;
}
