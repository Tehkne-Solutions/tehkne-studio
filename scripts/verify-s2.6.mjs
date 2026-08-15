import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "library/components/overlays/tablet-v1.json",
  "packages/tablet-runtime/src/index.ts",
  "presets/tablet-01/profile.json",
  "tests/domain/tablet-runtime.test.mjs",
  "apps/studio-web/components/TabletAssembly.tsx",
  "tests/browser/tablet.spec.ts"
];
for (const path of required) await access(resolve(path));

const overlay = JSON.parse(await readFile("library/components/overlays/tablet-v1.json", "utf8"));
if (overlay.overlayId !== "tablet-v1") throw new Error("S2.6 Tablet overlay identity mismatch");
if (overlay.overlayVersion !== "1") throw new Error("S2.6 Tablet overlay version mismatch");
if (overlay.signature !== "Tehkné Solutions") throw new Error("S2.6 Tablet overlay signature missing");
if (overlay.mutations?.length !== 1) throw new Error("S2.6 Tablet overlay must remain minimal");
if (overlay.mutations[0]?.definitionId !== "control.mcu.general-v1") throw new Error("S2.6 Tablet overlay must target the general MCU only");
if (!overlay.mutations[0]?.addProductFamilies?.includes("tablet")) throw new Error("S2.6 Tablet MCU family extension missing");

const profile = JSON.parse(await readFile("presets/tablet-01/profile.json", "utf8"));
if (profile.compositionVersion !== "1") throw new Error("S2.6 Tablet composition version mismatch");
if (profile.profileId !== "tablet-01-v1") throw new Error("S2.6 Tablet profile identity mismatch");
if (profile.projectId !== "tablet-01") throw new Error("S2.6 Tablet project identity mismatch");
if (profile.productFamily !== "tablet") throw new Error("S2.6 Tablet family mismatch");
if (profile.signature !== "Tehkné Solutions") throw new Error("S2.6 Tablet signature missing");
if (profile.root?.id !== "tablet.root" || profile.root?.type !== "Tablet") throw new Error("S2.6 Tablet root contract invalid");
if (profile.boot?.id !== "tablet.boot") throw new Error("S2.6 Tablet boot contract invalid");
if (profile.slots?.length !== 12) throw new Error(`S2.6 Tablet requires 12 component slots, got ${profile.slots?.length}`);
if (profile.connections?.length !== 17) throw new Error(`S2.6 Tablet requires 17 connections, got ${profile.connections?.length}`);
if (profile.bootDependencies?.length !== 6) throw new Error("S2.6 Tablet boot dependency count changed unexpectedly");
if (profile.tuning?.length !== 7) throw new Error("S2.6 Tablet tuning count changed unexpectedly");
const slots = new Map(profile.slots.map((slot) => [slot.slotId, slot]));
for (const [slotId, definitionId] of Object.entries({
  frame: "structural.frame.modular-v1",
  battery: "energy.battery.lithium-ion-v1",
  regulator: "power.regulator.dc-v1",
  soc: "compute.soc.mobile-v1",
  memory: "memory.lpddr.package-v1",
  storage: "storage.solid-state.general-v1",
  display: "display.oled.touch-v1",
  imu: "sensing.imu.6dof-v1",
  camera: "sensing.camera.rgb-v1",
  wireless: "communication.wireless.combo-v1",
  input: "control.mcu.general-v1",
  usbC: "interface.usb-c.port-v1"
})) {
  if (slots.get(slotId)?.definitionId !== definitionId) throw new Error(`S2.6 canonical Tablet slot mismatch: ${slotId}`);
}
if (slots.get("battery")?.teardown !== true) throw new Error("S2.6 Tablet battery must remain teardown-capable");

const runtime = await readFile("packages/tablet-runtime/src/index.ts", "utf8");
for (const token of [
  'TABLET_SIGNATURE = "Tehkné Solutions"',
  "TabletPresetProfile",
  "createTabletRegistry",
  "applyComponentCatalogOverlay",
  "validateTabletProfile",
  "createTabletProject",
  "materializeProductComposition",
  "applyProductSlotTuning",
  "Invalid tablet profile"
]) {
  if (!runtime.includes(token)) throw new Error(`S2.6 Tablet runtime contract missing: ${token}`);
}

const domain = await readFile("tests/domain/tablet-runtime.test.mjs", "utf8");
for (const token of [
  "adds only the missing tablet controller family",
  "materializes 12 reusable components with 17 validated connections",
  "battery teardown produces causal POST failure",
  "cannot materialize without its signed controller-family overlay",
  "tuning remains bounded by Engineering Property constraints",
  "touch controller bridges the SoC sensor bus"
]) {
  if (!domain.includes(token)) throw new Error(`S2.6 Tablet domain evidence missing: ${token}`);
}

const assembly = await readFile("apps/studio-web/components/TabletAssembly.tsx", "utf8");
for (const token of [
  "TabletAssembly",
  'session.getEntity("tablet.root")',
  "entity.metadata.spatial",
  'root.state === "exploded"',
  'entity.state === "removed"',
  'entity.id === "tablet.battery"',
  "createSpatialBinding",
  "resolveSpatialSelection"
]) {
  if (!assembly.includes(token)) throw new Error(`S2.6 Tablet spatial UX missing: ${token}`);
}

const workbench = await readFile("apps/studio-web/components/SpatialWorkbench.tsx", "utf8");
for (const token of [
  "createTabletRegistry",
  "createTabletProject",
  "createTabletRuntime",
  "tabletSession",
  "tabletIntelligence",
  "<TabletAssembly session={tabletSession}",
  "Chamar Tablet 01",
  "Restaurar Tablet salvo",
  'saveBrowserProject("tablet"',
  "looksTablet",
  'execution.targetEntityId?.startsWith("tablet.")',
  "TABLET-01",
  "POWER {tabletPowerState.toUpperCase()} · BOOT {tabletBootStage}"
]) {
  if (!workbench.includes(token)) throw new Error(`S2.6 Tablet Workbench integration missing: ${token}`);
}

const persistence = await readFile("apps/studio-web/lib/projectPersistence.ts", "utf8");
if (!persistence.includes('"tablet"')) throw new Error("S2.6 persistence adapter does not include tablet");

const libraryPanel = await readFile("apps/studio-web/components/ComponentLibraryPanel.tsx", "utf8");
for (const token of ["notebookOverlay", "tabletOverlay", "notebookCatalog", '"tablet"']) {
  if (!libraryPanel.includes(token)) throw new Error(`S2.6 overlay composition is not surfaced in Component Library UX: ${token}`);
}

const browser = await readFile("tests/browser/tablet.spec.ts", "utf8");
for (const token of [
  "Chamar Tablet 01",
  "Abra o tablet",
  "Inspecione a caneta",
  "Tire a bateria",
  "Ligue o tablet",
  "Por que não iniciou?",
  "Reinstale a bateria",
  "POWER FAULT · BOOT POST",
  "POWER ON · BOOT RUNNING",
  "Restaurar Tablet salvo",
  "page.reload",
  "Component Library exposes Tablet controller overlay"
]) {
  if (!browser.includes(token)) throw new Error(`S2.6 Tablet browser evidence missing: ${token}`);
}

const tsconfig = await readFile("tsconfig.core.json", "utf8");
if (!tsconfig.includes("packages/tablet-runtime/src/**/*.ts")) throw new Error("S2.6 Tablet runtime is not part of core typecheck/build");

console.log("S2.6 Tablet structure PASS · shared product composition + minimal signed overlay + 12 components + 17 connections + Workbench persistence · Tehkné Solutions");
