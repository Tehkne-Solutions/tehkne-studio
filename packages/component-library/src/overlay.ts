import type { EngineeringPort } from "../../engineering-core/src/index.js";
import {
  COMPONENT_LIBRARY_SIGNATURE,
  COMPONENT_LIBRARY_VERSION,
  parseComponentCatalog,
  type ComponentCatalogManifest,
  type ProductFamily
} from "./index.js";

export interface ComponentCatalogOverlayMutation {
  readonly definitionId: string;
  readonly addProductFamilies?: readonly ProductFamily[];
  readonly addPorts?: Readonly<Record<string, EngineeringPort>>;
}

export interface ComponentCatalogOverlay {
  readonly overlayId: string;
  readonly overlayVersion: typeof COMPONENT_LIBRARY_VERSION;
  readonly signature: typeof COMPONENT_LIBRARY_SIGNATURE;
  readonly mutations: readonly ComponentCatalogOverlayMutation[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export function applyComponentCatalogOverlay(
  base: ComponentCatalogManifest,
  overlay: ComponentCatalogOverlay
): ComponentCatalogManifest {
  if (!overlay.overlayId.trim()) throw new Error("Component catalog overlayId is required");
  if (overlay.overlayVersion !== COMPONENT_LIBRARY_VERSION) {
    throw new Error(`Unsupported component catalog overlayVersion: ${overlay.overlayVersion}`);
  }
  if (overlay.signature !== COMPONENT_LIBRARY_SIGNATURE) {
    throw new Error("Component catalog overlay signature must be Tehkné Solutions");
  }
  if (overlay.mutations.length === 0) throw new Error("Component catalog overlay cannot be empty");

  const parsedBase = parseComponentCatalog(base);
  const definitions = new Map(parsedBase.components.map((definition) => [definition.definitionId, clone(definition)]));
  const mutated = new Set<string>();

  for (const mutation of overlay.mutations) {
    if (!mutation.definitionId.trim()) throw new Error("Component catalog overlay mutation definitionId is required");
    if (mutated.has(mutation.definitionId)) {
      throw new Error(`Component catalog overlay repeats definition mutation: ${mutation.definitionId}`);
    }
    mutated.add(mutation.definitionId);
    const definition = definitions.get(mutation.definitionId);
    if (!definition) throw new Error(`Component catalog overlay targets unknown definition: ${mutation.definitionId}`);

    const productFamilies = unique([
      ...definition.productFamilies,
      ...(mutation.addProductFamilies ?? [])
    ]);
    const ports = clone(definition.ports) as Record<string, EngineeringPort>;
    for (const [portId, port] of Object.entries(mutation.addPorts ?? {})) {
      if (port.id !== portId) throw new Error(`Overlay port ${portId} id must match its key`);
      if (ports[portId]) throw new Error(`Component catalog overlay cannot replace existing port: ${mutation.definitionId}.${portId}`);
      ports[portId] = clone(port);
    }
    definitions.set(mutation.definitionId, {
      ...definition,
      productFamilies,
      ports
    });
  }

  return parseComponentCatalog({
    catalogId: `${parsedBase.catalogId}+${overlay.overlayId}`,
    catalogVersion: COMPONENT_LIBRARY_VERSION,
    signature: COMPONENT_LIBRARY_SIGNATURE,
    components: parsedBase.components.map((definition) => definitions.get(definition.definitionId)!)
  });
}
