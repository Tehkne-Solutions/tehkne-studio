import type { CommandResult, StudioCommand } from "../../command-bus/src/index.js";
import type { EngineeringSession } from "../../engineering-session/src/index.js";
import type { InventionSpatialScene } from "../../invention-spatial-runtime/src/index.js";
import {
  MECHANICAL_COMMAND_SIGNATURE,
  type MechanicalRotaryCommandResult
} from "./index.js";
import {
  mechanicalRotaryWaypointSequenceRuntimeFor,
  type InventionMechanicalRotaryWaypointSequenceRuntime,
  type MechanicalRotaryWaypointSequencePlan,
  type MechanicalRotaryWaypointSequenceRunResult
} from "./rotary-waypoint-sequence.js";

export const MECHANICAL_ROTARY_RUN_WAYPOINT_SEQUENCE_VERIFIED_COMMAND = "invention.mechanical.rotary.runWaypointSequenceVerified" as const;
const RECEIPT_EPSILON = 0.000001;

export interface MechanicalRotaryWaypointExecutionReceiptPayload {
  readonly relationshipId: string;
  readonly name: string;
}

export interface MechanicalRotaryWaypointExecutionReceiptSegment {
  readonly index: number;
  readonly positionKey: string;
  readonly positionName: string;
  readonly plannedFromContinuousRadians: number;
  readonly plannedTargetContinuousRadians: number;
  readonly plannedDeltaRadians: number;
  readonly plannedDurationSeconds: number | null;
  readonly plannedAverageAngularVelocityRadPerSec: number | null;
  readonly plannedAverageRpm: number | null;
  readonly plannedRateMode: MechanicalRotaryCommandResult["rateMode"];
  readonly movementCommandId: string;
  readonly actualBeforeContinuousRadians: number;
  readonly actualAfterContinuousRadians: number;
  readonly actualDeltaRadians: number;
  readonly actualDurationSeconds: number | null;
  readonly actualAverageAngularVelocityRadPerSec: number | null;
  readonly actualAverageRpm: number | null;
  readonly actualRateMode: MechanicalRotaryCommandResult["rateMode"];
  readonly actualMode: MechanicalRotaryCommandResult["mode"];
  readonly matched: true;
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

export interface MechanicalRotaryWaypointExecutionReceipt {
  readonly receiptCommandId: string;
  readonly sequenceRunCommandId: string;
  readonly relationshipId: string;
  readonly source: StudioCommand["source"];
  readonly sequenceKey: string;
  readonly sequenceName: string;
  readonly plannedBeforeContinuousRadians: number;
  readonly plannedAfterContinuousRadians: number;
  readonly plannedTotalDeltaRadians: number;
  readonly plannedCumulativeAbsoluteTravelRadians: number;
  readonly actualBeforeContinuousRadians: number;
  readonly actualAfterContinuousRadians: number;
  readonly actualTotalDeltaRadians: number;
  readonly actualCumulativeAbsoluteTravelRadians: number;
  readonly durationMode: MechanicalRotaryWaypointSequencePlan["durationMode"];
  readonly plannedExplicitDurationSeconds: number;
  readonly plannedTotalDurationSeconds: number | null;
  readonly stepsCompleted: number;
  readonly allSegmentsMatched: true;
  readonly segments: readonly MechanicalRotaryWaypointExecutionReceiptSegment[];
  readonly derivedFrom: "consumed-plan+movement-events";
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

export interface MechanicalRotaryWaypointVerifiedRunResult extends MechanicalRotaryWaypointSequenceRunResult {
  readonly receipt: MechanicalRotaryWaypointExecutionReceipt;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numeric(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be finite numeric evidence`);
  return value;
}

function nullableNumeric(value: unknown, label: string): number | null {
  if (value === null) return null;
  return numeric(value, label);
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be non-empty text evidence`);
  return value;
}

function sameNumber(left: number, right: number): boolean {
  return Math.abs(left - right) <= RECEIPT_EPSILON;
}

function sameNullableNumber(left: number | null, right: number | null): boolean {
  if (left === null || right === null) return left === right;
  return sameNumber(left, right);
}

function normalizeName(value: string): { readonly name: string; readonly key: string } {
  if (typeof value !== "string") throw new Error("Mechanical rotary waypoint receipt sequence name must be text");
  const name = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 64) throw new Error("Mechanical rotary waypoint receipt sequence name must contain 1 to 64 characters");
  return { name, key: name.toLowerCase() };
}

interface MovementEvidence {
  readonly commandId: string;
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

function movementEvent(type: string): boolean {
  return type === "MechanicalRotaryStepExecuted"
    || type === "MechanicalRotaryTargetExecuted"
    || type === "MechanicalRotaryContinuousTargetExecuted";
}

export class InventionMechanicalRotaryWaypointExecutionReceiptRuntime {
  #sequence: number;

