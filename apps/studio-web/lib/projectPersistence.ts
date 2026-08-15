import {
  parseSessionSnapshot,
  serializeSessionSnapshot,
  type StudioSessionSnapshot
} from "../../../packages/persistence-runtime/src/index";

export type PersistedStudioProduct = "desktop" | "arm" | "smartphone" | "notebook" | "tablet" | "tv";

const STORAGE_PREFIX = "tehkne-studio:s2.2:project:";

export function projectStorageKey(product: PersistedStudioProduct): string {
  return `${STORAGE_PREFIX}${product}`;
}

export function saveBrowserProject(product: PersistedStudioProduct, snapshot: StudioSessionSnapshot): void {
  window.localStorage.setItem(projectStorageKey(product), serializeSessionSnapshot(snapshot));
}

export function loadBrowserProject(product: PersistedStudioProduct): StudioSessionSnapshot | null {
  const serialized = window.localStorage.getItem(projectStorageKey(product));
  return serialized ? parseSessionSnapshot(serialized) : null;
}

export function browserProjectExists(product: PersistedStudioProduct): boolean {
  return window.localStorage.getItem(projectStorageKey(product)) !== null;
}

export function clearBrowserProject(product: PersistedStudioProduct): void {
  window.localStorage.removeItem(projectStorageKey(product));
}
