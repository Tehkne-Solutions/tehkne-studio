import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/product-composition-runtime/src/index.ts",
  "packages/product-composition-runtime/src/tuning.ts",
  "packages/component-library/src/overlay.ts",
  "library/components/overlays/notebook-v1.json",
  "packages/notebook-runtime/src/index.ts",
  "presets/notebook-01/profile.json",
  "tests/domain/notebook-runtime.test.mjs",
  "apps/studio-web/components/NotebookAssembly.tsx",
  "tests/browser/notebook.spec.ts"
];
for (const path of required) await access(resolve(path));

const composition = await readFile("packages/product-composition-runtime/src/index.ts", "utf8");
for (const token of [
  'PRODUCT_COMPOSITION_VERSION = "1"',
  'PRODUCT_COMPOSITION_SIGNATURE = "Tehkné Solutions"',
  "ProductCompositionProfile",
  "validateProductCompositionProfile",
  "materializeProductComposition",
  "portsAreCompatible",
  "registry.instantiate",
  "contextualTeardown",
  'validatedBy: "component-library"',
  "productCompositionVersion"
]) {
  if (!composition.includes(token)) throw new Error(`S2.5 product composition contract missing: ${token}`);
}
const tuning = await readFile("packages/product-composition-runtime/src/tuning.ts", "utf8");
for (const token of ["ProductSlotTuning", "applyProductSlotTuning", "setEngineeringProperty", "Product tuning targets unknown slot"]) {
  if (!tuning.includes(token)) throw new Error(`S2.5 product tuning contract missing: ${token}`);
}

const overlayRuntime = await readFile("packages/component-library/src/overlay.ts", "utf8");
for (const token of [
  "ComponentCatalogOverlay",
  "applyComponentCatalogOverlay",
  "Component catalog overlay signature must be Tehkné Solutions",
  "cannot replace existing port",
  "targets unknown definition",
  "parseComponentCatalog"
]) {
  if (!overlayRuntime.includes(token)) throw new Error(`S2.5 component overlay contract missing: ${token}`);
}

const overlay = JSON.parse(await readFile("library/components/overlays/notebook-v1.json", "utf8"));
if (overlay.overlayId !== "notebook-v1") throw new Error("S2.5 Notebook overlay identity mismatch");
if (overlay.overlayVersion !== "1") throw new Error("S2.5 Notebook overlay version mismatch");
if (overlay.signature !== "Tehkné Solutions") throw new Error("S2.5 Notebook overlay signature missing");
const overlayMutations = new Map(overlay.mutations.map((mutation) => [mutation.definitionId, mutation]));
if (!overlayMutations.get("display.oled.touch-v1")?.addProductFamilies?.includes("notebook")) throw new Error("S2.5 display Notebook overlay missing");
if (!overlayMutations.get("control.mcu.general-v1")?.addProductFamilies?.includes("notebook")) throw new Error("S2.5 input controller Notebook overlay missing");
const socPorts = overlayMutations.get("compute.soc.mobile-v1")?.addPorts ?? {};
for (const portId of ["thermal", "usb-host", "memory-ddr"]) {
  if (!socPorts[portId]) throw new Error(`S2.5 Notebook SoC overlay port missing: ${portId}`);
}

const smartphone = await readFile("packages/smartphone-runtime/src/index.ts", "utf8");
for (const token of [
  "materializeProductComposition",
  "validateProductCompositionProfile",
  "compositionProfile",
  'productFamily: "smartphone"',
  "createSmartphoneProject",
  'SMARTPHONE_SIGNATURE = "Tehkné Solutions"'
]) {
  if (!smartphone.includes(token)) throw new Error(`S2.5 Smartphone migration to shared composition missing: ${token}`);
}
if (smartphone.includes("registry.instantiate(")) throw new Error("S2.5 Smartphone must not duplicate component instantiation after generic composition extraction");
if (smartphone.includes("portsAreCompatible(")) throw new Error("S2.5 Smartphone must not duplicate interface validation after generic composition extraction");