  constructor(
    readonly session: EngineeringSession,
    readonly spatial: InventionSpatialScene,
    readonly sequences: InventionMechanicalRotaryWaypointSequenceRuntime = mechanicalRotaryWaypointSequenceRuntimeFor(spatial)
  ) {
    if (spatial.session !== session || sequences.session !== session || sequences.spatial !== spatial) {
      throw new Error("Rotary waypoint execution receipt runtime requires the same EngineeringSession and spatial scene as the sequence runtime");
    }
    this.#sequence = this.#restoreCommandSequence();
    this.session.commands.register(MECHANICAL_ROTARY_RUN_WAYPOINT_SEQUENCE_VERIFIED_COMMAND, (command) =>
      this.#executeVerifiedRun(command as StudioCommand<MechanicalRotaryWaypointExecutionReceiptPayload>)
    );
  }

  async runSequenceVerified(
    relationshipId: string,
    name: string,
    source: StudioCommand["source"] = "ui"
  ): Promise<CommandResult<MechanicalRotaryWaypointVerifiedRunResult>> {
    const normalized = normalizeName(name);
    return this.session.commands.dispatch<MechanicalRotaryWaypointVerifiedRunResult>({
      id: this.#nextCommandId(),
      type: MECHANICAL_ROTARY_RUN_WAYPOINT_SEQUENCE_VERIFIED_COMMAND,
      payload: { relationshipId, name: normalized.name },
      source,
      issuedAt: new Date().toISOString()
    });
  }

  lastReceipt(relationshipId: string, name?: string): MechanicalRotaryWaypointExecutionReceipt | null {
    const key = name === undefined ? null : normalizeName(name).key;
    for (const event of [...this.session.events.list()].reverse()) {
      if (event.type !== "MechanicalRotaryWaypointExecutionReceipt" || !record(event.payload)) continue;
      const receiptValue = event.payload.receipt;
      if (!record(receiptValue) || receiptValue.relationshipId !== relationshipId) continue;
      if (key !== null && receiptValue.sequenceKey !== key) continue;
      return this.#parseReceipt(receiptValue);
    }
    return null;
  }

  async #executeVerifiedRun(
    command: StudioCommand<MechanicalRotaryWaypointExecutionReceiptPayload>
  ): Promise<MechanicalRotaryWaypointVerifiedRunResult> {
    const normalized = normalizeName(command.payload.name);
    const plan = this.sequences.planSequence(command.payload.relationshipId, normalized.name);
    const run = await this.sequences.runSequence(command.payload.relationshipId, normalized.name, command.source);
    if (!run.ok || !run.result) {
      throw new Error(run.error ?? `Mechanical rotary waypoint verified run failed: ${normalized.name}`);
    }
    const receipt = this.#buildReceipt(command, plan, run.result);
    this.session.events.record({
      id: `event-${this.session.events.list().length + 1}`,
      type: "MechanicalRotaryWaypointExecutionReceipt",
      occurredAt: command.issuedAt,
      source: command.source,
      payload: { receipt }
    });
    return { ...run.result, receipt };
  }

