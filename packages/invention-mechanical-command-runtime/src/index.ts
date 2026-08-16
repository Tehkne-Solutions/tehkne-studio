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
  rotaryContinuousState,
  type RotaryContinuousState
} from "../../invention-assembly-runtime/src/rotary-continuous-angle.js";
import {
  rotaryJointRelativeAngle,
  rotaryJointTargetDelta
} from "../../invention-assembly-runtime/src/rotary-relative-angle.js";
import type { InventionSpatialScene } from "../../invention-spatial-runtime/src/index.js";
import { mechanicalPortLocalPosition, mechanicalPortWorldPosition } from "./port-geometry.js";

export const MECHANICAL_ROTARY_STEP_COMMAND = "invention.mechanical.rotary.step" as const;
export const MECHANICAL_ROTARY_TARGET_COMMAND = "invention.mechanical.rotary.setTarget" as const;
export const MECHANICAL_COMMAND_SIGNATURE = "Tehkné Solutions" as const;

export interface MechanicalRotaryStepPayload { readonly relationshipId: string; readonly radians: number; }
export interface MechanicalRotaryTargetPayload { readonly relationshipId: string; readonly targetRadians: number; }
export interface MechanicalRotaryKinematics extends RotaryContinuousState {
  readonly relationshipId: string;
  readonly evidenceCommands: number;
  readonly derivedFrom: "session-events+spatial";
}
export interface MechanicalRotaryCommandResult {
  readonly commandId: string; readonly relationshipId: string; readonly source: StudioCommand["source"];
  readonly driverEntityId: string; readonly followerEntityId: string;
  readonly beforeRadians: number; readonly afterRadians: number;
  readonly beforeContinuousRadians: number; readonly afterContinuousRadians: number;
  readonly beforeRevolutions: number; readonly afterRevolutions: number;
  readonly deltaRadians: number; readonly mode: "incremental" | "principal-shortest";
  readonly changed: boolean; readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}
interface ResolvedRotaryJoint { readonly constraint: MechanicalAxialConstraint; readonly relationship: EngineeringRelationship; }

