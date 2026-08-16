import type { CommandResult, StudioCommand } from "../../command-bus/src/index.js";
import type { EngineeringRelationship } from "../../engineering-graph/src/index.js";
import type { EngineeringSession } from "../../engineering-session/src/index.js";
import { ROTARY_CONTINUOUS_EPSILON } from "../../invention-assembly-runtime/src/rotary-continuous-angle.js";
import type { InventionSpatialScene } from "../../invention-spatial-runtime/src/index.js";
import {
  MECHANICAL_COMMAND_SIGNATURE,
  deriveRotarySegmentRate,
  mechanicalCommandRuntimeFor,
  validateRotaryDurationSeconds,
  type InventionMechanicalCommandRuntime,
  type MechanicalRotaryCommandResult
} from "./index.js";
import {
  mechanicalRotaryNamedPositionsRuntimeFor,
  type InventionMechanicalRotaryNamedPositionsRuntime,
  type MechanicalRotaryNamedPosition
} from "./rotary-named-positions.js";

export const MECHANICAL_ROTARY_SAVE_WAYPOINT_SEQUENCE_COMMAND = "invention.mechanical.rotary.saveWaypointSequence" as const;
export const MECHANICAL_ROTARY_RUN_WAYPOINT_SEQUENCE_COMMAND = "invention.mechanical.rotary.runWaypointSequence" as const;
export const MECHANICAL_ROTARY_DELETE_WAYPOINT_SEQUENCE_COMMAND = "invention.mechanical.rotary.deleteWaypointSequence" as const;

const MAX_WAYPOINTS = 32;

export interface MechanicalRotaryWaypointSequenceInputStep {
  readonly positionName: string;
  readonly durationSeconds?: number;
}

export interface MechanicalRotarySaveWaypointSequencePayload {
  readonly relationshipId: string;
  readonly name: string;
  readonly steps: readonly MechanicalRotaryWaypointSequenceInputStep[];
}

export interface MechanicalRotaryWaypointSequencePayload {
  readonly relationshipId: string;
  readonly name: string;
}

