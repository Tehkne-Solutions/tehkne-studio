import {
  parseSessionSnapshot,
  serializeSessionSnapshot,
  type StudioSessionSnapshot
} from "../../../packages/persistence-runtime/src/index";
import {
  clearRotaryKinematicsProject,
  rotaryKinematicsDocumentForProject,
  stageRotaryKinematicsDocument
} from "../../../packages/invention-assembly-runtime/src/rotary-multiturn";

export type PersistedStudioProduct = "desktop" | "arm" | "smartphone" | "notebook" | "tablet" | "tv";
export type PersistedStudioWorkspace = PersistedStudioProduct | "electronics" | "invention";

const STORAGE_PREFIX = "tehkne-studio:s2.2:project:";

export function projectStorageKey(product: PersistedStudioWorkspace): string {
  return `${STORAGE_PREFIX}${product}`;
}

function inventionSnapshotWithRotaryKinematics(snapshot: StudioSessionSnapshot): StudioSessionSnapshot {
  const document = rotaryKinematicsDocumentForProject(snapshot.project.projectId);
  if (!document || document.entries.length === 0) return snapshot;
  const rotaryRelationshipIds = new Set(snapshot.project.relationships
    .filter((relationship) => relationship.type === "connectedTo" && relationship.metadata.inventionRuntime === true)
    .filter((relationship) => Array.isArray(relationship.metadata.sharedInterfaces) && relationship.metadata.sharedInterfaces.map(String).includes("mechanical.rotary-shaft"))
    .map((relationship) => relationship.id));
  const entries = document.entries.filter((entry) => rotaryRelationshipIds.has(entry.relationshipId));
  if (entries.length === 0) return snapshot;
  return {
    ...snapshot,
    extensions: {
      ...snapshot.extensions,
      inventionRotaryKinematics: { ...document, entries }
    }
  };
}

export function saveBrowserProject(product: PersistedStudioWorkspace, snapshot: StudioSessionSnapshot): void {
  const persisted = product === "invention" ? inventionSnapshotWithRotaryKinematics(snapshot) : snapshot;
  window.localStorage.setItem(projectStorageKey(product), serializeSessionSnapshot(persisted));
}

export function loadBrowserProject(product: PersistedStudioWorkspace): StudioSessionSnapshot | null {
  const serialized = window.localStorage.getItem(projectStorageKey(product));
  if (!serialized) return null;
  const snapshot = parseSessionSnapshot(serialized);
  if (product === "invention" && Object.prototype.hasOwnProperty.call(snapshot.extensions, "inventionRotaryKinematics")) {
    stageRotaryKinematicsDocument(snapshot.extensions.inventionRotaryKinematics);
  }
  return snapshot;
}

export function browserProjectExists(product: PersistedStudioWorkspace): boolean {
  return window.localStorage.getItem(projectStorageKey(product)) !== null;
}

export function clearBrowserProject(product: PersistedStudioWorkspace): void {
  if (product === "invention") {
    const serialized = window.localStorage.getItem(projectStorageKey(product));
    if (serialized) {
      try { clearRotaryKinematicsProject(parseSessionSnapshot(serialized).project.projectId); } catch {}
    }
  }
  window.localStorage.removeItem(projectStorageKey(product));
}
