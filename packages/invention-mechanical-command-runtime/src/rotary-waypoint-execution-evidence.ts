import type { StudioCommand } from "../../command-bus/src/index.js";
import type { EngineeringSession } from "../../engineering-session/src/index.js";
import { MECHANICAL_COMMAND_SIGNATURE, type MechanicalRotaryCommandResult } from "./index.js";

export interface MechanicalRotaryWaypointExecutionSegmentEvidence {
  readonly index: number;
  readonly movementCommandId: string;
  readonly beforeContinuousRadians: number;
  readonly afterContinuousRadians: number;
  readonly deltaRadians: number;
  readonly durationSeconds: number | null;
  readonly averageAngularVelocityRadPerSec: number | null;
  readonly averageRpm: number | null;
  readonly rateMode: MechanicalRotaryCommandResult["rateMode"];
  readonly mode: MechanicalRotaryCommandResult["mode"];
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

export interface MechanicalRotaryWaypointExecutionEvidence {
  readonly commandId: string;
  readonly relationshipId: string;
  readonly source: StudioCommand["source"];
  readonly sequenceKey: string;
  readonly sequenceName: string;
  readonly stepsCompleted: number;
  readonly movementCommandIds: readonly string[];
  readonly beforeContinuousRadians: number;
  readonly afterContinuousRadians: number;
  readonly totalDeltaRadians: number;
  readonly cumulativeAbsoluteTravelRadians: number;
  readonly timedSteps: number;
  readonly untimedSteps: number;
  readonly explicitDurationSeconds: number;
  readonly totalDurationSeconds: number | null;
  readonly durationMode: "complete-explicit" | "partial-explicit" | "unresolved-no-duration";
  readonly finalMovementCommandId: string;
  readonly finalRateMode: MechanicalRotaryCommandResult["rateMode"];
  readonly segments: readonly MechanicalRotaryWaypointExecutionSegmentEvidence[];
  readonly derivedFrom: "session-events";
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be string evidence`);
  return value;
}

function numeric(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be finite numeric evidence`);
  return value;
}

function nullableNumeric(value: unknown, label: string): number | null {
  if (value === null) return null;
  return numeric(value, label);
}

function source(value: unknown): StudioCommand["source"] {
  if (value === "ui" || value === "voice" || value === "automation" || value === "simulation" || value === "system") return value;
  throw new Error("Mechanical rotary waypoint execution source is invalid");
}

function rateMode(value: unknown): MechanicalRotaryCommandResult["rateMode"] {
  if (value === "segment-average" || value === "unresolved-no-duration") return value;
  throw new Error("Mechanical rotary waypoint execution rate mode is invalid");
}

function movementMode(value: unknown): MechanicalRotaryCommandResult["mode"] {
  if (value === "incremental" || value === "principal-shortest" || value === "continuous-absolute") return value;
  throw new Error("Mechanical rotary waypoint execution movement mode is invalid");
}

function movementEventType(type: string): boolean {
  return type === "MechanicalRotaryStepExecuted"
    || type === "MechanicalRotaryTargetExecuted"
    || type === "MechanicalRotaryContinuousTargetExecuted";
}

function movementByCommandId(session: EngineeringSession, relationshipId: string, commandId: string): MechanicalRotaryWaypointExecutionSegmentEvidence {
  const matching = session.events.list().filter((event) => {
    if (!movementEventType(event.type) || !record(event.payload)) return false;
    return event.payload.commandId === commandId && event.payload.relationshipId === relationshipId;
  });
  if (matching.length !== 1) throw new Error(`Mechanical rotary waypoint movement evidence must resolve exactly once: ${commandId}`);
  const payload = matching[0]!.payload;
  if (!record(payload)) throw new Error(`Mechanical rotary waypoint movement payload is invalid: ${commandId}`);
  if (payload.signature !== MECHANICAL_COMMAND_SIGNATURE) throw new Error(`Mechanical rotary waypoint movement signature mismatch: ${commandId}`);
  return {
    index: 0,
    movementCommandId: commandId,
    beforeContinuousRadians: numeric(payload.beforeContinuousRadians, "Mechanical rotary waypoint movement before continuous"),
    afterContinuousRadians: numeric(payload.afterContinuousRadians, "Mechanical rotary waypoint movement after continuous"),
    deltaRadians: numeric(payload.deltaRadians, "Mechanical rotary waypoint movement delta"),
    durationSeconds: nullableNumeric(payload.durationSeconds, "Mechanical rotary waypoint movement duration"),
    averageAngularVelocityRadPerSec: nullableNumeric(payload.averageAngularVelocityRadPerSec, "Mechanical rotary waypoint movement angular velocity"),
    averageRpm: nullableNumeric(payload.averageRpm, "Mechanical rotary waypoint movement RPM"),
    rateMode: rateMode(payload.rateMode),
    mode: movementMode(payload.mode),
    signature: MECHANICAL_COMMAND_SIGNATURE
  };
}

