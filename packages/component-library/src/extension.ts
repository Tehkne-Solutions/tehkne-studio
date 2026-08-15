import {
  COMPONENT_LIBRARY_SIGNATURE,
  COMPONENT_LIBRARY_VERSION,
  parseComponentCatalog,
  type ComponentCatalogManifest,
  type ComponentDefinition
} from "./index.js";

export interface ComponentCatalogExtension {
  readonly extensionId: string;
  readonly extensionVersion: typeof COMPONENT_LIBRARY_VERSION;
  readonly signature: typeof COMPONENT_LIBRARY_SIGNATURE;
  readonly components: readonly ComponentDefinition[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function applyComponentCatalogExtension(
  base: ComponentCatalogManifest,
  extension: ComponentCatalogExtension
): ComponentCatalogManifest {
  if (!extension.extensionId.trim()) throw new Error("Component catalog extensionId is required");
  if (extension.extensionVersion !== COMPONENT_LIBRARY_VERSION) {
    throw new Error(`Unsupported component catalog extensionVersion: ${extension.extensionVersion}`);
  }
  if (extension.signature !== COMPONENT_LIBRARY_SIGNATURE) {
    throw new Error("Component catalog extension signature must be Tehkné Solutions");
  }
  if (extension.components.length === 0) throw new Error("Component catalog extension cannot be empty");

  const parsedBase = parseComponentCatalog(base);
  const existing = new Set(parsedBase.components.map((definition) => definition.definitionId));
  const added = new Set<string>();
  for (const definition of extension.components) {
    if (existing.has(definition.definitionId)) {
      throw new Error(`Component catalog extension cannot replace existing definition: ${definition.definitionId}`);
    }
    if (added.has(definition.definitionId)) {
      throw new Error(`Component catalog extension repeats definition: ${definition.definitionId}`);
    }
    added.add(definition.definitionId);
  }

  return parseComponentCatalog({
    catalogId: `${parsedBase.catalogId}+${extension.extensionId}`,
    catalogVersion: COMPONENT_LIBRARY_VERSION,
    signature: COMPONENT_LIBRARY_SIGNATURE,
    components: [...parsedBase.components.map(clone), ...extension.components.map(clone)]
  });
}
