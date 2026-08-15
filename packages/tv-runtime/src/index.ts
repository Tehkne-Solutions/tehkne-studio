import {
  ComponentRegistry,
  parseComponentCatalog,
  type ComponentCatalogManifest
} from "../../component-library/src/index.js";
import {
  applyComponentCatalogExtension,
  type ComponentCatalogExtension
} from "../../component-library/src/extension.js";
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

export const TV_PROFILE_VERSION = "1" as const;
export const TV_SIGNATURE = "Tehkné Solutions" as const;

export interface TvPresetProfile extends ProductCompositionProfile {
  readonly productFamily: "display-system";
  readonly root: ProductCompositionProfile["root"] & { readonly type: "Television" };
  readonly tuning: readonly ProductSlotTuning[];
}

export interface TvRegistryBundle {
  readonly catalog: ComponentCatalogManifest;
  readonly registry: ComponentRegistry;
}

export function createTvRegistry(
  baseCatalog: unknown,
  extension: ComponentCatalogExtension,
  overlay: ComponentCatalogOverlay
): TvRegistryBundle {
  const base = parseComponentCatalog(baseCatalog);
  const extended = applyComponentCatalogExtension(base, extension);
  const catalog = applyComponentCatalogOverlay(extended, overlay);
  return { catalog, registry: new ComponentRegistry(catalog) };
}

export function validateTvProfile(
  profile: TvPresetProfile,
  registry: ComponentRegistry
): string[] {
  const errors: string[] = [];
  if (profile.compositionVersion !== TV_PROFILE_VERSION) errors.push(`TV compositionVersion must be ${TV_PROFILE_VERSION}`);
  if (profile.signature !== TV_SIGNATURE) errors.push("TV profile signature must be Tehkné Solutions");
  if (profile.productFamily !== "display-system") errors.push("TV productFamily must be display-system");
  if (profile.root.type !== "Television") errors.push("TV root type must be Television");
  for (const error of validateProductCompositionProfile(profile, registry)) {
    if (!errors.includes(error)) errors.push(error);
  }
  const tunedSlots = new Set<string>();
  for (const tuning of profile.tuning) {
    if (tunedSlots.has(tuning.slotId)) errors.push(`TV tuning repeats slot: ${tuning.slotId}`);
    tunedSlots.add(tuning.slotId);
    if (!profile.slots.some((slot) => slot.slotId === tuning.slotId)) errors.push(`TV tuning targets unknown slot: ${tuning.slotId}`);
  }
  return errors;
}

export function createTvProject(
  profile: TvPresetProfile,
  registry: ComponentRegistry
): ProductMaterializationResult {
  const errors = validateTvProfile(profile, registry);
  if (errors.length > 0) throw new Error(`Invalid TV profile: ${errors.join("; ")}`);
  try {
    return applyProductSlotTuning(materializeProductComposition(profile, registry), profile.tuning);
  } catch (error) {
    const message = error instanceof Error ? error.message : "TV tuning failed";
    throw new Error(`Invalid TV profile: ${message}`);
  }
}