function finiteRadians(value: number, label: string): void { if (!Number.isFinite(value)) throw new Error(`${label} must be finite`); }
function normalizeNearZero(value: number): number { return Math.abs(value) <= 1e-12 ? 0 : value; }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function numeric(value: unknown, label: string): number { if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be finite numeric evidence`); return value; }
function rotaryEventType(type: string): boolean { return type === "MechanicalRotaryStepExecuted" || type === "MechanicalRotaryTargetExecuted"; }

export class InventionMechanicalCommandRuntime {
  #sequence: number;
  constructor(readonly session: EngineeringSession, readonly spatial: InventionSpatialScene) {
    if (spatial.session !== session) throw new Error("Mechanical command runtime requires the spatial scene from the same EngineeringSession");
    this.#sequence = this.#restoreCommandSequence();
    this.session.commands.register(MECHANICAL_ROTARY_STEP_COMMAND, (command) => this.#executeStep(command as StudioCommand<MechanicalRotaryStepPayload>));
    this.session.commands.register(MECHANICAL_ROTARY_TARGET_COMMAND, (command) => this.#executeTarget(command as StudioCommand<MechanicalRotaryTargetPayload>));
  }
  async step(relationshipId: string, radians: number, source: StudioCommand["source"] = "ui"): Promise<CommandResult<MechanicalRotaryCommandResult>> {
    finiteRadians(radians, "Mechanical rotary step");
    return this.session.commands.dispatch<MechanicalRotaryCommandResult>({ id: this.#nextCommandId(), type: MECHANICAL_ROTARY_STEP_COMMAND, payload: { relationshipId, radians }, source, issuedAt: new Date().toISOString() });
  }
  async setTarget(relationshipId: string, targetRadians: number, source: StudioCommand["source"] = "ui"): Promise<CommandResult<MechanicalRotaryCommandResult>> {
    finiteRadians(targetRadians, "Mechanical rotary target");
    return this.session.commands.dispatch<MechanicalRotaryCommandResult>({ id: this.#nextCommandId(), type: MECHANICAL_ROTARY_TARGET_COMMAND, payload: { relationshipId, targetRadians }, source, issuedAt: new Date().toISOString() });
  }
  kinematics(relationshipId: string): MechanicalRotaryKinematics {
    const { constraint } = this.#resolveJoint(relationshipId);
    const driverBinding = this.spatial.binding(constraint.driver.entityId);
    const followerBinding = this.spatial.binding(constraint.follower.entityId);
    const principalRadians = normalizeNearZero(rotaryJointRelativeAngle(constraint.driverAxisLocal, constraint.followerAxisLocal, driverBinding.rotation, followerBinding.rotation));
    const evidence = this.#rotaryEvidence(relationshipId);
    if (evidence.length === 0) {
      const state = rotaryContinuousState(principalRadians, principalRadians);
      return { ...state, relationshipId, evidenceCommands: 0, derivedFrom: "session-events+spatial" };
    }
    const firstPayload = evidence[0]?.payload;
    if (!firstPayload) throw new Error(`Mechanical rotary evidence missing first payload: ${relationshipId}`);
    let continuousRadians = firstPayload.beforeContinuousRadians !== undefined ? numeric(firstPayload.beforeContinuousRadians, "Mechanical rotary beforeContinuousRadians") : numeric(firstPayload.beforeRadians, "Mechanical rotary legacy beforeRadians");
    for (const entry of evidence) {
      const deltaRadians = numeric(entry.payload.deltaRadians, "Mechanical rotary deltaRadians");
      continuousRadians += deltaRadians;
      if (entry.payload.afterContinuousRadians !== undefined) {
        const recorded = numeric(entry.payload.afterContinuousRadians, "Mechanical rotary afterContinuousRadians");
        if (Math.abs(recorded - continuousRadians) > 0.000001) throw new Error(`Mechanical rotary continuous evidence mismatch: ${relationshipId}`);
      }
    }
    const state = rotaryContinuousState(principalRadians, continuousRadians);
    return { ...state, relationshipId, evidenceCommands: evidence.length, derivedFrom: "session-events+spatial" };
  }
  #relationships(): readonly EngineeringRelationship[] { return this.session.graph.snapshot().relationships; }
  #resolveJoint(relationshipId: string): ResolvedRotaryJoint {
    const relationships = this.#relationships();
    const relationship = relationships.find((entry) => entry.id === relationshipId);
    if (!relationship || relationship.type !== "connectedTo" || relationship.metadata.inventionRuntime !== true) throw new Error(`Mechanical rotary command requires an authored invention connectedTo relationship: ${relationshipId}`);
    const constraint = deriveMechanicalAxialConstraints(this.session, relationships).find((entry) => entry.relationshipId === relationshipId);
    if (!constraint) throw new Error(`Mechanical rotary command requires a rotary-shaft axial constraint: ${relationshipId}`);
    return { constraint, relationship };
  }
  #executeStep(command: StudioCommand<MechanicalRotaryStepPayload>): MechanicalRotaryCommandResult { finiteRadians(command.payload.radians, "Mechanical rotary step"); return this.#apply(command, command.payload.relationshipId, command.payload.radians, "incremental"); }
  #executeTarget(command: StudioCommand<MechanicalRotaryTargetPayload>): MechanicalRotaryCommandResult {
    finiteRadians(command.payload.targetRadians, "Mechanical rotary target");
    const { constraint } = this.#resolveJoint(command.payload.relationshipId);
    const driverBinding = this.spatial.binding(constraint.driver.entityId); const followerBinding = this.spatial.binding(constraint.follower.entityId);
    const target = rotaryJointTargetDelta(constraint.driverAxisLocal, constraint.followerAxisLocal, driverBinding.rotation, followerBinding.rotation, command.payload.targetRadians);
    return this.#apply(command, command.payload.relationshipId, target.deltaRadians, target.mode);
  }
  #apply(command: StudioCommand<MechanicalRotaryStepPayload | MechanicalRotaryTargetPayload>, relationshipId: string, deltaRadiansInput: number, mode: MechanicalRotaryCommandResult["mode"]): MechanicalRotaryCommandResult {
    finiteRadians(deltaRadiansInput, "Mechanical rotary command delta");
    const deltaRadians = normalizeNearZero(deltaRadiansInput); const { constraint } = this.#resolveJoint(relationshipId); const beforeKinematics = this.kinematics(relationshipId);
    const driverEntity = this.session.getEntity(constraint.driver.entityId); const followerEntity = this.session.getEntity(constraint.follower.entityId);
    const driverBinding = this.spatial.binding(constraint.driver.entityId); const followerBinding = this.spatial.binding(constraint.follower.entityId);
    const driverEndpointLocal = mechanicalPortLocalPosition(driverEntity, constraint.driver.portId); const followerEndpointLocal = mechanicalPortLocalPosition(followerEntity, constraint.follower.portId);
    const driverEndpointWorld = mechanicalPortWorldPosition(driverEndpointLocal, driverBinding); const beforeRadians = beforeKinematics.principalRadians;
    const plan = planMechanicalRotaryJointStep(driverEndpointWorld, followerEndpointLocal, constraint.driverAxisLocal, constraint.followerAxisLocal, driverBinding, followerBinding, deltaRadians);
    this.spatial.transformBatch([{ entityId: plan.entityId, position: plan.toPosition, rotation: plan.toRotation }]);
    const afterBinding = this.spatial.binding(constraint.follower.entityId);
    const afterRadians = normalizeNearZero(rotaryJointRelativeAngle(constraint.driverAxisLocal, constraint.followerAxisLocal, driverBinding.rotation, afterBinding.rotation));
    const afterKinematics = advanceRotaryContinuousState(beforeKinematics.continuousRadians, deltaRadians, afterRadians); const changed = Math.abs(deltaRadians) > 1e-12;
    const result: MechanicalRotaryCommandResult = { commandId: command.id, relationshipId, source: command.source, driverEntityId: constraint.driver.entityId, followerEntityId: constraint.follower.entityId, beforeRadians, afterRadians, beforeContinuousRadians: beforeKinematics.continuousRadians, afterContinuousRadians: afterKinematics.continuousRadians, beforeRevolutions: beforeKinematics.revolutions, afterRevolutions: afterKinematics.revolutions, deltaRadians, mode, changed, signature: MECHANICAL_COMMAND_SIGNATURE };
    this.#recordEvidence(command, result); return result;
  }
  #recordEvidence(command: StudioCommand<MechanicalRotaryStepPayload | MechanicalRotaryTargetPayload>, result: MechanicalRotaryCommandResult): void {
    this.session.events.record({ id: `event-${this.session.events.list().length + 1}`, type: result.mode === "incremental" ? "MechanicalRotaryStepExecuted" : "MechanicalRotaryTargetExecuted", occurredAt: command.issuedAt, source: command.source, payload: { commandId: command.id, relationshipId: result.relationshipId, driverEntityId: result.driverEntityId, followerEntityId: result.followerEntityId, beforeRadians: result.beforeRadians, afterRadians: result.afterRadians, beforeContinuousRadians: result.beforeContinuousRadians, afterContinuousRadians: result.afterContinuousRadians, beforeRevolutions: result.beforeRevolutions, afterRevolutions: result.afterRevolutions, deltaRadians: result.deltaRadians, mode: result.mode, changed: result.changed, signature: result.signature } });
  }
  #rotaryEvidence(relationshipId: string): readonly { readonly payload: Record<string, unknown> }[] { return this.session.events.list().flatMap((event) => !rotaryEventType(event.type) || !record(event.payload) || event.payload.relationshipId !== relationshipId ? [] : [{ payload: event.payload }]); }
  #restoreCommandSequence(): number { let maximum = 0; for (const event of this.session.events.list()) { if (!record(event.payload)) continue; const commandId = event.payload.commandId; if (typeof commandId !== "string") continue; const match = /^mechanical-cmd-(\d+)$/.exec(commandId); if (match?.[1]) maximum = Math.max(maximum, Number(match[1])); } return maximum; }
  #nextCommandId(): string { this.#sequence += 1; return `mechanical-cmd-${this.#sequence}`; }
}
const runtimeCache = new WeakMap<EngineeringSession, InventionMechanicalCommandRuntime>();
export function mechanicalCommandRuntimeFor(spatial: InventionSpatialScene): InventionMechanicalCommandRuntime { const session = spatial.session; const existing = runtimeCache.get(session); if (existing) { if (existing.spatial !== spatial) throw new Error("Mechanical command runtime already bound to another spatial scene for this session"); return existing; } const runtime = new InventionMechanicalCommandRuntime(session, spatial); runtimeCache.set(session, runtime); return runtime; }
