import type { BehaviorDefinition } from "../../behavior-runtime/src/index.js";
import type { StudioDomainEvent } from "../../observability/src/index.js";
import {
  TEHKNE_STUDIO_SCHEMA_VERSION,
  validateProject,
  type TehkneStudioProject
} from "../../project-format/src/index.js";
import {
  EngineeringSession,
  type SemanticHistoryEntry
} from "../../engineering-session/src/index.js";

export const TEHKNE_STUDIO_PERSISTENCE_VERSION = "1" as const;
export const TEHKNE_STUDIO_PERSISTENCE_FORMAT = "tehkne-studio-session" as const;
export const TEHKNE_STUDIO_SIGNATURE = "Tehkné Solutions" as const;

export type PersistenceExtensionValue = unknown;
export type PersistenceExtensions = Readonly<Record<string, PersistenceExtensionValue>>;

export interface StudioSessionSnapshot<TExtensions extends PersistenceExtensions = PersistenceExtensions> {
  readonly format: typeof TEHKNE_STUDIO_PERSISTENCE_FORMAT;
  readonly persistenceVersion: typeof TEHKNE_STUDIO_PERSISTENCE_VERSION;
  readonly schemaVersion: typeof TEHKNE_STUDIO_SCHEMA_VERSION;
  readonly snapshotId: string;
  readonly savedAt: string;
  readonly signature: typeof TEHKNE_STUDIO_SIGNATURE;
  readonly project: TehkneStudioProject;
  readonly history: readonly SemanticHistoryEntry[];
  readonly events: readonly StudioDomainEvent[];
  readonly extensions: TExtensions;
}

