import {
  ComponentRegistry,
  parseComponentCatalog,
  type ComponentCatalogManifest
} from "../../component-library/src/index.js";
import { applyComponentCatalogExtension } from "../../component-library/src/extension.js";
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

export const DISPLAY_SYSTEM_PROFILE_VERSION = "1" as const;
export const DISPLAY_SYSTEM_SIGNATURE = "Tehkné Solutions" as const;

export interface DisplaySystemPresetProfile extends ProductCompositionProfile {
  readonly productFamily: "display-system";
  readonly root: ProductCompositionProfile["root"] & { readonly type: "Television" };
  readonly tuning: readonly ProductSlotTuning[];
}

export interface DisplaySystemRegistryBundle {
  readonly catalog: ComponentCatalogManifest;
  readonly registry: ComponentRegistry;
}

export function createDisplaySystemRegistry(
  baseCatalog: unknown,
  extension: unknown,
  overlay: ComponentCatalogOverlay
): DisplaySystemRegistryBundle {
  const base = parseComponentCatalog(baseCatalog);
  const extended = applyComponentCatalogExtension(base, extension);
  const catalog = applyComponentCatalogOverlay(extended, overlay);
  return { catalog, registry: new ComponentRegistry(catalog) };
}

export function validateDisplaySystemProfile(
  profile: DisplaySystemPresetProfile,
  registry: ComponentRegistry
): string[] {
  const errors: string[] = [];
  if (profile.compositionVersion !== DISPLAY_SYSTEM_PROFILE_VERSION) errors.push(`display-system compositionVersion must be ${DISPLAY_SYSTEM_PROFILE_VERSION}`);
  if (profile.signature !== DISPLAY_SYSTEM_SIGNATURE) errors.push("display-system profile signature must be Tehkné Solutions");
  if (profile.productFamily !== "display-system") errors.push("display-system productFamily must be display-system");
  if (profile.root.type !== "Television") errors.push("display-system root type must be Television");
  for (const error of validateProductCompositionProfile(profile, registry)) {
    if (!errors.includes(error)) errors.push(error);
  }
  const tunedSlots = new Set<string>();
  for (const tuning of profile.tuning) {
    if (tunedSlots.has(tuning.slotId)) errors.push(`display-system tuning repeats slot: ${tuning.slotId}`);
    tunedSlots.add(tuning.slotId);
    if (!profile.slots.some((slot) => slot.slotId === tuning.slotId)) errors.push(`display-system tuning targets unknown slot: ${tuning.slotId}`);
  }
  return errors;
}

export function createDisplaySystemProject(
  profile: DisplaySystemPresetProfile,
  registry: ComponentRegistry
): ProductMaterializationResult {
  const errors = validateDisplaySystemProfile(profile, registry);
  if (errors.length > 0) throw new Error(`Invalid display-system profile: ${errors.join("; ")}`);
  try {
    return applyProductSlotTuning(materializeProductComposition(profile, registry), profile.tuning);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Display-system tuning failed";
    throw new Error(`Invalid display-system profile: ${message}`);
  }
}
