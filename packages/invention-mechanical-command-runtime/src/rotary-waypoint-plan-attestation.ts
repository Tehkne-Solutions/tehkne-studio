import type { CommandResult, StudioCommand } from "../../command-bus/src/index.js";
import type { EngineeringSession } from "../../engineering-session/src/index.js";
import type { InventionSpatialScene } from "../../invention-spatial-runtime/src/index.js";
import { MECHANICAL_COMMAND_SIGNATURE, type MechanicalRotaryCommandResult } from "./index.js";
import {
  rotaryWaypointExecutionEvidence,
  type MechanicalRotaryWaypointExecutionEvidence
} from "./rotary-waypoint-execution-evidence.js";
import {
  mechanicalRotaryWaypointSequenceRuntimeFor,
  type InventionMechanicalRotaryWaypointSequenceRuntime,
  type MechanicalRotaryWaypointSequencePlan,
  type MechanicalRotaryWaypointSequenceRunResult
} from "./rotary-waypoint-sequence.js";

export const MECHANICAL_ROTARY_RUN_WAYPOINT_SEQUENCE_ATTESTED_COMMAND = "invention.mechanical.rotary.runWaypointSequenceAttested" as const;
const ATTESTATION_EPSILON = 0.000001;

export interface MechanicalRotaryWaypointPlanAttestationPayload {
  readonly relationshipId: string;
  readonly name: string;
}

export interface MechanicalRotaryWaypointPlanAttestationSegment {
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

export interface MechanicalRotaryWaypointPlanExecutionAttestation {
  readonly attestationCommandId: string;
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
  readonly segments: readonly MechanicalRotaryWaypointPlanAttestationSegment[];
  readonly derivedFrom: "consumed-plan+s2.32-execution-evidence";
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

export interface MechanicalRotaryWaypointAttestedRunResult extends MechanicalRotaryWaypointSequenceRunResult {
  readonly attestation: MechanicalRotaryWaypointPlanExecutionAttestation;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeName(value: string): { readonly name: string; readonly key: string } {
  if (typeof value !== "string") throw new Error("Mechanical rotary waypoint attestation sequence name must be text");
  const name = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 64) throw new Error("Mechanical rotary waypoint attestation sequence name must contain 1 to 64 characters");
  if (/\p{Cc}/u.test(name)) throw new Error("Mechanical rotary waypoint attestation sequence name cannot contain control characters");
  return { name, key: name.toLowerCase() };
}

function sameNumber(left: number, right: number): boolean {
  return Math.abs(left - right) <= ATTESTATION_EPSILON;
}

function sameNullableNumber(left: number | null, right: number | null): boolean {
  if (left === null || right === null) return left === right;
  return sameNumber(left, right);
}

export class InventionMechanicalRotaryWaypointPlanAttestationRuntime {
  #sequence: number;

  constructor(
    readonly session: EngineeringSession,
    readonly spatial: InventionSpatialScene,
    readonly sequences: InventionMechanicalRotaryWaypointSequenceRuntime = mechanicalRotaryWaypointSequenceRuntimeFor(spatial)
  ) {
    if (spatial.session !== session || sequences.session !== session || sequences.spatial !== spatial) {
      throw new Error("Rotary waypoint plan attestation runtime requires the same EngineeringSession and spatial scene as the sequence runtime");
    }
    this.#sequence = this.#restoreCommandSequence();
    this.session.commands.register(MECHANICAL_ROTARY_RUN_WAYPOINT_SEQUENCE_ATTESTED_COMMAND, (command) =>
      this.#executeAttestedRun(command as StudioCommand<MechanicalRotaryWaypointPlanAttestationPayload>)
    );
  }

  async runSequenceAttested(
    relationshipId: string,
    name: string,
    source: StudioCommand["source"] = "ui"
  ): Promise<CommandResult<MechanicalRotaryWaypointAttestedRunResult>> {
    const normalized = normalizeName(name);
    return this.session.commands.dispatch<MechanicalRotaryWaypointAttestedRunResult>({
      id: this.#nextCommandId(),
      type: MECHANICAL_ROTARY_RUN_WAYPOINT_SEQUENCE_ATTESTED_COMMAND,
      payload: { relationshipId, name: normalized.name },
      source,
      issuedAt: new Date().toISOString()
    });
  }

  attestations(relationshipId: string, name?: string): readonly MechanicalRotaryWaypointPlanExecutionAttestation[] {
    const key = name === undefined ? null : normalizeName(name).key;
    return this.session.events.list().flatMap((event) => {
      if (event.type !== "MechanicalRotaryWaypointPlanExecutionAttested" || !record(event.payload) || !record(event.payload.attestation)) return [];
      const attestation = this.#parseAttestation(event.payload.attestation);
      if (attestation.relationshipId !== relationshipId) return [];
      if (key !== null && attestation.sequenceKey !== key) return [];
      this.#assertAgainstExecutionEvidence(attestation);
      return [attestation];
    });
  }

