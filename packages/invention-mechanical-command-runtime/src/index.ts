import type { CommandResult, StudioCommand } from "../../command-bus/src/index.js";
import type { EngineeringRelationship } from "../../engineering-graph/src/index.js";
import type { EngineeringSession } from "../../engineering-session/src/index.js";
import {
  deriveMechanicalAxialConstraints,
  planMechanicalRotaryJointStep,
  type MechanicalAxialConstraint
} from "../../invention-assembly-runtime/src/index.js";
import {
  advanceRotaryContinuousState,
  ROTARY_CONTINUOUS_EPSILON,
  rotaryContinuousState,
  rotaryContinuousTargetDelta,
  type RotaryContinuousState
} from "../../invention-assembly-runtime/src/rotary-continuous-angle.js";
import {
  rotaryJointRelativeAngle,
  rotaryJointTargetDelta
} from "../../invention-assembly-runtime/src/rotary-relative-angle.js";
import type { InventionSpatialScene } from "../../invention-spatial-runtime/src/index.js";
import { mechanicalPortLocalPosition, mechanicalPortWorldPosition } from "./port-geometry.js";
import {
  deriveRotarySegmentRate,
  validateRotaryDurationSeconds,
  type RotarySegmentRateEvidence
} from "./rotary-segment-rate.js";

export {
  ROTARY_SEGMENT_RATE_SIGNATURE,
  deriveRotarySegmentRate,
  validateRotaryDurationSeconds,
  type RotarySegmentRateEvidence
} from "./rotary-segment-rate.js";

export const MECHANICAL_ROTARY_STEP_COMMAND = "invention.mechanical.rotary.step" as const;
export const MECHANICAL_ROTARY_TARGET_COMMAND = "invention.mechanical.rotary.setTarget" as const;
export const MECHANICAL_ROTARY_CONTINUOUS_TARGET_COMMAND = "invention.mechanical.rotary.setContinuousTarget" as const;
export const MECHANICAL_ROTARY_SET_TRAVEL_LIMITS_COMMAND = "invention.mechanical.rotary.setTravelLimits" as const;
export const MECHANICAL_ROTARY_CLEAR_TRAVEL_LIMITS_COMMAND = "invention.mechanical.rotary.clearTravelLimits" as const;
export const MECHANICAL_COMMAND_SIGNATURE = "Tehkné Solutions" as const;

export interface MechanicalRotaryStepPayload {
  readonly relationshipId: string;
  readonly radians: number;
  readonly durationSeconds?: number;
}

export interface MechanicalRotaryTargetPayload {
  readonly relationshipId: string;
  readonly targetRadians: number;
  readonly durationSeconds?: number;
}

export interface MechanicalRotaryContinuousTargetPayload {
  readonly relationshipId: string;
  readonly targetContinuousRadians: number;
  readonly durationSeconds?: number;
}

export interface MechanicalRotaryTravelLimitsPayload {
  readonly relationshipId: string;
  readonly minContinuousRadians: number;
  readonly maxContinuousRadians: number;
}

export interface MechanicalRotaryClearTravelLimitsPayload {
  readonly relationshipId: string;
}

