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

export const TABLET_PROFILE_VERSION = "1" as const;
export const TABLET_SIGNATURE = "Tehkné Solutions" as const;

export interface TabletPresetProfile extends ProductCompositionProfile {
  readonly productFamily: "tablet";
  readonly root: ProductCompositionProfile["root"] & { readonly type: "Tablet" };
  readonly tuning: readonly ProductSlotTuning[];
}

export interface TabletRegistryBundle {
  readonly catalog: ComponentCatalogManifest;
  readonly registry: ComponentRegistry;
}

export function createTabletRegistry(
  baseCatalog: unknown,
  overlay: ComponentCatalogOverlay
): TabletRegistryBundle {
  const base = parseComponentCatalog(baseCatalog);
  const catalog = applyComponentCatalogOverlay(base, overlay);
  return { catalog, registry: new ComponentRegistry(catalog) };
}

export function validateTabletProfile(
  profile: TabletPresetProfile,
  registry: ComponentRegistry
): string[] {
  const errors: string[] = [];
  if (profile.compositionVersion !== TABLET_PROFILE_VERSION) errors.push(`tablet compositionVersion must be ${TABLET_PROFILE_VERSION}`);
  if (profile.signature !== TABLET_SIGNATURE) errors.push("tablet profile signature must be Tehkné Solutions");
  if (profile.productFamily !== "tablet") errors.push("tablet profile productFamily must be tablet");
  if (profile.root.type !== "Tablet") errors.push("tablet root type must be Tablet");
  for (const error of validateProductCompositionProfile(profile, registry)) {
    if (!errors.includes(error)) errors.push(error);
  }
  const tunedSlots = new Set<string>();
  for (const tuning of profile.tuning) {
    if (tunedSlots.has(tuning.slotId)) errors.push(`tablet tuning repeats slot: ${tuning.slotId}`);
    tunedSlots.add(tuning.slotId);
    if (!profile.slots.some((slot) => slot.slotId === tuning.slotId)) errors.push(`tablet tuning targets unknown slot: ${tuning.slotId}`);
  }
  return errors;
}

export function createTabletProject(
  profile: TabletPresetProfile,
  registry: ComponentRegistry
): ProductMaterializationResult {
  const errors = validateTabletProfile(profile, registry);
  if (errors.length > 0) throw new Error(`Invalid tablet profile: ${errors.join("; ")}`);
  try {
    return applyProductSlotTuning(materializeProductComposition(profile, registry), profile.tuning);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tablet tuning failed";
    throw new Error(`Invalid tablet profile: ${message}`);
  }
}
