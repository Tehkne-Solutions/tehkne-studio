import {
  parseSessionSnapshot,
  serializeSessionSnapshot,
  type StudioSessionSnapshot
} from "../../../packages/persistence-runtime/src/index";

export type PersistedStudioProduct = "desktop" | "arm" | "smartphone" | "notebook" | "tablet" | "tv";
export type PersistedStudioWorkspace = PersistedStudioProduct | "electronics" | "invention";

const STORAGE_PREFIX = "tehkne-studio:s2.2:project:";

export function projectStorageKey(product: PersistedStudioWorkspace): string {
  return `${STORAGE_PREFIX}${product}`;
}

export function saveBrowserProject(product: PersistedStudioWorkspace, snapshot: StudioSessionSnapshot): void {
  window.localStorage.setItem(projectStorageKey(product), serializeSessionSnapshot(snapshot));
}

export function loadBrowserProject(product: PersistedStudioWorkspace): StudioSessionSnapshot | null {
  const serialized = window.localStorage.getItem(projectStorageKey(product));
  return serialized ? parseSessionSnapshot(serialized) : null;
}

export function browserProjectExists(product: PersistedStudioWorkspace): boolean {
  return window.localStorage.getItem(projectStorageKey(product)) !== null;
}

export function clearBrowserProject(product: PersistedStudioWorkspace): void {
  window.localStorage.removeItem(projectStorageKey(product));
}