  #movementEvidence(commandId: string): MovementEvidence {
    for (const event of this.session.events.list()) {
      if (!movementEvent(event.type) || !record(event.payload) || event.payload.commandId !== commandId) continue;
      if (event.payload.signature !== MECHANICAL_COMMAND_SIGNATURE) {
        throw new Error(`Mechanical rotary waypoint receipt movement signature mismatch: ${commandId}`);
      }
      const rateMode = text(event.payload.rateMode, "Mechanical rotary waypoint receipt rateMode");
      if (rateMode !== "segment-average" && rateMode !== "unresolved-no-duration") {
        throw new Error(`Mechanical rotary waypoint receipt invalid rate mode: ${commandId}`);
      }
      const mode = text(event.payload.mode, "Mechanical rotary waypoint receipt movement mode");
      if (mode !== "incremental" && mode !== "principal-shortest" && mode !== "continuous-absolute") {
        throw new Error(`Mechanical rotary waypoint receipt invalid movement mode: ${commandId}`);
      }
      return {
        commandId,
        beforeContinuousRadians: numeric(event.payload.beforeContinuousRadians, "Mechanical rotary waypoint receipt beforeContinuousRadians"),
        afterContinuousRadians: numeric(event.payload.afterContinuousRadians, "Mechanical rotary waypoint receipt afterContinuousRadians"),
        deltaRadians: numeric(event.payload.deltaRadians, "Mechanical rotary waypoint receipt deltaRadians"),
        durationSeconds: nullableNumeric(event.payload.durationSeconds, "Mechanical rotary waypoint receipt durationSeconds"),
        averageAngularVelocityRadPerSec: nullableNumeric(event.payload.averageAngularVelocityRadPerSec, "Mechanical rotary waypoint receipt averageAngularVelocityRadPerSec"),
        averageRpm: nullableNumeric(event.payload.averageRpm, "Mechanical rotary waypoint receipt averageRpm"),
        rateMode,
        mode,
        signature: MECHANICAL_COMMAND_SIGNATURE
      };
    }
    throw new Error(`Mechanical rotary waypoint receipt movement evidence missing: ${commandId}`);
  }

