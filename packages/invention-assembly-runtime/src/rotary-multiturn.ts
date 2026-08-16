import type { EngineeringSession } from "../../engineering-session/src/index.js";

export const ROTARY_MULTITURN_VERSION = "1" as const;
export const ROTARY_MULTITURN_SIGNATURE = "Tehkné Solutions" as const;
export const ROTARY_MULTITURN_EPSILON = 0.0001;
export const ROTARY_MULTITURN_MAX_STEP_RAD = Math.PI;

export interface RotaryKinematicsEntry {
  readonly relationshipId: string;
  readonly revolutions: number;
}

export interface RotaryKinematicsDocument {
  readonly version: typeof ROTARY_MULTITURN_VERSION;
  readonly signature: typeof ROTARY_MULTITURN_SIGNATURE;
  readonly projectId: string;
  readonly entries: readonly RotaryKinematicsEntry[];
}

const stateBySession = new WeakMap<EngineeringSession, RotaryKinematicsState>();
const latestStateByProject = new Map<string, RotaryKinematicsState>();
const stagedDocumentByProject = new Map<string, RotaryKinematicsDocument>();

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return value;
}

function principal(value: number, label: string): number {
  finite(value, label);
  const normalized = Math.atan2(Math.sin(value), Math.cos(value));
  if (Math.abs(value - normalized) > ROTARY_MULTITURN_EPSILON) {
    throw new Error(`${label} must be a principal angle in [-pi, pi]`);
  }
  return Math.abs(normalized) <= ROTARY_MULTITURN_EPSILON ? 0 : normalized;
}

function revolutionCount(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error("Rotary revolution count must be a safe integer");
  return value;
}

function parseEntry(value: unknown): RotaryKinematicsEntry {
  if (!value || typeof value !== "object") throw new Error("Invalid rotary kinematics entry");
  const candidate = value as Partial<RotaryKinematicsEntry>;
  if (typeof candidate.relationshipId !== "string" || !candidate.relationshipId) throw new Error("Invalid rotary kinematics relationshipId");
  const revolutions = revolutionCount(Number(candidate.revolutions));
  if (revolutions === 0) throw new Error("Rotary kinematics document must omit zero-revolution entries");
  return { relationshipId: candidate.relationshipId, revolutions };
}

export function parseRotaryKinematicsDocument(value: unknown): RotaryKinematicsDocument {
  if (!value || typeof value !== "object") throw new Error("Invalid rotary kinematics document");
  const candidate = value as Partial<RotaryKinematicsDocument>;
  if (candidate.version !== ROTARY_MULTITURN_VERSION) throw new Error(`Unsupported rotary kinematics version: ${String(candidate.version)}`);
  if (candidate.signature !== ROTARY_MULTITURN_SIGNATURE) throw new Error("Invalid rotary kinematics signature");
  if (typeof candidate.projectId !== "string" || !candidate.projectId) throw new Error("Invalid rotary kinematics projectId");
  if (!Array.isArray(candidate.entries)) throw new Error("Invalid rotary kinematics entries");
  const entries = candidate.entries.map(parseEntry);
  if (new Set(entries.map((entry) => entry.relationshipId)).size !== entries.length) throw new Error("Duplicate rotary kinematics relationship entry");
  return { version: ROTARY_MULTITURN_VERSION, signature: ROTARY_MULTITURN_SIGNATURE, projectId: candidate.projectId, entries };
}

export function rotaryJointUnwrappedAngle(principalAngle: number, revolutions: number): number {
  const angle = principal(principalAngle, "Rotary principal angle");
  const turns = revolutionCount(revolutions);
  return turns * Math.PI * 2 + angle;
}

export function advanceRotaryRevolutionCount(
  currentRevolutions: number,
  previousPrincipalAngle: number,
  nextPrincipalAngle: number,
  commandedDeltaRad: number,
  epsilon = ROTARY_MULTITURN_EPSILON
): number {
  const turns = revolutionCount(currentRevolutions);
  const previous = principal(previousPrincipalAngle, "Previous rotary principal angle");
  const next = principal(nextPrincipalAngle, "Next rotary principal angle");
  const delta = finite(commandedDeltaRad, "Rotary commanded delta");
  if (!Number.isFinite(epsilon) || epsilon < 0) throw new Error("Rotary multi-turn epsilon must be finite and non-negative");
  if (Math.abs(delta) > ROTARY_MULTITURN_MAX_STEP_RAD + epsilon) {
    throw new Error("Rotary multi-turn step must remain at or below pi; larger motion requires explicit segmented commands");
  }

  const beforeUnwrapped = rotaryJointUnwrappedAngle(previous, turns);
  const expectedUnwrapped = beforeUnwrapped + delta;
  const rawTurnCount = (expectedUnwrapped - next) / (Math.PI * 2);
  const nextTurns = Math.round(rawTurnCount);
  if (!Number.isSafeInteger(nextTurns) || Math.abs(rawTurnCount - nextTurns) > Math.max(epsilon, 0.000001)) {
    throw new Error("Rotary multi-turn transition cannot resolve an integer revolution count from the commanded geometric step");
  }

  const afterUnwrapped = rotaryJointUnwrappedAngle(next, nextTurns);
  if (Math.abs(afterUnwrapped - expectedUnwrapped) > Math.max(epsilon, Math.abs(delta) * 0.001)) {
    throw new Error("Rotary multi-turn transition does not match the commanded geometric step");
  }
  return nextTurns;
}