function executionFromEvent(session: EngineeringSession, event: ReturnType<EngineeringSession["events"]["list"]>[number]): MechanicalRotaryWaypointExecutionEvidence {
  if (!record(event.payload)) throw new Error("Mechanical rotary waypoint execution payload must be an object");
  const payload = event.payload;
  if (payload.signature !== MECHANICAL_COMMAND_SIGNATURE) throw new Error("Mechanical rotary waypoint execution signature mismatch");
  if (!Array.isArray(payload.movementCommandIds) || payload.movementCommandIds.length < 1) {
    throw new Error("Mechanical rotary waypoint execution requires movement command ids");
  }
  const relationshipId = text(payload.relationshipId, "Mechanical rotary waypoint execution relationship id");
  const movementCommandIds = payload.movementCommandIds.map((value) => text(value, "Mechanical rotary waypoint movement command id"));
  if (new Set(movementCommandIds).size !== movementCommandIds.length) {
    throw new Error("Mechanical rotary waypoint execution contains duplicate movement command ids");
  }
  const segments = movementCommandIds.map((commandId, index) => ({
    ...movementByCommandId(session, relationshipId, commandId),
    index
  }));
  for (let index = 1; index < segments.length; index += 1) {
    const previous = segments[index - 1]!;
    const current = segments[index]!;
    if (Math.abs(previous.afterContinuousRadians - current.beforeContinuousRadians) > 1e-9) {
      throw new Error(`Mechanical rotary waypoint execution continuity mismatch at segment ${index}`);
    }
  }
  const timedSteps = segments.filter((segment) => segment.durationSeconds !== null).length;
  const untimedSteps = segments.length - timedSteps;
  const explicitDurationSeconds = segments.reduce((sum, segment) => sum + (segment.durationSeconds ?? 0), 0);
  const durationMode = untimedSteps === 0
    ? "complete-explicit"
    : timedSteps === 0
      ? "unresolved-no-duration"
      : "partial-explicit";
  const beforeContinuousRadians = numeric(payload.beforeContinuousRadians, "Mechanical rotary waypoint execution before continuous");
  const afterContinuousRadians = numeric(payload.afterContinuousRadians, "Mechanical rotary waypoint execution after continuous");
  const totalDeltaRadians = numeric(payload.totalDeltaRadians, "Mechanical rotary waypoint execution total delta");
  if (Math.abs(segments[0]!.beforeContinuousRadians - beforeContinuousRadians) > 1e-9
    || Math.abs(segments.at(-1)!.afterContinuousRadians - afterContinuousRadians) > 1e-9
    || Math.abs((afterContinuousRadians - beforeContinuousRadians) - totalDeltaRadians) > 1e-9) {
    throw new Error("Mechanical rotary waypoint execution aggregate evidence mismatch");
  }
  const finalMovementCommandId = text(payload.finalMovementCommandId, "Mechanical rotary waypoint final movement command id");
  if (finalMovementCommandId !== movementCommandIds.at(-1)) throw new Error("Mechanical rotary waypoint final movement id mismatch");
  const stepsCompleted = numeric(payload.stepsCompleted, "Mechanical rotary waypoint steps completed");
  if (!Number.isInteger(stepsCompleted) || stepsCompleted !== segments.length) throw new Error("Mechanical rotary waypoint steps completed mismatch");
  const finalRateMode = rateMode(payload.finalRateMode);
  if (finalRateMode !== segments.at(-1)!.rateMode) throw new Error("Mechanical rotary waypoint final rate mode mismatch");
  return {
    commandId: text(payload.commandId, "Mechanical rotary waypoint execution command id"),
    relationshipId,
    source: source(event.source),
    sequenceKey: text(payload.sequenceKey, "Mechanical rotary waypoint sequence key"),
    sequenceName: text(payload.sequenceName, "Mechanical rotary waypoint sequence name"),
    stepsCompleted,
    movementCommandIds,
    beforeContinuousRadians,
    afterContinuousRadians,
    totalDeltaRadians,
    cumulativeAbsoluteTravelRadians: segments.reduce((sum, segment) => sum + Math.abs(segment.deltaRadians), 0),
    timedSteps,
    untimedSteps,
    explicitDurationSeconds,
    totalDurationSeconds: untimedSteps === 0 ? explicitDurationSeconds : null,
    durationMode,
    finalMovementCommandId,
    finalRateMode,
    segments,
    derivedFrom: "session-events",
    signature: MECHANICAL_COMMAND_SIGNATURE
  };
}

export function rotaryWaypointExecutionEvidence(
  session: EngineeringSession,
  relationshipId: string,
  sequenceName?: string
): readonly MechanicalRotaryWaypointExecutionEvidence[] {
  const normalizedSequenceName = sequenceName?.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  return session.events.list()
    .filter((event) => event.type === "MechanicalRotaryWaypointSequenceRequested")
    .map((event) => executionFromEvent(session, event))
    .filter((execution) => execution.relationshipId === relationshipId)
    .filter((execution) => !normalizedSequenceName || execution.sequenceName.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase() === normalizedSequenceName);
}

export function latestRotaryWaypointExecutionEvidence(
  session: EngineeringSession,
  relationshipId: string,
  sequenceName?: string
): MechanicalRotaryWaypointExecutionEvidence | null {
  return rotaryWaypointExecutionEvidence(session, relationshipId, sequenceName).at(-1) ?? null;
}