  #buildReceipt(
    command: StudioCommand<MechanicalRotaryWaypointExecutionReceiptPayload>,
    plan: MechanicalRotaryWaypointSequencePlan,
    run: MechanicalRotaryWaypointSequenceRunResult
  ): MechanicalRotaryWaypointExecutionReceipt {
    if (!plan.admissible) throw new Error(`Mechanical rotary waypoint execution receipt cannot attest a blocked plan: ${plan.sequenceName}`);
    if (run.relationshipId !== plan.relationshipId || run.sequenceKey !== plan.sequenceKey || run.stepsCompleted !== plan.segments.length
      || run.movementCommandIds.length !== plan.segments.length) {
      throw new Error(`Mechanical rotary waypoint execution receipt sequence/run mismatch: ${plan.sequenceName}`);
    }
    const segments = plan.segments.map((planned, index): MechanicalRotaryWaypointExecutionReceiptSegment => {
      const movementCommandId = run.movementCommandIds[index];
      if (!movementCommandId) throw new Error(`Mechanical rotary waypoint execution receipt movement ID missing: segment ${index}`);
      const actual = this.#movementEvidence(movementCommandId);
      const matched = sameNumber(planned.fromContinuousRadians, actual.beforeContinuousRadians)
        && sameNumber(planned.targetContinuousRadians, actual.afterContinuousRadians)
        && sameNumber(planned.deltaRadians, actual.deltaRadians)
        && sameNullableNumber(planned.durationSeconds, actual.durationSeconds)
        && sameNullableNumber(planned.averageAngularVelocityRadPerSec, actual.averageAngularVelocityRadPerSec)
        && sameNullableNumber(planned.averageRpm, actual.averageRpm)
        && planned.rateMode === actual.rateMode
        && actual.mode === "continuous-absolute";
      if (!matched) throw new Error(`Mechanical rotary waypoint execution diverged from consumed plan at segment ${index + 1}: ${planned.positionName}`);
      return {
        index,
        positionKey: planned.positionKey,
        positionName: planned.positionName,
        plannedFromContinuousRadians: planned.fromContinuousRadians,
        plannedTargetContinuousRadians: planned.targetContinuousRadians,
        plannedDeltaRadians: planned.deltaRadians,
        plannedDurationSeconds: planned.durationSeconds,
        plannedAverageAngularVelocityRadPerSec: planned.averageAngularVelocityRadPerSec,
        plannedAverageRpm: planned.averageRpm,
        plannedRateMode: planned.rateMode,
        movementCommandId,
        actualBeforeContinuousRadians: actual.beforeContinuousRadians,
        actualAfterContinuousRadians: actual.afterContinuousRadians,
        actualDeltaRadians: actual.deltaRadians,
        actualDurationSeconds: actual.durationSeconds,
        actualAverageAngularVelocityRadPerSec: actual.averageAngularVelocityRadPerSec,
        actualAverageRpm: actual.averageRpm,
        actualRateMode: actual.rateMode,
        actualMode: actual.mode,
        matched: true,
        signature: MECHANICAL_COMMAND_SIGNATURE
      };
    });
    const actualBeforeContinuousRadians = segments[0]?.actualBeforeContinuousRadians ?? run.beforeContinuousRadians;
    const actualAfterContinuousRadians = segments.at(-1)?.actualAfterContinuousRadians ?? run.afterContinuousRadians;
    const actualCumulativeAbsoluteTravelRadians = segments.reduce((sum, segment) => sum + Math.abs(segment.actualDeltaRadians), 0);
    const actualTotalDeltaRadians = actualAfterContinuousRadians - actualBeforeContinuousRadians;
    if (!sameNumber(plan.beforeContinuousRadians, actualBeforeContinuousRadians)
      || !sameNumber(plan.afterContinuousRadians, actualAfterContinuousRadians)
      || !sameNumber(plan.totalDeltaRadians, actualTotalDeltaRadians)
      || !sameNumber(plan.cumulativeAbsoluteTravelRadians, actualCumulativeAbsoluteTravelRadians)) {
      throw new Error(`Mechanical rotary waypoint execution receipt aggregate mismatch: ${plan.sequenceName}`);
    }
    return {
      receiptCommandId: command.id,
      sequenceRunCommandId: run.commandId,
      relationshipId: run.relationshipId,
      source: command.source,
      sequenceKey: run.sequenceKey,
      sequenceName: run.sequenceName,
      plannedBeforeContinuousRadians: plan.beforeContinuousRadians,
      plannedAfterContinuousRadians: plan.afterContinuousRadians,
      plannedTotalDeltaRadians: plan.totalDeltaRadians,
      plannedCumulativeAbsoluteTravelRadians: plan.cumulativeAbsoluteTravelRadians,
      actualBeforeContinuousRadians,
      actualAfterContinuousRadians,
      actualTotalDeltaRadians,
      actualCumulativeAbsoluteTravelRadians,
      durationMode: plan.durationMode,
      plannedExplicitDurationSeconds: plan.explicitDurationSeconds,
      plannedTotalDurationSeconds: plan.totalDurationSeconds,
      stepsCompleted: run.stepsCompleted,
      allSegmentsMatched: true,
      segments,
      derivedFrom: "consumed-plan+movement-events",
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
  }

  #parseReceipt(value: Record<string, unknown>): MechanicalRotaryWaypointExecutionReceipt {
    if (value.signature !== MECHANICAL_COMMAND_SIGNATURE || value.derivedFrom !== "consumed-plan+movement-events" || value.allSegmentsMatched !== true) {
      throw new Error("Mechanical rotary waypoint execution receipt integrity mismatch");
    }
    if (!Array.isArray(value.segments) || value.segments.length < 1) {
      throw new Error("Mechanical rotary waypoint execution receipt requires segment evidence");
    }
    for (const [index, segment] of value.segments.entries()) {
      if (!record(segment) || segment.signature !== MECHANICAL_COMMAND_SIGNATURE || segment.matched !== true || segment.index !== index) {
        throw new Error(`Mechanical rotary waypoint execution receipt segment integrity mismatch: ${index}`);
      }
    }
    return value as unknown as MechanicalRotaryWaypointExecutionReceipt;
  }

  #restoreCommandSequence(): number {
    let maximum = 0;
    for (const event of this.session.events.list()) {
      if (event.type !== "MechanicalRotaryWaypointExecutionReceipt" || !record(event.payload) || !record(event.payload.receipt)) continue;
      const commandId = event.payload.receipt.receiptCommandId;
      if (typeof commandId !== "string") continue;
      const match = /^mechanical-sequence-receipt-cmd-(\d+)$/.exec(commandId);
      if (match?.[1]) maximum = Math.max(maximum, Number(match[1]));
    }
    return maximum;
  }

  #nextCommandId(): string {
    this.#sequence += 1;
    return `mechanical-sequence-receipt-cmd-${this.#sequence}`;
  }
}

const runtimeCache = new WeakMap<EngineeringSession, InventionMechanicalRotaryWaypointExecutionReceiptRuntime>();

export function mechanicalRotaryWaypointExecutionReceiptRuntimeFor(
  spatial: InventionSpatialScene
): InventionMechanicalRotaryWaypointExecutionReceiptRuntime {
  const session = spatial.session;
  const existing = runtimeCache.get(session);
  if (existing) {
    if (existing.spatial !== spatial) throw new Error("Rotary waypoint execution receipt runtime already bound to another spatial scene for this session");
    return existing;
  }
  const runtime = new InventionMechanicalRotaryWaypointExecutionReceiptRuntime(session, spatial);
  runtimeCache.set(session, runtime);
  return runtime;
}