export interface MechanicalRotaryTravelLimits {
  readonly mode: "continuous";
  readonly minContinuousRadians: number;
  readonly maxContinuousRadians: number;
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

export interface MechanicalRotaryTravelLimitsResult {
  readonly commandId: string;
  readonly relationshipId: string;
  readonly source: StudioCommand["source"];
  readonly action: "set" | "clear";
  readonly previous: MechanicalRotaryTravelLimits | null;
  readonly current: MechanicalRotaryTravelLimits | null;
  readonly currentContinuousRadians: number;
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

export interface MechanicalRotaryKinematics extends RotaryContinuousState {
  readonly relationshipId: string;
  readonly evidenceCommands: number;
  readonly derivedFrom: "session-events+spatial";
}

export interface MechanicalRotaryRateEvidence {
  readonly relationshipId: string;
  readonly commandId: string | null;
  readonly durationSeconds: number | null;
  readonly averageAngularVelocityRadPerSec: number | null;
  readonly averageRpm: number | null;
  readonly mode: "segment-average" | "unresolved-no-duration";
  readonly derivedFrom: "session-events-explicit-duration";
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

export interface MechanicalRotaryCommandResult {
  readonly commandId: string;
  readonly relationshipId: string;
  readonly source: StudioCommand["source"];
  readonly driverEntityId: string;
  readonly followerEntityId: string;
  readonly beforeRadians: number;
  readonly afterRadians: number;
  readonly beforeContinuousRadians: number;
  readonly afterContinuousRadians: number;
  readonly beforeRevolutions: number;
  readonly afterRevolutions: number;
  readonly deltaRadians: number;
  readonly durationSeconds: number | null;
  readonly averageAngularVelocityRadPerSec: number | null;
  readonly averageRpm: number | null;
  readonly rateMode: "segment-average" | "unresolved-no-duration";
  readonly mode: "incremental" | "principal-shortest" | "continuous-absolute";
  readonly changed: boolean;
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

interface ResolvedRotaryJoint {
  readonly constraint: MechanicalAxialConstraint;
  readonly relationship: EngineeringRelationship;
}

function finiteRadians(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
}

function normalizeNearZero(value: number): number {
  return Math.abs(value) <= 1e-12 ? 0 : value;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numeric(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be finite numeric evidence`);
  return value;
}

function textual(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be string evidence`);
  return value;
}

function rotaryEventType(type: string): boolean {
  return type === "MechanicalRotaryStepExecuted"
    || type === "MechanicalRotaryTargetExecuted"
    || type === "MechanicalRotaryContinuousTargetExecuted";
}

function rateMatches(recorded: number, expected: number): boolean {
  return Math.abs(recorded - expected) <= Math.max(0.000001, Math.abs(expected) * 0.000001);
}

function travelLimitsFromRelationship(relationship: EngineeringRelationship): MechanicalRotaryTravelLimits | null {
  const value = relationship.metadata.rotaryTravelLimits;
  if (value === undefined) return null;
  if (!record(value)) throw new Error(`Mechanical rotary travel limits metadata must be an object: ${relationship.id}`);
  if (value.mode !== "continuous") throw new Error(`Mechanical rotary travel limits mode must be continuous: ${relationship.id}`);
  const minContinuousRadians = numeric(value.minContinuousRadians, "Mechanical rotary minimum travel");
  const maxContinuousRadians = numeric(value.maxContinuousRadians, "Mechanical rotary maximum travel");
  if (minContinuousRadians > maxContinuousRadians) {
    throw new Error(`Mechanical rotary travel limits are inverted: ${relationship.id}`);
  }
  if (value.signature !== MECHANICAL_COMMAND_SIGNATURE) {
    throw new Error(`Mechanical rotary travel limits signature mismatch: ${relationship.id}`);
  }
  return {
    mode: "continuous",
    minContinuousRadians,
    maxContinuousRadians,
    signature: MECHANICAL_COMMAND_SIGNATURE
  };
}

function assertWithinTravelLimits(
  relationshipId: string,
  continuousRadians: number,
  limits: MechanicalRotaryTravelLimits | null
): void {
  if (!limits) return;
  if (continuousRadians < limits.minContinuousRadians - ROTARY_CONTINUOUS_EPSILON
    || continuousRadians > limits.maxContinuousRadians + ROTARY_CONTINUOUS_EPSILON) {
    throw new Error(
      `Mechanical rotary travel limit exceeded: ${relationshipId} target=${continuousRadians} `
      + `range=[${limits.minContinuousRadians}, ${limits.maxContinuousRadians}]`
    );
  }
}

export class InventionMechanicalCommandRuntime {
  #sequence: number;

  constructor(
    readonly session: EngineeringSession,
    readonly spatial: InventionSpatialScene
  ) {
    if (spatial.session !== session) throw new Error("Mechanical command runtime requires the spatial scene from the same EngineeringSession");
    this.#sequence = this.#restoreCommandSequence();
    this.session.commands.register(MECHANICAL_ROTARY_STEP_COMMAND, (command) =>
      this.#executeStep(command as StudioCommand<MechanicalRotaryStepPayload>)
    );
    this.session.commands.register(MECHANICAL_ROTARY_TARGET_COMMAND, (command) =>
      this.#executeTarget(command as StudioCommand<MechanicalRotaryTargetPayload>)
    );
    this.session.commands.register(MECHANICAL_ROTARY_CONTINUOUS_TARGET_COMMAND, (command) =>
      this.#executeContinuousTarget(command as StudioCommand<MechanicalRotaryContinuousTargetPayload>)
    );
    this.session.commands.register(MECHANICAL_ROTARY_SET_TRAVEL_LIMITS_COMMAND, (command) =>
      this.#executeSetTravelLimits(command as StudioCommand<MechanicalRotaryTravelLimitsPayload>)
    );
    this.session.commands.register(MECHANICAL_ROTARY_CLEAR_TRAVEL_LIMITS_COMMAND, (command) =>
      this.#executeClearTravelLimits(command as StudioCommand<MechanicalRotaryClearTravelLimitsPayload>)
    );
  }

