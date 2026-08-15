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

export function validateComponentCatalogExtension(
  base: ComponentCatalogManifest,
  extension: ComponentCatalogExtension
): string[] {
  const errors: string[] = [];
  if (!extension.extensionId.trim()) errors.push("Component catalog extensionId is required");
  if (extension.extensionVersion !== COMPONENT_LIBRARY_VERSION) {
    errors.push(`Unsupported component catalog extensionVersion: ${extension.extensionVersion}`);
  }
  if (extension.signature !== COMPONENT_LIBRARY_SIGNATURE) {
    errors.push("Component catalog extension signature must be Tehkné Solutions");
  }
  if (!Array.isArray(extension.components) || extension.components.length === 0) {
    errors.push("Component catalog extension cannot be empty");
    return errors;
  }

  const parsedBase = parseComponentCatalog(base);
  const baseIds = new Set(parsedBase.components.map((definition) => definition.definitionId));
  const extensionIds = new Set<string>();
  for (const [index, definition] of extension.components.entries()) {
    for (const error of validateComponentDefinition(definition)) {
      errors.push(`components[${index}]: ${error}`);
    }
    if (baseIds.has(definition.definitionId)) {
      errors.push(`Component catalog extension cannot replace existing definition: ${definition.definitionId}`);
    }
    if (extensionIds.has(definition.definitionId)) {
      errors.push(`Component catalog extension repeats definition: ${definition.definitionId}`);
    }
    extensionIds.add(definition.definitionId);
  }
  return errors;
}

export function applyComponentCatalogExtension(
  base: ComponentCatalogManifest,
  extension: ComponentCatalogExtension
): ComponentCatalogManifest {
  const parsedBase = parseComponentCatalog(base);
  const errors = validateComponentCatalogExtension(parsedBase, extension);
  if (errors.length > 0) throw new Error(`Invalid component catalog extension: ${errors.join("; ")}`);

  return parseComponentCatalog({
    catalogId: `${parsedBase.catalogId}+${extension.extensionId}`,
    catalogVersion: COMPONENT_LIBRARY_VERSION,
    signature: COMPONENT_LIBRARY_SIGNATURE,
    components: [
      ...parsedBase.components.map(clone),
      ...extension.components.map(clone)
    ]
  });
}