export class RotaryKinematicsState {
  readonly #revolutions = new Map<string, number>();

  constructor(readonly session: EngineeringSession, document?: RotaryKinematicsDocument) {
    if (session.project.projectType !== "invention") throw new Error("RotaryKinematicsState requires an invention project");
    if (!document) return;
    if (document.projectId !== session.project.projectId) throw new Error("Rotary kinematics document belongs to another project");
    for (const entry of document.entries) {
      this.#assertRotaryRelationship(entry.relationshipId);
      this.#revolutions.set(entry.relationshipId, revolutionCount(entry.revolutions));
    }
  }

  revolutions(relationshipId: string): number {
    this.#assertRotaryRelationship(relationshipId);
    return this.#revolutions.get(relationshipId) ?? 0;
  }

  setRevolutions(relationshipId: string, revolutions: number): number {
    this.#assertRotaryRelationship(relationshipId);
    const next = revolutionCount(revolutions);
    if (next === 0) this.#revolutions.delete(relationshipId);
    else this.#revolutions.set(relationshipId, next);
    return next;
  }

  clear(relationshipId: string): void {
    this.#revolutions.delete(relationshipId);
  }

  document(): RotaryKinematicsDocument {
    this.pruneDisconnected();
    const entries = [...this.#revolutions.entries()].map(([relationshipId, revolutions]) => ({ relationshipId, revolutions }))
      .sort((left, right) => left.relationshipId.localeCompare(right.relationshipId));
    return {
      version: ROTARY_MULTITURN_VERSION,
      signature: ROTARY_MULTITURN_SIGNATURE,
      projectId: this.session.project.projectId,
      entries
    };
  }

  pruneDisconnected(): void {
    for (const relationshipId of this.#revolutions.keys()) {
      if (!this.#isRotaryRelationship(relationshipId)) this.#revolutions.delete(relationshipId);
    }
  }

  #isRotaryRelationship(relationshipId: string): boolean {
    const relationship = this.session.graph.snapshot().relationships.find((entry) => entry.id === relationshipId);
    if (!relationship || relationship.type !== "connectedTo" || relationship.metadata.inventionRuntime !== true) return false;
    const interfaces = Array.isArray(relationship.metadata.sharedInterfaces) ? relationship.metadata.sharedInterfaces.map(String) : [];
    return interfaces.includes("mechanical.rotary-shaft");
  }

  #assertRotaryRelationship(relationshipId: string): void {
    if (!this.#isRotaryRelationship(relationshipId)) {
      throw new Error(`Rotary kinematics requires an authoritative mechanical.rotary-shaft connectedTo relationship: ${relationshipId}`);
    }
  }
}

export function stageRotaryKinematicsDocument(value: unknown): RotaryKinematicsDocument {
  const document = parseRotaryKinematicsDocument(value);
  stagedDocumentByProject.set(document.projectId, document);
  return document;
}

export function rotaryKinematicsStateForSession(session: EngineeringSession): RotaryKinematicsState {
  const existing = stateBySession.get(session);
  if (existing) return existing;
  const staged = stagedDocumentByProject.get(session.project.projectId);
  const state = new RotaryKinematicsState(session, staged);
  stateBySession.set(session, state);
  latestStateByProject.set(session.project.projectId, state);
  stagedDocumentByProject.delete(session.project.projectId);
  return state;
}

export function rotaryKinematicsDocumentForProject(projectId: string): RotaryKinematicsDocument | null {
  const state = latestStateByProject.get(projectId);
  if (state) return state.document();
  return stagedDocumentByProject.get(projectId) ?? null;
}

export function clearRotaryKinematicsProject(projectId: string): void {
  latestStateByProject.delete(projectId);
  stagedDocumentByProject.delete(projectId);
}
