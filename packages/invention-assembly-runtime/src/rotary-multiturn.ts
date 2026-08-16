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
  return Object.is(normalized, -0) ? 0 : normalized;
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
  if (Math.abs(delta) >= ROTARY_MULTITURN_MAX_STEP_RAD - epsilon) {
    throw new Error("Rotary multi-turn step must remain below pi to resolve revolution direction unambiguously");
  }

  let nextTurns = turns;
  const principalJump = next - previous;
  if (delta > epsilon && principalJump < -Math.PI) nextTurns += 1;
  if (delta < -epsilon && principalJump > Math.PI) nextTurns -= 1;

  const beforeUnwrapped = rotaryJointUnwrappedAngle(previous, turns);
  const afterUnwrapped = rotaryJointUnwrappedAngle(next, nextTurns);
  if (Math.abs((afterUnwrapped - beforeUnwrapped) - delta) > Math.max(epsilon, Math.abs(delta) * 0.001)) {
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
    const entries = [...this.#revolutions.entries()].map(([relationshipId, revolutions]) => {
      this.#assertRotaryRelationship(relationshipId);
      return { relationshipId, revolutions };
    }).sort((left, right) => left.relationshipId.localeCompare(right.relationshipId));
    return {
      version: ROTARY_MULTITURN_VERSION,
      signature: ROTARY_MULTITURN_SIGNATURE,
      projectId: this.session.project.projectId,
      entries
    };
  }

  #assertRotaryRelationship(relationshipId: string): void {
    const relationship = this.session.graph.snapshot().relationships.find((entry) => entry.id === relationshipId);
    if (!relationship || relationship.type !== "connectedTo" || relationship.metadata.inventionRuntime !== true) {
      throw new Error(`Rotary kinematics requires an authoritative invention connectedTo relationship: ${relationshipId}`);
    }
    const interfaces = Array.isArray(relationship.metadata.sharedInterfaces) ? relationship.metadata.sharedInterfaces.map(String) : [];
    if (!interfaces.includes("mechanical.rotary-shaft")) throw new Error(`Rotary kinematics requires mechanical.rotary-shaft: ${relationshipId}`);
  }
}