  async step(
    relationshipId: string,
    radians: number,
    source: StudioCommand["source"] = "ui",
    durationSeconds?: number
  ): Promise<CommandResult<MechanicalRotaryCommandResult>> {
    finiteRadians(radians, "Mechanical rotary step");
    const payload: MechanicalRotaryStepPayload = durationSeconds === undefined
      ? { relationshipId, radians }
      : { relationshipId, radians, durationSeconds: validateRotaryDurationSeconds(durationSeconds) };
    return this.session.commands.dispatch<MechanicalRotaryCommandResult>({
      id: this.#nextCommandId(),
      type: MECHANICAL_ROTARY_STEP_COMMAND,
      payload,
      source,
      issuedAt: new Date().toISOString()
    });
  }

  async setTarget(
    relationshipId: string,
    targetRadians: number,
    source: StudioCommand["source"] = "ui",
    durationSeconds?: number
  ): Promise<CommandResult<MechanicalRotaryCommandResult>> {
    finiteRadians(targetRadians, "Mechanical rotary target");
    const payload: MechanicalRotaryTargetPayload = durationSeconds === undefined
      ? { relationshipId, targetRadians }
      : { relationshipId, targetRadians, durationSeconds: validateRotaryDurationSeconds(durationSeconds) };
    return this.session.commands.dispatch<MechanicalRotaryCommandResult>({
      id: this.#nextCommandId(),
      type: MECHANICAL_ROTARY_TARGET_COMMAND,
      payload,
      source,
      issuedAt: new Date().toISOString()
    });
  }

  async setContinuousTarget(
    relationshipId: string,
    targetContinuousRadians: number,
    source: StudioCommand["source"] = "ui",
    durationSeconds?: number
  ): Promise<CommandResult<MechanicalRotaryCommandResult>> {
    finiteRadians(targetContinuousRadians, "Mechanical rotary continuous target");
    const payload: MechanicalRotaryContinuousTargetPayload = durationSeconds === undefined
      ? { relationshipId, targetContinuousRadians }
      : { relationshipId, targetContinuousRadians, durationSeconds: validateRotaryDurationSeconds(durationSeconds) };
    return this.session.commands.dispatch<MechanicalRotaryCommandResult>({
      id: this.#nextCommandId(),
      type: MECHANICAL_ROTARY_CONTINUOUS_TARGET_COMMAND,
      payload,
      source,
      issuedAt: new Date().toISOString()
    });
  }

  async setTravelLimits(
    relationshipId: string,
    minContinuousRadians: number,
    maxContinuousRadians: number,
    source: StudioCommand["source"] = "ui"
  ): Promise<CommandResult<MechanicalRotaryTravelLimitsResult>> {
    finiteRadians(minContinuousRadians, "Mechanical rotary minimum travel");
    finiteRadians(maxContinuousRadians, "Mechanical rotary maximum travel");
    return this.session.commands.dispatch<MechanicalRotaryTravelLimitsResult>({
      id: this.#nextCommandId(),
      type: MECHANICAL_ROTARY_SET_TRAVEL_LIMITS_COMMAND,
      payload: { relationshipId, minContinuousRadians, maxContinuousRadians },
      source,
      issuedAt: new Date().toISOString()
    });
  }

  async clearTravelLimits(
    relationshipId: string,
    source: StudioCommand["source"] = "ui"
  ): Promise<CommandResult<MechanicalRotaryTravelLimitsResult>> {
    return this.session.commands.dispatch<MechanicalRotaryTravelLimitsResult>({
      id: this.#nextCommandId(),
      type: MECHANICAL_ROTARY_CLEAR_TRAVEL_LIMITS_COMMAND,
      payload: { relationshipId },
      source,
      issuedAt: new Date().toISOString()
    });
  }

  travelLimits(relationshipId: string): MechanicalRotaryTravelLimits | null {
    const { relationship } = this.#resolveJoint(relationshipId);
    return travelLimitsFromRelationship(relationship);
  }