export interface CreateSessionSnapshotOptions<TExtensions extends PersistenceExtensions = PersistenceExtensions> {
  readonly behaviors?: readonly BehaviorDefinition[];
  readonly extensions?: TExtensions;
  readonly savedAt?: string;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertIsoDate(value: string, label: string): void {
  if (!value || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be an ISO-compatible timestamp`);
}

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
}

function assertSnapshot(snapshot: StudioSessionSnapshot): void {
  if (snapshot.format !== TEHKNE_STUDIO_PERSISTENCE_FORMAT) throw new Error(`Unsupported persistence format: ${snapshot.format}`);
  if (snapshot.persistenceVersion !== TEHKNE_STUDIO_PERSISTENCE_VERSION) {
    throw new Error(`Unsupported persistenceVersion: ${snapshot.persistenceVersion}`);
  }
  if (snapshot.schemaVersion !== TEHKNE_STUDIO_SCHEMA_VERSION) throw new Error(`Unsupported schemaVersion: ${snapshot.schemaVersion}`);
  if (snapshot.signature !== TEHKNE_STUDIO_SIGNATURE) throw new Error("Invalid Tehkné Studio persistence signature");
  if (!snapshot.snapshotId.trim()) throw new Error("snapshotId is required");
  assertIsoDate(snapshot.savedAt, "savedAt");

  const projectErrors = validateProject(snapshot.project);
  if (projectErrors.length > 0) throw new Error(`Invalid persisted project: ${projectErrors.join("; ")}`);
  if (snapshot.project.schemaVersion !== snapshot.schemaVersion) throw new Error("Snapshot/project schemaVersion mismatch");

  const entityIds = new Set(snapshot.project.entities.map((entity) => entity.id));
  const historyIds = new Set<string>();
  for (const entry of snapshot.history) {
    if (!entry.id?.trim()) throw new Error("Persisted history entry id is required");
    if (historyIds.has(entry.id)) throw new Error(`Duplicate persisted history id: ${entry.id}`);
    historyIds.add(entry.id);
    if (!entityIds.has(entry.targetId)) throw new Error(`Persisted history target is missing: ${entry.targetId}`);
    assertIsoDate(entry.occurredAt, `history ${entry.id}.occurredAt`);
  }

  const eventIds = new Set<string>();
  for (const event of snapshot.events) {
    if (!event.id?.trim() || !event.type?.trim() || !event.source?.trim()) throw new Error("Persisted event identity is incomplete");
    if (eventIds.has(event.id)) throw new Error(`Duplicate persisted event id: ${event.id}`);
    eventIds.add(event.id);
    assertIsoDate(event.occurredAt, `event ${event.id}.occurredAt`);
  }

  assertRecord(snapshot.extensions, "extensions");
  try {
    JSON.stringify(snapshot.extensions);
  } catch {
    throw new Error("Persistence extensions must be JSON serializable");
  }
}

function currentProject(
  session: EngineeringSession,
  behaviors: readonly BehaviorDefinition[] | undefined
): TehkneStudioProject {
  const graph = session.graph.snapshot();
  return {
    ...session.project,
    entities: jsonClone(graph.entities),
    relationships: jsonClone(graph.relationships),
    ...(behaviors ? { behaviors: jsonClone(behaviors) } : session.project.behaviors ? { behaviors: jsonClone(session.project.behaviors) } : {}),
    metadata: jsonClone(session.project.metadata)
  };
}

export function createSessionSnapshot<TExtensions extends PersistenceExtensions = PersistenceExtensions>(
  session: EngineeringSession,
  options: CreateSessionSnapshotOptions<TExtensions> = {}
): StudioSessionSnapshot<TExtensions> {
  const savedAt = options.savedAt ?? new Date().toISOString();
  assertIsoDate(savedAt, "savedAt");
  const project = currentProject(session, options.behaviors);
  const snapshot: StudioSessionSnapshot<TExtensions> = {
    format: TEHKNE_STUDIO_PERSISTENCE_FORMAT,
    persistenceVersion: TEHKNE_STUDIO_PERSISTENCE_VERSION,
    schemaVersion: TEHKNE_STUDIO_SCHEMA_VERSION,
    snapshotId: `${project.projectId}:${savedAt}`,
    savedAt,
    signature: TEHKNE_STUDIO_SIGNATURE,
    project,
    history: jsonClone(session.history()),
    events: jsonClone(session.events.list()),
    extensions: jsonClone((options.extensions ?? {}) as TExtensions)
  };
  assertSnapshot(snapshot);
  return snapshot;
}

export function serializeSessionSnapshot(snapshot: StudioSessionSnapshot): string {
  assertSnapshot(snapshot);
  return JSON.stringify(snapshot);
}

export function parseSessionSnapshot(serialized: string): StudioSessionSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("Persisted Tehkné Studio session is not valid JSON");
  }
  assertRecord(parsed, "snapshot");
  assertSnapshot(parsed as unknown as StudioSessionSnapshot);
  return jsonClone(parsed as unknown as StudioSessionSnapshot);
}

class RestoredEngineeringSession extends EngineeringSession {
  readonly #persistedHistory: readonly SemanticHistoryEntry[];
  readonly #resumeToken: string;

  constructor(snapshot: StudioSessionSnapshot) {
    super(snapshot.project);
    this.#persistedHistory = jsonClone(snapshot.history);
    this.#resumeToken = snapshot.snapshotId.replace(/[^a-zA-Z0-9_-]+/g, "-");
    for (const event of snapshot.events) this.events.record(jsonClone(event));
  }

  override history(): readonly SemanticHistoryEntry[] {
    const resumed = super.history().map((entry) => ({
      ...entry,
      id: `resumed-${this.#resumeToken}-${entry.id}`,
      commandId: `resumed-${this.#resumeToken}-${entry.commandId}`
    }));
    return [...this.#persistedHistory, ...resumed];
  }
}

export function restoreSessionSnapshot(snapshot: StudioSessionSnapshot): EngineeringSession {
  assertSnapshot(snapshot);
  return new RestoredEngineeringSession(jsonClone(snapshot));
}
