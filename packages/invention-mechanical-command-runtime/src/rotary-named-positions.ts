import type { CommandResult, StudioCommand } from "../../command-bus/src/index.js";
import type { EngineeringRelationship } from "../../engineering-graph/src/index.js";
import type { EngineeringSession } from "../../engineering-session/src/index.js";
import type { InventionSpatialScene } from "../../invention-spatial-runtime/src/index.js";
import {
  MECHANICAL_COMMAND_SIGNATURE,
  mechanicalCommandRuntimeFor,
  type InventionMechanicalCommandRuntime,
  type MechanicalRotaryCommandResult
} from "./index.js";

export const MECHANICAL_ROTARY_SAVE_NAMED_POSITION_COMMAND = "invention.mechanical.rotary.saveNamedPosition" as const;
export const MECHANICAL_ROTARY_GO_TO_NAMED_POSITION_COMMAND = "invention.mechanical.rotary.goToNamedPosition" as const;
export const MECHANICAL_ROTARY_DELETE_NAMED_POSITION_COMMAND = "invention.mechanical.rotary.deleteNamedPosition" as const;

export interface MechanicalRotaryNamedPositionPayload {
  readonly relationshipId: string;
  readonly name: string;
}

export interface MechanicalRotaryNamedPosition {
  readonly key: string;
  readonly name: string;
  readonly continuousRadians: number;
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

export interface MechanicalRotaryNamedPositionsDocument {
  readonly version: 1;
  readonly positions: readonly MechanicalRotaryNamedPosition[];
  readonly signature: typeof MECHANICAL_COMMAND_SIGNATURE;
}

export interface MechanicalRotaryNamedPositionResult {
  readonly commandId: string;
  readonly relationshipId: string;
  readonly source: StudioCommand["source"];
  readonly action: "created" | "updated" | "deleted";
  readonly previous: MechanicalRotaryNamedPosition | null;
  readonly current: MechanicalRotaryNamedPosition | null;
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

function normalizePositionName(value: string): { readonly name: string; readonly key: string } {
  if (typeof value !== "string") throw new Error("Mechanical rotary named position name must be text");
  const name = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 64) throw new Error("Mechanical rotary named position name must contain 1 to 64 characters");
  if (/\p{Cc}/u.test(name)) throw new Error("Mechanical rotary named position name cannot contain control characters");
  return { name, key: name.toLowerCase() };
}

function namedPositionsFromRelationship(relationship: EngineeringRelationship): MechanicalRotaryNamedPositionsDocument | null {
  const value = relationship.metadata.rotaryNamedPositions;
  if (value === undefined) return null;
  if (!record(value)) throw new Error(`Mechanical rotary named positions metadata must be an object: ${relationship.id}`);
  if (value.version !== 1) throw new Error(`Mechanical rotary named positions version mismatch: ${relationship.id}`);
  if (value.signature !== MECHANICAL_COMMAND_SIGNATURE) {
    throw new Error(`Mechanical rotary named positions signature mismatch: ${relationship.id}`);
  }
  if (!Array.isArray(value.positions)) throw new Error(`Mechanical rotary named positions must be an array: ${relationship.id}`);

  const keys = new Set<string>();
  const positions = value.positions.map((entry, index): MechanicalRotaryNamedPosition => {
    if (!record(entry)) throw new Error(`Mechanical rotary named position ${index} must be an object: ${relationship.id}`);
    if (typeof entry.name !== "string" || typeof entry.key !== "string") {
      throw new Error(`Mechanical rotary named position ${index} requires name and key: ${relationship.id}`);
    }
    const normalized = normalizePositionName(entry.name);
    if (entry.key !== normalized.key) throw new Error(`Mechanical rotary named position key mismatch: ${relationship.id}`);
    if (keys.has(entry.key)) throw new Error(`Mechanical rotary named position duplicate key: ${entry.key}`);
    keys.add(entry.key);
    if (entry.signature !== MECHANICAL_COMMAND_SIGNATURE) {
      throw new Error(`Mechanical rotary named position signature mismatch: ${relationship.id}`);
    }
    return {
      key: entry.key,
      name: normalized.name,
      continuousRadians: numeric(entry.continuousRadians, "Mechanical rotary named position"),
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
  });

  return {
    version: 1,
    positions,
    signature: MECHANICAL_COMMAND_SIGNATURE
  };
}

export class InventionMechanicalRotaryNamedPositionsRuntime {
  #sequence: number;

  constructor(
    readonly session: EngineeringSession,
    readonly spatial: InventionSpatialScene,
    readonly mechanical: InventionMechanicalCommandRuntime = mechanicalCommandRuntimeFor(spatial)
  ) {
    if (spatial.session !== session || mechanical.session !== session || mechanical.spatial !== spatial) {
      throw new Error("Rotary named positions runtime requires the same EngineeringSession and spatial scene as the mechanical runtime");
    }
    this.#sequence = this.#restoreCommandSequence();
    this.session.commands.register(MECHANICAL_ROTARY_SAVE_NAMED_POSITION_COMMAND, (command) =>
      this.#executeSave(command as StudioCommand<MechanicalRotaryNamedPositionPayload>)
    );
    this.session.commands.register(MECHANICAL_ROTARY_GO_TO_NAMED_POSITION_COMMAND, (command) =>
      this.#executeGoTo(command as StudioCommand<MechanicalRotaryNamedPositionPayload>)
    );
    this.session.commands.register(MECHANICAL_ROTARY_DELETE_NAMED_POSITION_COMMAND, (command) =>
      this.#executeDelete(command as StudioCommand<MechanicalRotaryNamedPositionPayload>)
    );
  }

  async savePosition(
    relationshipId: string,
    name: string,
    source: StudioCommand["source"] = "ui"
  ): Promise<CommandResult<MechanicalRotaryNamedPositionResult>> {
    const normalized = normalizePositionName(name);
    return this.session.commands.dispatch<MechanicalRotaryNamedPositionResult>({
      id: this.#nextCommandId(),
      type: MECHANICAL_ROTARY_SAVE_NAMED_POSITION_COMMAND,
      payload: { relationshipId, name: normalized.name },
      source,
      issuedAt: new Date().toISOString()
    });
  }

  async goToPosition(
    relationshipId: string,
    name: string,
    source: StudioCommand["source"] = "ui"
  ): Promise<CommandResult<MechanicalRotaryCommandResult>> {
    const normalized = normalizePositionName(name);
    return this.session.commands.dispatch<MechanicalRotaryCommandResult>({
      id: this.#nextCommandId(),
      type: MECHANICAL_ROTARY_GO_TO_NAMED_POSITION_COMMAND,
      payload: { relationshipId, name: normalized.name },
      source,
      issuedAt: new Date().toISOString()
    });
  }

  async deletePosition(
    relationshipId: string,
    name: string,
    source: StudioCommand["source"] = "ui"
  ): Promise<CommandResult<MechanicalRotaryNamedPositionResult>> {
    const normalized = normalizePositionName(name);
    return this.session.commands.dispatch<MechanicalRotaryNamedPositionResult>({
      id: this.#nextCommandId(),
      type: MECHANICAL_ROTARY_DELETE_NAMED_POSITION_COMMAND,
      payload: { relationshipId, name: normalized.name },
      source,
      issuedAt: new Date().toISOString()
    });
  }

  positions(relationshipId: string): readonly MechanicalRotaryNamedPosition[] {
    const relationship = this.#resolveRelationship(relationshipId);
    return namedPositionsFromRelationship(relationship)?.positions ?? [];
  }

  position(relationshipId: string, name: string): MechanicalRotaryNamedPosition | null {
    const normalized = normalizePositionName(name);
    return this.positions(relationshipId).find((entry) => entry.key === normalized.key) ?? null;
  }

  #resolveRelationship(relationshipId: string): EngineeringRelationship {
    this.mechanical.kinematics(relationshipId);
    const relationship = this.session.graph.snapshot().relationships.find((entry) => entry.id === relationshipId);
    if (!relationship) throw new Error(`Mechanical rotary named position relationship not found: ${relationshipId}`);
    return relationship;
  }

  #executeSave(command: StudioCommand<MechanicalRotaryNamedPositionPayload>): MechanicalRotaryNamedPositionResult {
    const normalized = normalizePositionName(command.payload.name);
    const relationship = this.#resolveRelationship(command.payload.relationshipId);
    const currentContinuousRadians = this.mechanical.kinematics(command.payload.relationshipId).continuousRadians;
    const document = namedPositionsFromRelationship(relationship);
    const previous = document?.positions.find((entry) => entry.key === normalized.key) ?? null;
    const current: MechanicalRotaryNamedPosition = {
      key: normalized.key,
      name: normalized.name,
      continuousRadians: normalizeNearZero(currentContinuousRadians),
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
    const positions = [...(document?.positions ?? [])];
    const previousIndex = positions.findIndex((entry) => entry.key === normalized.key);
    if (previousIndex >= 0) positions[previousIndex] = current;
    else positions.push(current);
    const nextDocument: MechanicalRotaryNamedPositionsDocument = {
      version: 1,
      positions,
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
    this.session.graph.replaceRelationship({
      ...relationship,
      metadata: {
        ...relationship.metadata,
        rotaryNamedPositions: nextDocument
      }
    });
    const result: MechanicalRotaryNamedPositionResult = {
      commandId: command.id,
      relationshipId: command.payload.relationshipId,
      source: command.source,
      action: previous ? "updated" : "created",
      previous,
      current,
      currentContinuousRadians,
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
    this.#recordAuthoringEvidence(command, result);
    return result;
  }

  async #executeGoTo(command: StudioCommand<MechanicalRotaryNamedPositionPayload>): Promise<MechanicalRotaryCommandResult> {
    const normalized = normalizePositionName(command.payload.name);
    const position = this.position(command.payload.relationshipId, normalized.name);
    if (!position) throw new Error(`Mechanical rotary named position is not authored: ${normalized.name}`);
    const movement = await this.mechanical.setContinuousTarget(
      command.payload.relationshipId,
      position.continuousRadians,
      command.source
    );
    if (!movement.ok || !movement.result) {
      throw new Error(movement.error ?? `Mechanical rotary named position movement failed: ${normalized.name}`);
    }
    this.session.events.record({
      id: `event-${this.session.events.list().length + 1}`,
      type: "MechanicalRotaryNamedPositionRequested",
      occurredAt: command.issuedAt,
      source: command.source,
      payload: {
        commandId: command.id,
        movementCommandId: movement.result.commandId,
        relationshipId: command.payload.relationshipId,
        key: position.key,
        name: position.name,
        continuousRadians: position.continuousRadians,
        changed: movement.result.changed,
        signature: MECHANICAL_COMMAND_SIGNATURE
      }
    });
    return movement.result;
  }

  #executeDelete(command: StudioCommand<MechanicalRotaryNamedPositionPayload>): MechanicalRotaryNamedPositionResult {
    const normalized = normalizePositionName(command.payload.name);
    const relationship = this.#resolveRelationship(command.payload.relationshipId);
    const currentContinuousRadians = this.mechanical.kinematics(command.payload.relationshipId).continuousRadians;
    const document = namedPositionsFromRelationship(relationship);
    const previous = document?.positions.find((entry) => entry.key === normalized.key) ?? null;
    if (!previous) throw new Error(`Mechanical rotary named position is not authored: ${normalized.name}`);
    const positions = document!.positions.filter((entry) => entry.key !== normalized.key);
    const metadata: Record<string, unknown> = { ...relationship.metadata };
    if (positions.length === 0) delete metadata.rotaryNamedPositions;
    else {
      metadata.rotaryNamedPositions = {
        version: 1,
        positions,
        signature: MECHANICAL_COMMAND_SIGNATURE
      } satisfies MechanicalRotaryNamedPositionsDocument;
    }
    this.session.graph.replaceRelationship({ ...relationship, metadata });
    const result: MechanicalRotaryNamedPositionResult = {
      commandId: command.id,
      relationshipId: command.payload.relationshipId,
      source: command.source,
      action: "deleted",
      previous,
      current: null,
      currentContinuousRadians,
      signature: MECHANICAL_COMMAND_SIGNATURE
    };
    this.#recordAuthoringEvidence(command, result);
    return result;
  }

  #recordAuthoringEvidence(
    command: StudioCommand<MechanicalRotaryNamedPositionPayload>,
    result: MechanicalRotaryNamedPositionResult
  ): void {
    this.session.events.record({
      id: `event-${this.session.events.list().length + 1}`,
      type: result.action === "deleted" ? "MechanicalRotaryNamedPositionDeleted" : "MechanicalRotaryNamedPositionSaved",
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
      const match = /^mechanical-position-cmd-(\d+)$/.exec(commandId);
      if (match?.[1]) maximum = Math.max(maximum, Number(match[1]));
    }
    return maximum;
  }

  #nextCommandId(): string {
    this.#sequence += 1;
    return `mechanical-position-cmd-${this.#sequence}`;
  }
}

const runtimeCache = new WeakMap<EngineeringSession, InventionMechanicalRotaryNamedPositionsRuntime>();

export function mechanicalRotaryNamedPositionsRuntimeFor(spatial: InventionSpatialScene): InventionMechanicalRotaryNamedPositionsRuntime {
  const session = spatial.session;
  const existing = runtimeCache.get(session);
  if (existing) {
    if (existing.spatial !== spatial) throw new Error("Rotary named positions runtime already bound to another spatial scene for this session");
    return existing;
  }
  const runtime = new InventionMechanicalRotaryNamedPositionsRuntime(session, spatial);
  runtimeCache.set(session, runtime);
  return runtime;
}
