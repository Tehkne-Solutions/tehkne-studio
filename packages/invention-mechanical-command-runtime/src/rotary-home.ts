import type { CommandResult, StudioCommand } from "../../command-bus/src/index.js";
import type { EngineeringRelationship } from "../../engineering-graph/src/index.js";
import type { EngineeringSession } from "../../engineering-session/src/index.js";
import type { InventionSpatialScene } from "../../invention-spatial-runtime/src/index.js";
import {
  MECHANICAL_COMMAND_SIGNATURE,
  mechanicalCommandRuntimeFor,
  validateRotaryDurationSeconds,
  type InventionMechanicalCommandRuntime,
  type MechanicalRotaryCommandResult
} from "./index.js";

export const MECHANICAL_ROTARY_SET_HOME_COMMAND = "invention.mechanical.rotary.setHome" as const;
export const MECHANICAL_ROTARY_GO_HOME_COMMAND = "invention.mechanical.rotary.goHome" as const;
export const MECHANICAL_ROTARY_CLEAR_HOME_COMMAND = "invention.mechanical.rotary.clearHome" as const;

export interface MechanicalRotaryHomePayload {
  readonly relationshipId: string;
}

export interface MechanicalRotaryGoHomePayload extends MechanicalRotaryHomePayload {
  readonly durationSeconds?: number;
}

