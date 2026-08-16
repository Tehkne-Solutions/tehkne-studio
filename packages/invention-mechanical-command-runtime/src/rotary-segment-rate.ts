export const ROTARY_SEGMENT_RATE_SIGNATURE = "Tehkné Solutions" as const;

export interface RotarySegmentRateEvidence {
  readonly deltaRadians: number;
  readonly durationSeconds: number;
  readonly averageAngularVelocityRadPerSec: number;
  readonly averageRpm: number;
  readonly mode: "segment-average";
  readonly signature: typeof ROTARY_SEGMENT_RATE_SIGNATURE;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return value;
}

export function validateRotaryDurationSeconds(value: number): number {
  const duration = finite(value, "Rotary command durationSeconds");
  if (duration <= 0) throw new Error("Rotary command durationSeconds must be greater than zero");
  return duration;
}

export function deriveRotarySegmentRate(
  deltaRadiansInput: number,
  durationSecondsInput: number
): RotarySegmentRateEvidence {
  const deltaRadians = finite(deltaRadiansInput, "Rotary segment deltaRadians");
  const durationSeconds = validateRotaryDurationSeconds(durationSecondsInput);
  const averageAngularVelocityRadPerSec = deltaRadians / durationSeconds;
  const averageRpm = averageAngularVelocityRadPerSec * 60 / (Math.PI * 2);
  if (!Number.isFinite(averageAngularVelocityRadPerSec) || !Number.isFinite(averageRpm)) {
    throw new Error("Rotary segment rate must remain finite");
  }
  return {
    deltaRadians,
    durationSeconds,
    averageAngularVelocityRadPerSec,
    averageRpm,
    mode: "segment-average",
    signature: ROTARY_SEGMENT_RATE_SIGNATURE
  };
}
