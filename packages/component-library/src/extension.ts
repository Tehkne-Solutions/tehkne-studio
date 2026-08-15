import {
  COMPONENT_LIBRARY_SIGNATURE,
  COMPONENT_LIBRARY_VERSION,
  parseComponentCatalog,
  validateComponentDefinition,
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

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseComponentCatalogExtension(input: unknown): ComponentCatalogExtension {
  if (!record(input)) throw new Error("Component catalog extension must be an object");
  if (typeof input.extensionId !== "string" || !input.extensionId.trim()) {
    throw new Error("Component catalog extensionId is required");
  }
  if (input.extensionVersion !== COMPONENT_LIBRARY_VERSION) {
    throw new Error(`Unsupported component catalog extensionVersion: ${String(input.extensionVersion)}`);
  }
  if (input.signature !== COMPONENT_LIBRARY_SIGNATURE) {
    throw new Error("Component catalog extension signature must be Tehkné Solutions");
  }
  if (!Array.isArray(input.components) || input.components.length === 0) {
    throw new Error("Component catalog extension cannot be empty");
  }

  const components: ComponentDefinition[] = [];
  for (const [index, definition] of input.components.entries()) {
    const errors = validateComponentDefinition(definition);
    if (errors.length > 0) {
      throw new Error(`Invalid component catalog extension component[${index}]: ${errors.join("; ")}`);
    }
    components.push(clone(definition as ComponentDefinition));
  }

  return {
    extensionId: input.extensionId,
    extensionVersion: COMPONENT_LIBRARY_VERSION,
    signature: COMPONENT_LIBRARY_SIGNATURE,
    components
  };
}

export function applyComponentCatalogExtension(
  base: ComponentCatalogManifest,
  input: unknown
): ComponentCatalogManifest {
  const extension = parseComponentCatalogExtension(input);
  const parsedBase = parseComponentCatalog(base);
  const baseIds = new Set(parsedBase.components.map((definition) => definition.definitionId));
  const extensionIds = new Set<string>();
  const appended: ComponentDefinition[] = [];

  for (const definition of extension.components) {
    if (baseIds.has(definition.definitionId)) {
      throw new Error(`Component catalog extension cannot replace existing definition: ${definition.definitionId}`);
    }
    if (extensionIds.has(definition.definitionId)) {
      throw new Error(`Component catalog extension repeats definition: ${definition.definitionId}`);
    }
    extensionIds.add(definition.definitionId);
    appended.push(clone(definition));
  }

  return parseComponentCatalog({
    catalogId: `${parsedBase.catalogId}+${extension.extensionId}`,
    catalogVersion: COMPONENT_LIBRARY_VERSION,
    signature: COMPONENT_LIBRARY_SIGNATURE,
    components: [...parsedBase.components.map(clone), ...appended]
  });
}