  lastAttestation(relationshipId: string, name?: string): MechanicalRotaryWaypointPlanExecutionAttestation | null {
    return this.attestations(relationshipId, name).at(-1) ?? null;
  }

  async #executeAttestedRun(
    command: StudioCommand<MechanicalRotaryWaypointPlanAttestationPayload>
  ): Promise<MechanicalRotaryWaypointAttestedRunResult> {
    const normalized = normalizeName(command.payload.name);
    const plan = this.sequences.planSequence(command.payload.relationshipId, normalized.name);
    const run = await this.sequences.runSequence(command.payload.relationshipId, normalized.name, command.source);
    if (!run.ok || !run.result) {
      throw new Error(run.error ?? `Mechanical rotary waypoint attested run failed: ${normalized.name}`);
    }
    const execution = rotaryWaypointExecutionEvidence(this.session, command.payload.relationshipId, normalized.name)
      .find((entry) => entry.commandId === run.result!.commandId);
    if (!execution) {
      throw new Error(`Mechanical rotary waypoint S2.32 execution evidence missing after canonical RUN: ${run.result.commandId}`);
    }
    const attestation = this.#buildAttestation(command, plan, run.result, execution);
    this.session.events.record({
      id: `event-${this.session.events.list().length + 1}`,
      type: "MechanicalRotaryWaypointPlanExecutionAttested",
      occurredAt: command.issuedAt,
      source: command.source,
      payload: { attestation }
    });
    return { ...run.result, attestation };
  }

