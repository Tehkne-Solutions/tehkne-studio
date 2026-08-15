import {
  ComponentRegistry,
  parseComponentCatalog,
  type ComponentCatalogManifest
} from "../../component-library/src/index.js";
import {
  applyComponentCatalogOverlay,
  type ComponentCatalogOverlay
} from "../../component-library/src/overlay.js";
import {
  materializeProductComposition,
  validateProductCompositionProfile,
  type ProductCompositionProfile,
  type ProductMaterializationResult
} from "../../product-composition-runtime/src/index.js";
import {
  applyProductSlotTuning,
  type ProductSlotTuning
} from "../../product-composition-runtime/src/tuning.js";

export const NOTEBOOK_PROFILE_VERSION = "1" as const;
export const NOTEBOOK_SIGNATURE = "Tehkné Solutions" as const;

export interface NotebookPresetProfile extends ProductCompositionProfile {
  readonly productFamily: "notebook";
  readonly root: ProductCompositionProfile["root"] & { readonly type: "Notebook" };
  readonly tuning: readonly ProductSlotTuning[];
}

export interface NotebookRegistryBundle {
  readonly catalog: ComponentCatalogManifest;
  readonly registry: ComponentRegistry;
}

export function createNotebookRegistry(
  baseCatalog: unknown,
  overlay: ComponentCatalogOverlay
): NotebookRegistryBundle {
  const base = parseComponentCatalog(baseCatalog);
  const catalog = applyComponentCatalogOverlay(base, overlay);
  return { catalog, registry: new ComponentRegistry(catalog) };
}

export function validateNotebookProfile(
  profile: NotebookPresetProfile,
  registry: ComponentRegistry
): string[] {
  const errors: string[] = [];
  if (profile.compositionVersion !== NOTEBOOK_PROFILE_VERSION) errors.push(`notebook compositionVersion must be ${NOTEBOOK_PROFILE_VERSION}`);
  if (profile.signature !== NOTEBOOK_SIGNATURE) errors.push("notebook profile signature must be Tehkné Solutions");
  if (profile.productFamily !== "notebook") errors.push("notebook profile productFamily must be notebook");
  if (profile.root.type !== "Notebook") errors.push("notebook root type must be Notebook");
  for (const error of validateProductCompositionProfile(profile, registry)) {
    if (!errors.includes(error)) errors.push(error);
  }
  const tunedSlots = new Set<string>();
  for (const tuning of profile.tuning) {
    if (tunedSlots.has(tuning.slotId)) errors.push(`notebook tuning repeats slot: ${tuning.slotId}`);
    tunedSlots.add(tuning.slotId);
    if (!profile.slots.some((slot) => slot.slotId === tuning.slotId)) errors.push(`notebook tuning targets unknown slot: ${tuning.slotId}`);
  }
  return errors;
}

export function createNotebookProject(
  profile: NotebookPresetProfile,
  registry: ComponentRegistry
): ProductMaterializationResult {
  const errors = validateNotebookProfile(profile, registry);
  if (errors.length > 0) throw new Error(`Invalid notebook profile: ${errors.join("; ")}`);
  try {
    return applyProductSlotTuning(materializeProductComposition(profile, registry), profile.tuning);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notebook tuning failed";
    throw new Error(`Invalid notebook profile: ${message}`);
  }
}