export interface MechanicalRotaryHome {
  readonly mode: "continuous";
  readonly homeContinuousRadians: number;
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

export interface MechanicalRotaryHomeResult {
  readonly commandId: string;
  readonly relationshipId: string;
  readonly source: StudioCommand["source"];
  readonly action: "set" | "clear";
  readonly previous: MechanicalRotaryHome | null;
  readonly current: MechanicalRotaryHome | null;
  readonly currentContinuousRadians: number;
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numeric(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be finite numeric evidence`);
  return value;
}

function normalizeNearZero(value: number): number {
  return Math.abs(value) <= 1e-12 ? 0 : value;
}

function homeFromRelationship(relationship: EngineeringRelationship): MechanicalRotaryHome | null {
  const value = relationship.metadata.rotaryHome;
  if (value === undefined) return null;
  if (!record(value)) throw new Error(`Mechanical rotary home metadata must be an object: ${relationship.id}`);
  if (value.mode !== "continuous") throw new Error(`Mechanical rotary home mode must be continuous: ${relationship.id}`);
  const homeContinuousRadians = numeric(value.homeContinuousRadians, "Mechanical rotary home");
  if (value.signature !== MECHANICAL_COMMAND_SIGNATURE) {
    throw new Error(`Mechanical rotary home signature mismatch: ${relationship.id}`);
  }
  return {
    mode: "continuous",
    homeContinuousRadians,
    signature: MECHANICAL_COMMAND_SIGNATURE
  };
}

export class InventionMechanicalRotaryHomeRuntime {
  #sequence: number;

  constructor(
    readonly session: EngineeringSession,
    readonly spatial: InventionSpatialScene,
    readonly mechanical: InventionMechanicalCommandRuntime = mechanicalCommandRuntimeFor(spatial)
  ) {
    if (spatial.session !== session || mechanical.session !== session || mechanical.spatial !== spatial) {
      throw new Error("Rotary home runtime requires the same EngineeringSession and spatial scene as the mechanical runtime");
    }
    this.#sequence = this.#restoreCommandSequence();
    this.session.commands.register(MECHANICAL_ROTARY_SET_HOME_COMMAND, (command) =>
      this.#executeSetHome(command as StudioCommand<MechanicalRotaryHomePayload>)
    );
    this.session.commands.register(MECHANICAL_ROTARY_GO_HOME_COMMAND, (command) =>
      this.#executeGoHome(command as StudioCommand<MechanicalRotaryGoHomePayload>)
    );
    this.session.commands.register(MECHANICAL_ROTARY_CLEAR_HOME_COMMAND, (command) =>
      this.#executeClearHome(command as StudioCommand<MechanicalRotaryHomePayload>)
    );
  }

  async setHome(
    relationshipId: string,
    source: StudioCommand["source"] = "ui"
  ): Promise<CommandResult<MechanicalRotaryHomeResult>> {
    return this.session.commands.dispatch<MechanicalRotaryHomeResult>({
      id: this.#nextCommandId(),
      type: MECHANICAL_ROTARY_SET_HOME_COMMAND,
      payload: { relationshipId },
      source,
      issuedAt: new Date().toISOString()
    });
  }

  async goHome(
    relationshipId: string,
    source: StudioCommand["source"] = "ui",
    durationSeconds?: number
  ): Promise<CommandResult<MechanicalRotaryCommandResult>> {
    const payload: MechanicalRotaryGoHomePayload = durationSeconds === undefined
      ? { relationshipId }
      : { relationshipId, durationSeconds: validateRotaryDurationSeconds(durationSeconds) };
    return this.session.commands.dispatch<MechanicalRotaryCommandResult>({
      id: this.#nextCommandId(),
      type: MECHANICAL_ROTARY_GO_HOME_COMMAND,
      payload,
      source,
      issuedAt: new Date().toISOString()
    });
  }

  async clearHome(
    relationshipId: string,
    source: StudioCommand["source"] = "ui"
  ): Promise<CommandResult<MechanicalRotaryHomeResult>> {
    return this.session.commands.dispatch<MechanicalRotaryHomeResult>({
      id: this.#nextCommandId(),
      type: MECHANICAL_ROTARY_CLEAR_HOME_COMMAND,
      payload: { relationshipId },
      source,
      issuedAt: new Date().toISOString()
    });
  }

  home(relationshipId: string): MechanicalRotaryHome | null {
    const relationship = this.#resolveRelationship(relationshipId);
    return homeFromRelationship(relationship);
  }

  #resolveRelationship(relationshipId: string): EngineeringRelationship {
    this.mechanical.kinematics(relationshipId);
    const relationship = this.session.graph.snapshot().relationships.find((entry) => entry.id === relationshipId);
    if (!relationship) throw new Error(`Mechanical rotary home relationship not found: ${relationshipId}`);
    return relationship;
  }

  #executeSetHome(command: StudioCommand<MechanicalRotaryHomePayload>): MechanicalRotaryHomeResult {
    const relationship = this.#resolveRelationship(command.payload.relationshipId);
    const currentContinuousRadians = this.mechanical.kinematics(command.payload.relationshipId).continuousRadians;
    const previous = homeFromRelationship(relationship);
    const current: MechanicalRotaryHome = {
      mode: "continuous",
      homeContinuousRadians: normalizeNearZero(currentContinuousRadians),
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
    this.session.graph.replaceRelationship({
      ...relationship,
      metadata: {
        ...relationship.metadata,
        rotaryHome: current
      }
    });
    const result: MechanicalRotaryHomeResult = {
      commandId: command.id,
      relationshipId: command.payload.relationshipId,
      source: command.source,
      action: "set",
      previous,
      current,
      currentContinuousRadians,
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
    this.#recordHomeEvidence(command, result);
    return result;
  }

  async #executeGoHome(command: StudioCommand<MechanicalRotaryGoHomePayload>): Promise<MechanicalRotaryCommandResult> {
    const home = this.home(command.payload.relationshipId);
    if (!home) throw new Error(`Mechanical rotary home is not authored: ${command.payload.relationshipId}`);
    const durationSeconds = command.payload.durationSeconds === undefined
      ? undefined
      : validateRotaryDurationSeconds(command.payload.durationSeconds);
    const movement = await this.mechanical.setContinuousTarget(
      command.payload.relationshipId,
      home.homeContinuousRadians,
      command.source,
      durationSeconds
    );
    if (!movement.ok || !movement.result) {
      throw new Error(movement.error ?? `Mechanical rotary go-home movement failed: ${command.payload.relationshipId}`);
    }
    this.session.events.record({
      id: `event-${this.session.events.list().length + 1}`,
      type: "MechanicalRotaryHomeRequested",
      occurredAt: command.issuedAt,
      source: command.source,
      payload: {
        commandId: command.id,
        movementCommandId: movement.result.commandId,
        relationshipId: command.payload.relationshipId,
        homeContinuousRadians: home.homeContinuousRadians,
        durationSeconds: movement.result.durationSeconds,
        rateMode: movement.result.rateMode,
        changed: movement.result.changed,
        signature: MECHANICAL_COMMAND_SIGNATURE
      }
    });
    return movement.result;
  }

  #executeClearHome(command: StudioCommand<MechanicalRotaryHomePayload>): MechanicalRotaryHomeResult {
    const relationship = this.#resolveRelationship(command.payload.relationshipId);
    const currentContinuousRadians = this.mechanical.kinematics(command.payload.relationshipId).continuousRadians;
    const previous = homeFromRelationship(relationship);
    const metadata: Record<string, unknown> = { ...relationship.metadata };
    delete metadata.rotaryHome;
    this.session.graph.replaceRelationship({ ...relationship, metadata });
    const result: MechanicalRotaryHomeResult = {
      commandId: command.id,
      relationshipId: command.payload.relationshipId,
      source: command.source,
      action: "clear",
      previous,
      current: null,
      currentContinuousRadians,
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
    this.#recordHomeEvidence(command, result);
    return result;
  }

  #recordHomeEvidence(command: StudioCommand<MechanicalRotaryHomePayload>, result: MechanicalRotaryHomeResult): void {
    this.session.events.record({
      id: `event-${this.session.events.list().length + 1}`,
      type: result.action === "set" ? "MechanicalRotaryHomeSet" : "MechanicalRotaryHomeCleared",
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

  #restoreCommandSequence(): number {
    let maximum = 0;
    for (const event of this.session.events.list()) {
      if (!record(event.payload)) continue;
      const commandId = event.payload.commandId;
      if (typeof commandId !== "string") continue;
      const match = /^mechanical-home-cmd-(\d+)$/.exec(commandId);
      if (match?.[1]) maximum = Math.max(maximum, Number(match[1]));
    }
    return maximum;
  }

  #nextCommandId(): string {
    this.#sequence += 1;
    return `mechanical-home-cmd-${this.#sequence}`;
  }
}

const runtimeCache = new WeakMap<EngineeringSession, InventionMechanicalRotaryHomeRuntime>();

export function mechanicalRotaryHomeRuntimeFor(spatial: InventionSpatialScene): InventionMechanicalRotaryHomeRuntime {
  const session = spatial.session;
  const existing = runtimeCache.get(session);
  if (existing) {
    if (existing.spatial !== spatial) throw new Error("Rotary home runtime already bound to another spatial scene for this session");
    return existing;
  }
  const runtime = new InventionMechanicalRotaryHomeRuntime(session, spatial);
  runtimeCache.set(session, runtime);
  return runtime;
}