const notebook = JSON.parse(await readFile("presets/notebook-01/profile.json", "utf8"));
if (notebook.compositionVersion !== "1") throw new Error("S2.5 Notebook composition version mismatch");
if (notebook.profileId !== "notebook-01-v1") throw new Error("S2.5 Notebook profile identity mismatch");
if (notebook.projectId !== "notebook-01") throw new Error("S2.5 Notebook project identity mismatch");
if (notebook.productFamily !== "notebook") throw new Error("S2.5 Notebook family mismatch");
if (notebook.signature !== "Tehkné Solutions") throw new Error("S2.5 Notebook signature missing");
if (notebook.root?.id !== "notebook.root" || notebook.root?.type !== "Notebook") throw new Error("S2.5 Notebook root contract invalid");
if (notebook.boot?.id !== "notebook.boot") throw new Error("S2.5 Notebook boot contract invalid");
if (notebook.slots?.length !== 12) throw new Error(`S2.5 Notebook requires 12 component slots, got ${notebook.slots?.length}`);
if (notebook.connections?.length !== 17) throw new Error(`S2.5 Notebook requires 17 connections, got ${notebook.connections?.length}`);
if (notebook.bootDependencies?.length !== 6) throw new Error("S2.5 Notebook boot dependency count changed unexpectedly");
if (notebook.tuning?.length !== 7) throw new Error("S2.5 Notebook tuning count changed unexpectedly");
const slots = new Map(notebook.slots.map((slot) => [slot.slotId, slot]));
for (const [slotId, definitionId] of Object.entries({
  frame: "structural.frame.modular-v1",
  battery: "energy.battery.lithium-ion-v1",
  regulator: "power.regulator.dc-v1",
  soc: "compute.soc.mobile-v1",
  memory: "memory.ddr.module-v1",
  storage: "storage.solid-state.general-v1",
  display: "display.oled.touch-v1",
  cooling: "thermal.cooling.compact-v1",
  wireless: "communication.wireless.combo-v1",
  camera: "sensing.camera.rgb-v1",
  input: "control.mcu.general-v1",
  usbC: "interface.usb-c.port-v1"
})) {
  if (slots.get(slotId)?.definitionId !== definitionId) throw new Error(`S2.5 canonical Notebook slot mismatch: ${slotId}`);
}
for (const serviceable of ["battery", "memory", "storage"]) {
  if (slots.get(serviceable)?.teardown !== true) throw new Error(`S2.5 Notebook serviceable slot must remain teardown-capable: ${serviceable}`);
}

const notebookRuntime = await readFile("packages/notebook-runtime/src/index.ts", "utf8");
for (const token of [
  'NOTEBOOK_SIGNATURE = "Tehkné Solutions"',
  "NotebookPresetProfile",
  "createNotebookRegistry",
  "applyComponentCatalogOverlay",
  "validateNotebookProfile",
  "createNotebookProject",
  "applyProductSlotTuning",
  "Invalid notebook profile"
]) {
  if (!notebookRuntime.includes(token)) throw new Error(`S2.5 Notebook runtime contract missing: ${token}`);
}

const domain = await readFile("tests/domain/notebook-runtime.test.mjs", "utf8");
for (const token of [
  "extends the catalog without mutating the S2.3 base",
  "materializes 12 reusable components with 17 validated connections",
  "DDR teardown produces causal POST failure",
  "battery remains a second independent causal teardown point",
  "cannot materialize against the unextended S2.3 catalog",
  "tuning remains bounded by Engineering Property constraints"
]) {
  if (!domain.includes(token)) throw new Error(`S2.5 Notebook domain evidence missing: ${token}`);
}

const assembly = await readFile("apps/studio-web/components/NotebookAssembly.tsx", "utf8");
for (const token of [
  "NotebookAssembly",
  'session.getEntity("notebook.root")',
  'entity.metadata.spatial',
  'root.state === "exploded"',
  'entity.state === "removed"',
  'entity.id === "notebook.memory"',
  "createSpatialBinding",
  "resolveSpatialSelection"
]) {
  if (!assembly.includes(token)) throw new Error(`S2.5 Notebook spatial UX missing: ${token}`);
}

const browser = await readFile("tests/browser/notebook.spec.ts", "utf8");
for (const token of [
  "Chamar Notebook 01",
  "Abra o notebook",
  "Tire a RAM",
  "Ligue o notebook",
  "Por que não iniciou?",
  "Reinstale a RAM",
  "POWER FAULT · BOOT POST",
  "POWER ON · BOOT RUNNING",
  "Restaurar Notebook salvo",
  "page.reload",
  "Component Library exposes Notebook overlay capabilities",
  "thermal.compute-spreader",
  "usb.usb-c",
  "memory.ddr"
]) {
  if (!browser.includes(token)) throw new Error(`S2.5 Notebook browser evidence missing: ${token}`);
}

const tsconfig = await readFile("tsconfig.core.json", "utf8");
for (const include of [
  "packages/product-composition-runtime/src/**/*.ts",
  "packages/notebook-runtime/src/**/*.ts"
]) {
  if (!tsconfig.includes(include)) throw new Error(`S2.5 core compile surface missing: ${include}`);
}

console.log("S2.5 Notebook structure PASS · shared product composition + signed overlay + 12 components + 17 connections · Tehkné Solutions");