  kinematics(relationshipId: string): MechanicalRotaryKinematics {
    const { constraint } = this.#resolveJoint(relationshipId);
    const driverBinding = this.spatial.binding(constraint.driver.entityId);
    const followerBinding = this.spatial.binding(constraint.follower.entityId);
    const principalRadians = normalizeNearZero(rotaryJointRelativeAngle(
      constraint.driverAxisLocal,
      constraint.followerAxisLocal,
      driverBinding.rotation,
      followerBinding.rotation
    ));
    const evidence = this.#rotaryEvidence(relationshipId);
    if (evidence.length === 0) {
      const state = rotaryContinuousState(principalRadians, principalRadians);
      return { ...state, relationshipId, evidenceCommands: 0, derivedFrom: "session-events+spatial" };
    }

    const firstPayload = evidence[0]?.payload;
    if (!firstPayload) throw new Error(`Mechanical rotary evidence missing first payload: ${relationshipId}`);
    let continuousRadians = firstPayload.beforeContinuousRadians !== undefined
      ? numeric(firstPayload.beforeContinuousRadians, "Mechanical rotary beforeContinuousRadians")
      : numeric(firstPayload.beforeRadians, "Mechanical rotary legacy beforeRadians");

    for (const entry of evidence) {
      const deltaRadians = numeric(entry.payload.deltaRadians, "Mechanical rotary deltaRadians");
      continuousRadians += deltaRadians;
      if (entry.payload.afterContinuousRadians !== undefined) {
        const recorded = numeric(entry.payload.afterContinuousRadians, "Mechanical rotary afterContinuousRadians");
        if (Math.abs(recorded - continuousRadians) > 0.000001) {
          throw new Error(`Mechanical rotary continuous evidence mismatch: ${relationshipId}`);
        }
      }
    }

    const state = rotaryContinuousState(principalRadians, continuousRadians);
    return { ...state, relationshipId, evidenceCommands: evidence.length, derivedFrom: "session-events+spatial" };
  }

  rate(relationshipId: string): MechanicalRotaryRateEvidence {
    this.#resolveJoint(relationshipId);
    const evidence = this.#rotaryEvidence(relationshipId);
    const latest = evidence[evidence.length - 1];
    if (!latest) {
      return {
        relationshipId,
        commandId: null,
        durationSeconds: null,
        averageAngularVelocityRadPerSec: null,
        averageRpm: null,
        mode: "unresolved-no-duration",
        derivedFrom: "session-events-explicit-duration",
        signature: MECHANICAL_COMMAND_SIGNATURE
      };
    }

    const commandId = textual(latest.payload.commandId, "Mechanical rotary rate commandId");
    if (latest.payload.durationSeconds === undefined || latest.payload.durationSeconds === null) {
      if (latest.payload.rateMode !== undefined && latest.payload.rateMode !== "unresolved-no-duration") {
        throw new Error(`Mechanical rotary unresolved rate-mode evidence mismatch: ${relationshipId}`);
      }
      return {
        relationshipId,
        commandId,
        durationSeconds: null,
        averageAngularVelocityRadPerSec: null,
        averageRpm: null,
        mode: "unresolved-no-duration",
        derivedFrom: "session-events-explicit-duration",
        signature: MECHANICAL_COMMAND_SIGNATURE
      };
    }

    const deltaRadians = numeric(latest.payload.deltaRadians, "Mechanical rotary rate deltaRadians");
    const durationSeconds = numeric(latest.payload.durationSeconds, "Mechanical rotary rate durationSeconds");
    const derived = deriveRotarySegmentRate(deltaRadians, durationSeconds);
    if (latest.payload.rateMode !== undefined && latest.payload.rateMode !== "segment-average") {
      throw new Error(`Mechanical rotary rate-mode evidence mismatch: ${relationshipId}`);
    }
    if (latest.payload.averageAngularVelocityRadPerSec !== undefined && latest.payload.averageAngularVelocityRadPerSec !== null) {
      const recorded = numeric(latest.payload.averageAngularVelocityRadPerSec, "Mechanical rotary recorded angular rate");
      if (!rateMatches(recorded, derived.averageAngularVelocityRadPerSec)) {
        throw new Error(`Mechanical rotary angular-rate evidence mismatch: ${relationshipId}`);
      }
    }
    if (latest.payload.averageRpm !== undefined && latest.payload.averageRpm !== null) {
      const recorded = numeric(latest.payload.averageRpm, "Mechanical rotary recorded RPM");
      if (!rateMatches(recorded, derived.averageRpm)) {
        throw new Error(`Mechanical rotary RPM evidence mismatch: ${relationshipId}`);
      }
    }
    return {
      relationshipId,
      commandId,
      durationSeconds: derived.durationSeconds,
      averageAngularVelocityRadPerSec: derived.averageAngularVelocityRadPerSec,
      averageRpm: derived.averageRpm,
      mode: derived.mode,
      derivedFrom: "session-events-explicit-duration",
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
  }

  #relationships(): readonly EngineeringRelationship[] {
    return this.session.graph.snapshot().relationships;
  }