  #buildAttestation(
    command: StudioCommand<MechanicalRotaryWaypointPlanAttestationPayload>,
    plan: MechanicalRotaryWaypointSequencePlan,
    run: MechanicalRotaryWaypointSequenceRunResult,
    execution: MechanicalRotaryWaypointExecutionEvidence
  ): MechanicalRotaryWaypointPlanExecutionAttestation {
    if (!plan.admissible) throw new Error(`Mechanical rotary waypoint attestation cannot attest a blocked plan: ${plan.sequenceName}`);
    if (run.commandId !== execution.commandId || run.relationshipId !== execution.relationshipId || run.sequenceKey !== execution.sequenceKey
      || run.stepsCompleted !== execution.stepsCompleted || plan.relationshipId !== execution.relationshipId || plan.sequenceKey !== execution.sequenceKey
      || plan.segments.length !== execution.segments.length) {
      throw new Error(`Mechanical rotary waypoint plan/execution identity mismatch: ${plan.sequenceName}`);
    }

    const segments = plan.segments.map((planned, index): MechanicalRotaryWaypointPlanAttestationSegment => {
      const actual = execution.segments[index];
      if (!actual) throw new Error(`Mechanical rotary waypoint execution evidence missing segment ${index + 1}: ${plan.sequenceName}`);
      const matched = sameNumber(planned.fromContinuousRadians, actual.beforeContinuousRadians)
        && sameNumber(planned.targetContinuousRadians, actual.afterContinuousRadians)
        && sameNumber(planned.deltaRadians, actual.deltaRadians)
        && sameNullableNumber(planned.durationSeconds, actual.durationSeconds)
        && sameNullableNumber(planned.averageAngularVelocityRadPerSec, actual.averageAngularVelocityRadPerSec)
        && sameNullableNumber(planned.averageRpm, actual.averageRpm)
        && planned.rateMode === actual.rateMode
        && actual.mode === "continuous-absolute";
      if (!matched) throw new Error(`Mechanical rotary waypoint plan/execution divergence at segment ${index + 1}: ${planned.positionName}`);
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
        movementCommandId: actual.movementCommandId,
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

    if (!sameNumber(plan.beforeContinuousRadians, execution.beforeContinuousRadians)
      || !sameNumber(plan.afterContinuousRadians, execution.afterContinuousRadians)
      || !sameNumber(plan.totalDeltaRadians, execution.totalDeltaRadians)
      || !sameNumber(plan.cumulativeAbsoluteTravelRadians, execution.cumulativeAbsoluteTravelRadians)) {
      throw new Error(`Mechanical rotary waypoint plan/execution aggregate mismatch: ${plan.sequenceName}`);
    }

    return {
      attestationCommandId: command.id,
      sequenceRunCommandId: run.commandId,
      relationshipId: execution.relationshipId,
      source: command.source,
      sequenceKey: execution.sequenceKey,
      sequenceName: execution.sequenceName,
      plannedBeforeContinuousRadians: plan.beforeContinuousRadians,
      plannedAfterContinuousRadians: plan.afterContinuousRadians,
      plannedTotalDeltaRadians: plan.totalDeltaRadians,
      plannedCumulativeAbsoluteTravelRadians: plan.cumulativeAbsoluteTravelRadians,
      actualBeforeContinuousRadians: execution.beforeContinuousRadians,
      actualAfterContinuousRadians: execution.afterContinuousRadians,
      actualTotalDeltaRadians: execution.totalDeltaRadians,
      actualCumulativeAbsoluteTravelRadians: execution.cumulativeAbsoluteTravelRadians,
      durationMode: plan.durationMode,
      plannedExplicitDurationSeconds: plan.explicitDurationSeconds,
      plannedTotalDurationSeconds: plan.totalDurationSeconds,
      stepsCompleted: execution.stepsCompleted,
      allSegmentsMatched: true,
      segments,
      derivedFrom: "consumed-plan+s2.32-execution-evidence",
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
  }

  #parseAttestation(value: Record<string, unknown>): MechanicalRotaryWaypointPlanExecutionAttestation {
    if (value.signature !== MECHANICAL_COMMAND_SIGNATURE
      || value.derivedFrom !== "consumed-plan+s2.32-execution-evidence"
      || value.allSegmentsMatched !== true
      || typeof value.attestationCommandId !== "string"
      || typeof value.sequenceRunCommandId !== "string"
      || typeof value.relationshipId !== "string"
      || typeof value.sequenceKey !== "string"
      || typeof value.sequenceName !== "string") {
      throw new Error("Mechanical rotary waypoint plan execution attestation integrity mismatch");
    }
    if (!Array.isArray(value.segments) || value.segments.length < 1) {
      throw new Error("Mechanical rotary waypoint plan execution attestation requires segment evidence");
    }
    for (const [index, segment] of value.segments.entries()) {
      if (!record(segment) || segment.signature !== MECHANICAL_COMMAND_SIGNATURE || segment.matched !== true || segment.index !== index) {
        throw new Error(`Mechanical rotary waypoint plan execution attestation segment integrity mismatch: ${index}`);
      }
    }
    return value as unknown as MechanicalRotaryWaypointPlanExecutionAttestation;
  }

  #assertAgainstExecutionEvidence(attestation: MechanicalRotaryWaypointPlanExecutionAttestation): void {
    const execution = rotaryWaypointExecutionEvidence(this.session, attestation.relationshipId, attestation.sequenceName)
      .find((entry) => entry.commandId === attestation.sequenceRunCommandId);
    if (!execution) throw new Error(`Mechanical rotary waypoint attestation canonical execution evidence missing: ${attestation.sequenceRunCommandId}`);
    if (execution.segments.length !== attestation.segments.length
      || !sameNumber(execution.beforeContinuousRadians, attestation.actualBeforeContinuousRadians)
      || !sameNumber(execution.afterContinuousRadians, attestation.actualAfterContinuousRadians)
      || !sameNumber(execution.totalDeltaRadians, attestation.actualTotalDeltaRadians)
      || !sameNumber(execution.cumulativeAbsoluteTravelRadians, attestation.actualCumulativeAbsoluteTravelRadians)) {
      throw new Error(`Mechanical rotary waypoint attestation no longer matches S2.32 execution evidence: ${attestation.sequenceRunCommandId}`);
    }
    for (const [index, segment] of attestation.segments.entries()) {
      const actual = execution.segments[index];
      if (!actual || actual.movementCommandId !== segment.movementCommandId
        || !sameNumber(actual.beforeContinuousRadians, segment.actualBeforeContinuousRadians)
        || !sameNumber(actual.afterContinuousRadians, segment.actualAfterContinuousRadians)
        || !sameNumber(actual.deltaRadians, segment.actualDeltaRadians)
        || !sameNullableNumber(actual.durationSeconds, segment.actualDurationSeconds)
        || !sameNullableNumber(actual.averageRpm, segment.actualAverageRpm)
        || actual.rateMode !== segment.actualRateMode || actual.mode !== segment.actualMode) {
        throw new Error(`Mechanical rotary waypoint attestation segment no longer matches S2.32 evidence: ${index}`);
      }
    }
  }

  #restoreCommandSequence(): number {
    let maximum = 0;
    for (const event of this.session.events.list()) {
      if (event.type !== "MechanicalRotaryWaypointPlanExecutionAttested" || !record(event.payload) || !record(event.payload.attestation)) continue;
      const commandId = event.payload.attestation.attestationCommandId;
      if (typeof commandId !== "string") continue;
      const match = /^mechanical-sequence-attestation-cmd-(\d+)$/.exec(commandId);
      if (match?.[1]) maximum = Math.max(maximum, Number(match[1]));
    }
    return maximum;
  }

  #nextCommandId(): string {
    this.#sequence += 1;
    return `mechanical-sequence-attestation-cmd-${this.#sequence}`;
  }
}

const runtimeCache = new WeakMap<EngineeringSession, InventionMechanicalRotaryWaypointPlanAttestationRuntime>();

export function mechanicalRotaryWaypointPlanAttestationRuntimeFor(
  spatial: InventionSpatialScene
): InventionMechanicalRotaryWaypointPlanAttestationRuntime {
  const session = spatial.session;
  const existing = runtimeCache.get(session);
  if (existing) {
    if (existing.spatial !== spatial) throw new Error("Rotary waypoint plan attestation runtime already bound to another spatial scene for this session");
    return existing;
  }
  const runtime = new InventionMechanicalRotaryWaypointPlanAttestationRuntime(session, spatial);
  runtimeCache.set(session, runtime);
  return runtime;
}