export interface MechanicalRotaryWaypointSequenceStep {
  readonly positionKey: string;
  readonly positionName: string;
  readonly durationSeconds: number | null;
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

export interface MechanicalRotaryWaypointSequence {
  readonly key: string;
  readonly name: string;
  readonly steps: readonly MechanicalRotaryWaypointSequenceStep[];
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

export interface MechanicalRotaryWaypointSequencesDocument {
  readonly version: 1;
  readonly sequences: readonly MechanicalRotaryWaypointSequence[];
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

export interface MechanicalRotaryWaypointSequenceAuthoringResult {
  readonly commandId: string;
  readonly relationshipId: string;
  readonly source: StudioCommand["source"];
  readonly action: "created" | "updated" | "deleted";
  readonly previous: MechanicalRotaryWaypointSequence | null;
  readonly current: MechanicalRotaryWaypointSequence | null;
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

export interface MechanicalRotaryWaypointPlanSegment {
  readonly index: number;
  readonly positionKey: string;
  readonly positionName: string;
  readonly fromContinuousRadians: number;
  readonly targetContinuousRadians: number;
  readonly deltaRadians: number;
  readonly durationSeconds: number | null;
  readonly averageAngularVelocityRadPerSec: number | null;
  readonly averageRpm: number | null;
  readonly rateMode: MechanicalRotaryCommandResult["rateMode"];
  readonly withinTravelLimits: boolean;
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

export interface MechanicalRotaryWaypointSequencePlan {
  readonly relationshipId: string;
  readonly sequenceKey: string;
  readonly sequenceName: string;
  readonly beforeContinuousRadians: number;
  readonly afterContinuousRadians: number;
  readonly totalDeltaRadians: number;
  readonly cumulativeAbsoluteTravelRadians: number;
  readonly timedSteps: number;
  readonly untimedSteps: number;
  readonly explicitDurationSeconds: number;
  readonly totalDurationSeconds: number | null;
  readonly durationMode: "complete-explicit" | "partial-explicit" | "unresolved-no-duration";
  readonly travelLimitsActive: boolean;
  readonly admissible: boolean;
  readonly segments: readonly MechanicalRotaryWaypointPlanSegment[];
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

export interface MechanicalRotaryWaypointSequenceRunResult {
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
  readonly finalMovementCommandId: string;
  readonly finalRateMode: MechanicalRotaryCommandResult["rateMode"];
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numeric(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be finite numeric evidence`);
  return value;
}

function normalizeName(value: string, label: string): { readonly name: string; readonly key: string } {
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  const name = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 64) throw new Error(`${label} must contain 1 to 64 characters`);
  if (/\p{Cc}/u.test(name)) throw new Error(`${label} cannot contain control characters`);
  return { name, key: name.toLowerCase() };
}

function durationFromEvidence(value: unknown, label: string): number | null {
  if (value === null || value === undefined) return null;
  return validateRotaryDurationSeconds(numeric(value, label));
}

function sequencesFromRelationship(relationship: EngineeringRelationship): MechanicalRotaryWaypointSequencesDocument | null {
  const value = relationship.metadata.rotaryWaypointSequences;
  if (value === undefined) return null;
  if (!record(value)) throw new Error(`Mechanical rotary waypoint sequences metadata must be an object: ${relationship.id}`);
  if (value.version !== 1) throw new Error(`Mechanical rotary waypoint sequences version mismatch: ${relationship.id}`);
  if (value.signature !== MECHANICAL_COMMAND_SIGNATURE) {
    throw new Error(`Mechanical rotary waypoint sequences signature mismatch: ${relationship.id}`);
  }
  if (!Array.isArray(value.sequences)) throw new Error(`Mechanical rotary waypoint sequences must be an array: ${relationship.id}`);

  const keys = new Set<string>();
  const sequences = value.sequences.map((entry, sequenceIndex): MechanicalRotaryWaypointSequence => {
    if (!record(entry)) throw new Error(`Mechanical rotary waypoint sequence ${sequenceIndex} must be an object: ${relationship.id}`);
    if (typeof entry.name !== "string" || typeof entry.key !== "string") {
      throw new Error(`Mechanical rotary waypoint sequence ${sequenceIndex} requires name and key: ${relationship.id}`);
    }
    const normalized = normalizeName(entry.name, "Mechanical rotary waypoint sequence name");
    if (entry.key !== normalized.key) throw new Error(`Mechanical rotary waypoint sequence key mismatch: ${relationship.id}`);
    if (keys.has(entry.key)) throw new Error(`Mechanical rotary waypoint sequence duplicate key: ${entry.key}`);
    keys.add(entry.key);
    if (entry.signature !== MECHANICAL_COMMAND_SIGNATURE) {
      throw new Error(`Mechanical rotary waypoint sequence signature mismatch: ${relationship.id}`);
    }
    if (!Array.isArray(entry.steps) || entry.steps.length < 1 || entry.steps.length > MAX_WAYPOINTS) {
      throw new Error(`Mechanical rotary waypoint sequence requires 1 to ${MAX_WAYPOINTS} steps: ${relationship.id}`);
    }
    const steps = entry.steps.map((step, stepIndex): MechanicalRotaryWaypointSequenceStep => {
      if (!record(step)) throw new Error(`Mechanical rotary waypoint step ${stepIndex} must be an object: ${relationship.id}`);
      if (typeof step.positionName !== "string" || typeof step.positionKey !== "string") {
        throw new Error(`Mechanical rotary waypoint step ${stepIndex} requires position name and key: ${relationship.id}`);
      }
      const position = normalizeName(step.positionName, "Mechanical rotary waypoint position name");
      if (step.positionKey !== position.key) throw new Error(`Mechanical rotary waypoint position key mismatch: ${relationship.id}`);
      if (step.signature !== MECHANICAL_COMMAND_SIGNATURE) {
        throw new Error(`Mechanical rotary waypoint step signature mismatch: ${relationship.id}`);
      }
      return {
        positionKey: step.positionKey,
        positionName: position.name,
        durationSeconds: durationFromEvidence(step.durationSeconds, "Mechanical rotary waypoint durationSeconds"),
        signature: MECHANICAL_COMMAND_SIGNATURE
      };
    });
    return {
      key: entry.key,
      name: normalized.name,
      steps,
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
  });

  return { version: 1, sequences, signature: MECHANICAL_COMMAND_SIGNATURE };
}

interface ResolvedWaypoint {
  readonly step: MechanicalRotaryWaypointSequenceStep;
  readonly position: MechanicalRotaryNamedPosition;
}

export class InventionMechanicalRotaryWaypointSequenceRuntime {
  #sequence: number;

  constructor(
    readonly session: EngineeringSession,
    readonly spatial: InventionSpatialScene,
    readonly mechanical: InventionMechanicalCommandRuntime = mechanicalCommandRuntimeFor(spatial),
    readonly namedPositions: InventionMechanicalRotaryNamedPositionsRuntime = mechanicalRotaryNamedPositionsRuntimeFor(spatial)
  ) {
    if (spatial.session !== session || mechanical.session !== session || mechanical.spatial !== spatial
      || namedPositions.session !== session || namedPositions.spatial !== spatial) {
      throw new Error("Rotary waypoint sequence runtime requires the same EngineeringSession and spatial scene as its mechanical runtimes");
    }
    this.#sequence = this.#restoreCommandSequence();
    this.session.commands.register(MECHANICAL_ROTARY_SAVE_WAYPOINT_SEQUENCE_COMMAND, (command) =>
      this.#executeSave(command as StudioCommand<MechanicalRotarySaveWaypointSequencePayload>)
    );
    this.session.commands.register(MECHANICAL_ROTARY_RUN_WAYPOINT_SEQUENCE_COMMAND, (command) =>
      this.#executeRun(command as StudioCommand<MechanicalRotaryWaypointSequencePayload>)
    );
    this.session.commands.register(MECHANICAL_ROTARY_DELETE_WAYPOINT_SEQUENCE_COMMAND, (command) =>
      this.#executeDelete(command as StudioCommand<MechanicalRotaryWaypointSequencePayload>)
    );
  }

  async saveSequence(
    relationshipId: string,
    name: string,
    steps: readonly MechanicalRotaryWaypointSequenceInputStep[],
    source: StudioCommand["source"] = "ui"
  ): Promise<CommandResult<MechanicalRotaryWaypointSequenceAuthoringResult>> {
    const normalized = normalizeName(name, "Mechanical rotary waypoint sequence name");
    if (!Array.isArray(steps) || steps.length < 1 || steps.length > MAX_WAYPOINTS) {
      throw new Error(`Mechanical rotary waypoint sequence requires 1 to ${MAX_WAYPOINTS} steps`);
    }
    const payloadSteps = steps.map((step) => {
      const position = normalizeName(step.positionName, "Mechanical rotary waypoint position name");
      return step.durationSeconds === undefined
        ? { positionName: position.name }
        : { positionName: position.name, durationSeconds: validateRotaryDurationSeconds(step.durationSeconds) };
    });
    return this.session.commands.dispatch<MechanicalRotaryWaypointSequenceAuthoringResult>({
      id: this.#nextCommandId(),
      type: MECHANICAL_ROTARY_SAVE_WAYPOINT_SEQUENCE_COMMAND,
      payload: { relationshipId, name: normalized.name, steps: payloadSteps },
      source,
      issuedAt: new Date().toISOString()
    });
  }

  async runSequence(
    relationshipId: string,
    name: string,
    source: StudioCommand["source"] = "ui"
  ): Promise<CommandResult<MechanicalRotaryWaypointSequenceRunResult>> {
    const normalized = normalizeName(name, "Mechanical rotary waypoint sequence name");
    return this.session.commands.dispatch<MechanicalRotaryWaypointSequenceRunResult>({
      id: this.#nextCommandId(),
      type: MECHANICAL_ROTARY_RUN_WAYPOINT_SEQUENCE_COMMAND,
      payload: { relationshipId, name: normalized.name },
      source,
      issuedAt: new Date().toISOString()
    });
  }

  async deleteSequence(
    relationshipId: string,
    name: string,
    source: StudioCommand["source"] = "ui"
  ): Promise<CommandResult<MechanicalRotaryWaypointSequenceAuthoringResult>> {
    const normalized = normalizeName(name, "Mechanical rotary waypoint sequence name");
    return this.session.commands.dispatch<MechanicalRotaryWaypointSequenceAuthoringResult>({
      id: this.#nextCommandId(),
      type: MECHANICAL_ROTARY_DELETE_WAYPOINT_SEQUENCE_COMMAND,
      payload: { relationshipId, name: normalized.name },
      source,
      issuedAt: new Date().toISOString()
    });
  }

  sequences(relationshipId: string): readonly MechanicalRotaryWaypointSequence[] {
    return sequencesFromRelationship(this.#resolveRelationship(relationshipId))?.sequences ?? [];
  }

  sequence(relationshipId: string, name: string): MechanicalRotaryWaypointSequence | null {
    const normalized = normalizeName(name, "Mechanical rotary waypoint sequence name");
    return this.sequences(relationshipId).find((entry) => entry.key === normalized.key) ?? null;
  }

  planSequence(relationshipId: string, name: string): MechanicalRotaryWaypointSequencePlan {
    const normalized = normalizeName(name, "Mechanical rotary waypoint sequence name");
    const sequence = this.sequence(relationshipId, normalized.name);
    if (!sequence) throw new Error(`Mechanical rotary waypoint sequence is not authored: ${normalized.name}`);
    const resolved = this.#resolveWaypoints(relationshipId, sequence);
    const beforeContinuousRadians = this.mechanical.kinematics(relationshipId).continuousRadians;
    return this.#buildPlan(relationshipId, sequence, resolved, beforeContinuousRadians);
  }

  #resolveRelationship(relationshipId: string): EngineeringRelationship {
    this.mechanical.kinematics(relationshipId);
    const relationship = this.session.graph.snapshot().relationships.find((entry) => entry.id === relationshipId);
    if (!relationship) throw new Error(`Mechanical rotary waypoint sequence relationship not found: ${relationshipId}`);
    return relationship;
  }

  #resolveWaypoints(relationshipId: string, sequence: MechanicalRotaryWaypointSequence): readonly ResolvedWaypoint[] {
    return sequence.steps.map((step) => {
      const position = this.namedPositions.position(relationshipId, step.positionName);
      if (!position || position.key !== step.positionKey) {
        throw new Error(`Mechanical rotary waypoint position is not authored: ${step.positionName}`);
      }
      return { step, position };
    });
  }

  #buildPlan(
    relationshipId: string,
    sequence: MechanicalRotaryWaypointSequence,
    resolved: readonly ResolvedWaypoint[],
    beforeContinuousRadians: number
  ): MechanicalRotaryWaypointSequencePlan {
    const limits = this.mechanical.travelLimits(relationshipId);
    let cursor = beforeContinuousRadians;
    let explicitDurationSeconds = 0;
    let timedSteps = 0;
    let cumulativeAbsoluteTravelRadians = 0;
    const segments = resolved.map((entry, index): MechanicalRotaryWaypointPlanSegment => {
      const targetContinuousRadians = entry.position.continuousRadians;
      const deltaRadians = targetContinuousRadians - cursor;
      const durationSeconds = entry.step.durationSeconds;
      const rate = durationSeconds === null ? null : deriveRotarySegmentRate(deltaRadians, durationSeconds);
      const withinTravelLimits = !limits
        || (targetContinuousRadians >= limits.minContinuousRadians - ROTARY_CONTINUOUS_EPSILON
          && targetContinuousRadians <= limits.maxContinuousRadians + ROTARY_CONTINUOUS_EPSILON);
      if (durationSeconds !== null) {
        timedSteps += 1;
        explicitDurationSeconds += durationSeconds;
      }
      cumulativeAbsoluteTravelRadians += Math.abs(deltaRadians);
      const segment: MechanicalRotaryWaypointPlanSegment = {
        index,
        positionKey: entry.position.key,
        positionName: entry.position.name,
        fromContinuousRadians: cursor,
        targetContinuousRadians,
        deltaRadians,
        durationSeconds,
        averageAngularVelocityRadPerSec: rate?.averageAngularVelocityRadPerSec ?? null,
        averageRpm: rate?.averageRpm ?? null,
        rateMode: rate?.mode ?? "unresolved-no-duration",
        withinTravelLimits,
        signature: MECHANICAL_COMMAND_SIGNATURE
      };
      cursor = targetContinuousRadians;
      return segment;
    });
    const untimedSteps = segments.length - timedSteps;
    const durationMode = untimedSteps === 0
      ? "complete-explicit"
      : timedSteps === 0
        ? "unresolved-no-duration"
        : "partial-explicit";
    return {
      relationshipId,
      sequenceKey: sequence.key,
      sequenceName: sequence.name,
      beforeContinuousRadians,
      afterContinuousRadians: cursor,
      totalDeltaRadians: cursor - beforeContinuousRadians,
      cumulativeAbsoluteTravelRadians,
      timedSteps,
      untimedSteps,
      explicitDurationSeconds,
      totalDurationSeconds: untimedSteps === 0 ? explicitDurationSeconds : null,
      durationMode,
      travelLimitsActive: limits !== null,
      admissible: segments.every((entry) => entry.withinTravelLimits),
      segments,
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
  }

  #assertPlanAdmissible(plan: MechanicalRotaryWaypointSequencePlan): void {
    const blocked = plan.segments.find((entry) => !entry.withinTravelLimits);
    if (!blocked) return;
    const limits = this.mechanical.travelLimits(plan.relationshipId);
    if (!limits) throw new Error(`Mechanical rotary waypoint sequence plan became inconsistent: ${plan.relationshipId}`);
    throw new Error(
      `Mechanical rotary waypoint sequence travel limit exceeded: ${plan.relationshipId} `
      + `${blocked.positionName}=${blocked.targetContinuousRadians} range=[${limits.minContinuousRadians}, ${limits.maxContinuousRadians}]`
    );
  }

  #executeSave(command: StudioCommand<MechanicalRotarySaveWaypointSequencePayload>): MechanicalRotaryWaypointSequenceAuthoringResult {
    const normalized = normalizeName(command.payload.name, "Mechanical rotary waypoint sequence name");
    if (!Array.isArray(command.payload.steps) || command.payload.steps.length < 1 || command.payload.steps.length > MAX_WAYPOINTS) {
      throw new Error(`Mechanical rotary waypoint sequence requires 1 to ${MAX_WAYPOINTS} steps`);
    }
    const relationship = this.#resolveRelationship(command.payload.relationshipId);
    const document = sequencesFromRelationship(relationship);
    const previous = document?.sequences.find((entry) => entry.key === normalized.key) ?? null;
    const steps = command.payload.steps.map((input): MechanicalRotaryWaypointSequenceStep => {
      const positionName = normalizeName(input.positionName, "Mechanical rotary waypoint position name");
      const position = this.namedPositions.position(command.payload.relationshipId, positionName.name);
      if (!position) throw new Error(`Mechanical rotary waypoint position is not authored: ${positionName.name}`);
      return {
        positionKey: position.key,
        positionName: position.name,
        durationSeconds: input.durationSeconds === undefined ? null : validateRotaryDurationSeconds(input.durationSeconds),
        signature: MECHANICAL_COMMAND_SIGNATURE
      };
    });
    const current: MechanicalRotaryWaypointSequence = {
      key: normalized.key,
      name: normalized.name,
      steps,
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
    const sequences = [...(document?.sequences ?? [])];
    const previousIndex = sequences.findIndex((entry) => entry.key === normalized.key);
    if (previousIndex >= 0) sequences[previousIndex] = current;
    else sequences.push(current);
    this.session.graph.replaceRelationship({
      ...relationship,
      metadata: {
        ...relationship.metadata,
        rotaryWaypointSequences: {
          version: 1,
          sequences,
          signature: MECHANICAL_COMMAND_SIGNATURE
        } satisfies MechanicalRotaryWaypointSequencesDocument
      }
    });
    const result: MechanicalRotaryWaypointSequenceAuthoringResult = {
      commandId: command.id,
      relationshipId: command.payload.relationshipId,
      source: command.source,
      action: previous ? "updated" : "created",
      previous,
      current,
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
    this.#recordAuthoringEvidence(command, result);
    return result;
  }

  async #executeRun(command: StudioCommand<MechanicalRotaryWaypointSequencePayload>): Promise<MechanicalRotaryWaypointSequenceRunResult> {
    const normalized = normalizeName(command.payload.name, "Mechanical rotary waypoint sequence name");
    const sequence = this.sequence(command.payload.relationshipId, normalized.name);
    if (!sequence) throw new Error(`Mechanical rotary waypoint sequence is not authored: ${normalized.name}`);
    const resolved = this.#resolveWaypoints(command.payload.relationshipId, sequence);
    const beforeContinuousRadians = this.mechanical.kinematics(command.payload.relationshipId).continuousRadians;
    const plan = this.#buildPlan(command.payload.relationshipId, sequence, resolved, beforeContinuousRadians);
    this.#assertPlanAdmissible(plan);

    const movementResults: MechanicalRotaryCommandResult[] = [];
    for (const waypoint of resolved) {
      const movement = await this.mechanical.setContinuousTarget(
        command.payload.relationshipId,
        waypoint.position.continuousRadians,
        command.source,
        waypoint.step.durationSeconds ?? undefined
      );
      if (!movement.ok || !movement.result) {
        throw new Error(movement.error ?? `Mechanical rotary waypoint movement failed: ${waypoint.position.name}`);
      }
      movementResults.push(movement.result);
    }
    const finalMovement = movementResults.at(-1);
    if (!finalMovement) throw new Error(`Mechanical rotary waypoint sequence executed no movements: ${normalized.name}`);
    const afterContinuousRadians = finalMovement.afterContinuousRadians;
    const result: MechanicalRotaryWaypointSequenceRunResult = {
      commandId: command.id,
      relationshipId: command.payload.relationshipId,
      source: command.source,
      sequenceKey: sequence.key,
      sequenceName: sequence.name,
      stepsCompleted: movementResults.length,
      movementCommandIds: movementResults.map((entry) => entry.commandId),
      beforeContinuousRadians,
      afterContinuousRadians,
      totalDeltaRadians: afterContinuousRadians - beforeContinuousRadians,
      finalMovementCommandId: finalMovement.commandId,
      finalRateMode: finalMovement.rateMode,
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
    this.session.events.record({
      id: `event-${this.session.events.list().length + 1}`,
      type: "MechanicalRotaryWaypointSequenceRequested",
      occurredAt: command.issuedAt,
      source: command.source,
      payload: {
        commandId: result.commandId,
        relationshipId: result.relationshipId,
        sequenceKey: result.sequenceKey,
        sequenceName: result.sequenceName,
        stepsCompleted: result.stepsCompleted,
        movementCommandIds: result.movementCommandIds,
        beforeContinuousRadians: result.beforeContinuousRadians,
        afterContinuousRadians: result.afterContinuousRadians,
        totalDeltaRadians: result.totalDeltaRadians,
        finalMovementCommandId: result.finalMovementCommandId,
        finalRateMode: result.finalRateMode,
        signature: result.signature
      }
    });
    return result;
  }

  #executeDelete(command: StudioCommand<MechanicalRotaryWaypointSequencePayload>): MechanicalRotaryWaypointSequenceAuthoringResult {
    const normalized = normalizeName(command.payload.name, "Mechanical rotary waypoint sequence name");
    const relationship = this.#resolveRelationship(command.payload.relationshipId);
    const document = sequencesFromRelationship(relationship);
    const previous = document?.sequences.find((entry) => entry.key === normalized.key) ?? null;
    if (!previous) throw new Error(`Mechanical rotary waypoint sequence is not authored: ${normalized.name}`);
    const sequences = document!.sequences.filter((entry) => entry.key !== normalized.key);
    const metadata: Record<string, unknown> = { ...relationship.metadata };
    if (sequences.length === 0) delete metadata.rotaryWaypointSequences;
    else {
      metadata.rotaryWaypointSequences = {
        version: 1,
        sequences,
        signature: MECHANICAL_COMMAND_SIGNATURE
      } satisfies MechanicalRotaryWaypointSequencesDocument;
    }
    this.session.graph.replaceRelationship({ ...relationship, metadata });
    const result: MechanicalRotaryWaypointSequenceAuthoringResult = {
      commandId: command.id,
      relationshipId: command.payload.relationshipId,
      source: command.source,
      action: "deleted",
      previous,
      current: null,
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
    this.#recordAuthoringEvidence(command, result);
    return result;
  }

  #recordAuthoringEvidence(
    command: StudioCommand<MechanicalRotarySaveWaypointSequencePayload | MechanicalRotaryWaypointSequencePayload>,
    result: MechanicalRotaryWaypointSequenceAuthoringResult
  ): void {
    this.session.events.record({
      id: `event-${this.session.events.list().length + 1}`,
      type: result.action === "deleted" ? "MechanicalRotaryWaypointSequenceDeleted" : "MechanicalRotaryWaypointSequenceSaved",
      occurredAt: command.issuedAt,
      source: command.source,
      payload: {
        commandId: result.commandId,
        relationshipId: result.relationshipId,
        action: result.action,
        previous: result.previous,
        current: result.current,
        signature: result.signature
      }
    });
  }

  #restoreCommandSequence(): number {
    let maximum = 0;
    for (const event of this.session.events.list()) {
      if (!record(event.payload)) continue;
      const commandId = event.payload.commandId;
      if (typeof commandId !== "string") continue;
      const match = /^mechanical-sequence-cmd-(\d+)$/.exec(commandId);
      if (match?.[1]) maximum = Math.max(maximum, Number(match[1]));
    }
    return maximum;
  }

  #nextCommandId(): string {
    this.#sequence += 1;
    return `mechanical-sequence-cmd-${this.#sequence}`;
  }
}

const runtimeCache = new WeakMap<EngineeringSession, InventionMechanicalRotaryWaypointSequenceRuntime>();

export function mechanicalRotaryWaypointSequenceRuntimeFor(spatial: InventionSpatialScene): InventionMechanicalRotaryWaypointSequenceRuntime {
  const session = spatial.session;
  const existing = runtimeCache.get(session);
  if (existing) {
    if (existing.spatial !== spatial) throw new Error("Rotary waypoint sequence runtime already bound to another spatial scene for this session");
    return existing;
  }
  const runtime = new InventionMechanicalRotaryWaypointSequenceRuntime(session, spatial);
  runtimeCache.set(session, runtime);
  return runtime;
}