  #resolveJoint(relationshipId: string): ResolvedRotaryJoint {
    const relationships = this.#relationships();
    const relationship = relationships.find((entry) => entry.id === relationshipId);
    if (!relationship || relationship.type !== "connectedTo" || relationship.metadata.inventionRuntime !== true) {
      throw new Error(`Mechanical rotary command requires an authored invention connectedTo relationship: ${relationshipId}`);
    }
    const constraint = deriveMechanicalAxialConstraints(this.session, relationships)
      .find((entry) => entry.relationshipId === relationshipId);
    if (!constraint) throw new Error(`Mechanical rotary command requires a rotary-shaft axial constraint: ${relationshipId}`);
    return { constraint, relationship };
  }

  #executeStep(command: StudioCommand<MechanicalRotaryStepPayload>): MechanicalRotaryCommandResult {
    finiteRadians(command.payload.radians, "Mechanical rotary step");
    if (command.payload.durationSeconds !== undefined) validateRotaryDurationSeconds(command.payload.durationSeconds);
    return this.#apply(command, command.payload.relationshipId, command.payload.radians, "incremental");
  }

  #executeTarget(command: StudioCommand<MechanicalRotaryTargetPayload>): MechanicalRotaryCommandResult {
    finiteRadians(command.payload.targetRadians, "Mechanical rotary target");
    if (command.payload.durationSeconds !== undefined) validateRotaryDurationSeconds(command.payload.durationSeconds);
    const { constraint } = this.#resolveJoint(command.payload.relationshipId);
    const driverBinding = this.spatial.binding(constraint.driver.entityId);
    const followerBinding = this.spatial.binding(constraint.follower.entityId);
    const target = rotaryJointTargetDelta(
      constraint.driverAxisLocal,
      constraint.followerAxisLocal,
      driverBinding.rotation,
      followerBinding.rotation,
      command.payload.targetRadians
    );
    return this.#apply(command, command.payload.relationshipId, target.deltaRadians, target.mode);
  }

  #executeContinuousTarget(command: StudioCommand<MechanicalRotaryContinuousTargetPayload>): MechanicalRotaryCommandResult {
    finiteRadians(command.payload.targetContinuousRadians, "Mechanical rotary continuous target");
    if (command.payload.durationSeconds !== undefined) validateRotaryDurationSeconds(command.payload.durationSeconds);
    const before = this.kinematics(command.payload.relationshipId);
    const target = rotaryContinuousTargetDelta(before.continuousRadians, command.payload.targetContinuousRadians);
    return this.#apply(command, command.payload.relationshipId, target.deltaRadians, target.mode);
  }

  #executeSetTravelLimits(command: StudioCommand<MechanicalRotaryTravelLimitsPayload>): MechanicalRotaryTravelLimitsResult {
    finiteRadians(command.payload.minContinuousRadians, "Mechanical rotary minimum travel");
    finiteRadians(command.payload.maxContinuousRadians, "Mechanical rotary maximum travel");
    if (command.payload.minContinuousRadians > command.payload.maxContinuousRadians) {
      throw new Error("Mechanical rotary travel limits require minContinuousRadians <= maxContinuousRadians");
    }
    const { relationship } = this.#resolveJoint(command.payload.relationshipId);
    const currentContinuousRadians = this.kinematics(command.payload.relationshipId).continuousRadians;
    const previous = travelLimitsFromRelationship(relationship);
    const current: MechanicalRotaryTravelLimits = {
      mode: "continuous",
      minContinuousRadians: normalizeNearZero(command.payload.minContinuousRadians),
      maxContinuousRadians: normalizeNearZero(command.payload.maxContinuousRadians),
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
    assertWithinTravelLimits(command.payload.relationshipId, currentContinuousRadians, current);
    this.session.graph.replaceRelationship({
      ...relationship,
      metadata: {
        ...relationship.metadata,
        rotaryTravelLimits: current
      }
    });
    const result: MechanicalRotaryTravelLimitsResult = {
      commandId: command.id,
      relationshipId: command.payload.relationshipId,
      source: command.source,
      action: "set",
      previous,
      current,
      currentContinuousRadians,
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
    this.#recordTravelLimitsEvidence(command, result);
    return result;
  }

  #executeClearTravelLimits(command: StudioCommand<MechanicalRotaryClearTravelLimitsPayload>): MechanicalRotaryTravelLimitsResult {
    const { relationship } = this.#resolveJoint(command.payload.relationshipId);
    const currentContinuousRadians = this.kinematics(command.payload.relationshipId).continuousRadians;
    const previous = travelLimitsFromRelationship(relationship);
    const metadata: Record<string, unknown> = { ...relationship.metadata };
    delete metadata.rotaryTravelLimits;
    this.session.graph.replaceRelationship({ ...relationship, metadata });
    const result: MechanicalRotaryTravelLimitsResult = {
      commandId: command.id,
      relationshipId: command.payload.relationshipId,
      source: command.source,
      action: "clear",
      previous,
      current: null,
      currentContinuousRadians,
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
    this.#recordTravelLimitsEvidence(command, result);
    return result;
  }

  #apply(
    command: StudioCommand<MechanicalRotaryStepPayload | MechanicalRotaryTargetPayload | MechanicalRotaryContinuousTargetPayload>,
    relationshipId: string,
    deltaRadiansInput: number,
    mode: MechanicalRotaryCommandResult["mode"]
  ): MechanicalRotaryCommandResult {
    finiteRadians(deltaRadiansInput, "Mechanical rotary command delta");
    const deltaRadians = normalizeNearZero(deltaRadiansInput);
    const durationSeconds = command.payload.durationSeconds === undefined
      ? null
      : validateRotaryDurationSeconds(command.payload.durationSeconds);
    const { constraint, relationship } = this.#resolveJoint(relationshipId);
    const beforeKinematics = this.kinematics(relationshipId);
    const limits = travelLimitsFromRelationship(relationship);
    const intendedContinuousRadians = beforeKinematics.continuousRadians + deltaRadians;
    assertWithinTravelLimits(relationshipId, intendedContinuousRadians, limits);
    const rate: RotarySegmentRateEvidence | null = durationSeconds === null
      ? null
      : deriveRotarySegmentRate(deltaRadians, durationSeconds);
    const driverEntity = this.session.getEntity(constraint.driver.entityId);
    const followerEntity = this.session.getEntity(constraint.follower.entityId);
    const driverBinding = this.spatial.binding(constraint.driver.entityId);
    const followerBinding = this.spatial.binding(constraint.follower.entityId);
    const driverEndpointLocal = mechanicalPortLocalPosition(driverEntity, constraint.driver.portId);
    const followerEndpointLocal = mechanicalPortLocalPosition(followerEntity, constraint.follower.portId);
    const driverEndpointWorld = mechanicalPortWorldPosition(driverEndpointLocal, driverBinding);
    const beforeRadians = beforeKinematics.principalRadians;
    const plan = planMechanicalRotaryJointStep(
      driverEndpointWorld,
      followerEndpointLocal,
      constraint.driverAxisLocal,
      constraint.followerAxisLocal,
      driverBinding,
      followerBinding,
      deltaRadians
    );
    this.spatial.transformBatch([{
      entityId: plan.entityId,
      position: plan.toPosition,
      rotation: plan.toRotation
    }]);
    const afterBinding = this.spatial.binding(constraint.follower.entityId);
    const afterRadians = normalizeNearZero(rotaryJointRelativeAngle(
      constraint.driverAxisLocal,
      constraint.followerAxisLocal,
      driverBinding.rotation,
      afterBinding.rotation
    ));
    const afterKinematics = advanceRotaryContinuousState(
      beforeKinematics.continuousRadians,
      deltaRadians,
      afterRadians
    );
    const changed = Math.abs(deltaRadians) > 1e-12;
    const result: MechanicalRotaryCommandResult = {
      commandId: command.id,
      relationshipId,
      source: command.source,
      driverEntityId: constraint.driver.entityId,
      followerEntityId: constraint.follower.entityId,
      beforeRadians,
      afterRadians,
      beforeContinuousRadians: beforeKinematics.continuousRadians,
      afterContinuousRadians: afterKinematics.continuousRadians,
      beforeRevolutions: beforeKinematics.revolutions,
      afterRevolutions: afterKinematics.revolutions,
      deltaRadians,
      durationSeconds,
      averageAngularVelocityRadPerSec: rate?.averageAngularVelocityRadPerSec ?? null,
      averageRpm: rate?.averageRpm ?? null,
      rateMode: rate?.mode ?? "unresolved-no-duration",
      mode,
      changed,
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
    this.#recordEvidence(command, result);
    return result;
  }

  #recordEvidence(
    command: StudioCommand<MechanicalRotaryStepPayload | MechanicalRotaryTargetPayload | MechanicalRotaryContinuousTargetPayload>,
    result: MechanicalRotaryCommandResult
  ): void {
    const eventType = result.mode === "incremental"
      ? "MechanicalRotaryStepExecuted"
      : result.mode === "principal-shortest"
        ? "MechanicalRotaryTargetExecuted"
        : "MechanicalRotaryContinuousTargetExecuted";
    this.session.events.record({
      id: `event-${this.session.events.list().length + 1}`,
      type: eventType,
      occurredAt: command.issuedAt,
      source: command.source,
      payload: {
        commandId: command.id,
        relationshipId: result.relationshipId,
        driverEntityId: result.driverEntityId,
        followerEntityId: result.followerEntityId,
        beforeRadians: result.beforeRadians,
        afterRadians: result.afterRadians,
        beforeContinuousRadians: result.beforeContinuousRadians,
        afterContinuousRadians: result.afterContinuousRadians,
        beforeRevolutions: result.beforeRevolutions,
        afterRevolutions: result.afterRevolutions,
        deltaRadians: result.deltaRadians,
        durationSeconds: result.durationSeconds,
        averageAngularVelocityRadPerSec: result.averageAngularVelocityRadPerSec,
        averageRpm: result.averageRpm,
        rateMode: result.rateMode,
        mode: result.mode,
        changed: result.changed,
        signature: result.signature
      }
    });
  }

  #recordTravelLimitsEvidence(
    command: StudioCommand<MechanicalRotaryTravelLimitsPayload | MechanicalRotaryClearTravelLimitsPayload>,
    result: MechanicalRotaryTravelLimitsResult
  ): void {
    this.session.events.record({
      id: `event-${this.session.events.list().length + 1}`,
      type: result.action === "set" ? "MechanicalRotaryTravelLimitsSet" : "MechanicalRotaryTravelLimitsCleared",
      occurredAt: command.issuedAt,
      source: command.source,
      payload: {
        commandId: command.id,
        relationshipId: result.relationshipId,
        action: result.action,
        previous: result.previous,
        current: result.current,
        currentContinuousRadians: result.currentContinuousRadians,
        signature: result.signature
      }
    });
  }

  #rotaryEvidence(relationshipId: string): readonly { readonly payload: Record<string, unknown> }[] {
    return this.session.events.list().flatMap((event) => {
      if (!rotaryEventType(event.type) || !record(event.payload) || event.payload.relationshipId !== relationshipId) return [];
      return [{ payload: event.payload }];
    });
  }

  #restoreCommandSequence(): number {
    let maximum = 0;
    for (const event of this.session.events.list()) {
      if (!record(event.payload)) continue;
      const commandId = event.payload.commandId;
      if (typeof commandId !== "string") continue;
      const match = /^mechanical-cmd-(\d+)$/.exec(commandId);
      if (match?.[1]) maximum = Math.max(maximum, Number(match[1]));
    }
    return maximum;
  }

  #nextCommandId(): string {
    this.#sequence += 1;
    return `mechanical-cmd-${this.#sequence}`;
  }
}

const runtimeCache = new WeakMap<EngineeringSession, InventionMechanicalCommandRuntime>();

export function mechanicalCommandRuntimeFor(spatial: InventionSpatialScene): InventionMechanicalCommandRuntime {
  const session = spatial.session;
  const existing = runtimeCache.get(session);
  if (existing) {
    if (existing.spatial !== spatial) throw new Error("Mechanical command runtime already bound to another spatial scene for this session");
    return existing;
  }
  const runtime = new InventionMechanicalCommandRuntime(session, spatial);
  runtimeCache.set(session, runtime);
  return runtime;
}
