import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/component-library/src/extension.ts",
  "library/components/extensions/display-system-v1.json",
  "library/components/overlays/display-system-v1.json",
  "packages/tv-runtime/src/index.ts",
  "presets/tv-01/profile.json",
  "tests/domain/tv-runtime.test.mjs",
  "apps/studio-web/components/TvAssembly.tsx",
  "tests/browser/tv.spec.ts"
];
for (const path of required) await access(resolve(path));

const extensionRuntime = await readFile("packages/component-library/src/extension.ts", "utf8");
for (const token of [
  "ComponentCatalogExtension",
  "applyComponentCatalogExtension",
  "Component catalog extension signature must be Tehkné Solutions",
  "cannot replace existing definition",
  "parseComponentCatalog"
]) {
  if (!extensionRuntime.includes(token)) throw new Error(`S2.7 Catalog Extension runtime missing: ${token}`);
}

const extension = JSON.parse(await readFile("library/components/extensions/display-system-v1.json", "utf8"));
if (extension.extensionId !== "display-system-v1") throw new Error("S2.7 display extension identity mismatch");
if (extension.extensionVersion !== "1") throw new Error("S2.7 display extension version mismatch");
if (extension.signature !== "Tehkné Solutions") throw new Error("S2.7 display extension signature missing");
if (extension.components?.length !== 5) throw new Error(`S2.7 display extension requires 5 canonical definitions, got ${extension.components?.length}`);
const addedIds = new Set(extension.components.map((definition) => definition.definitionId));
for (const id of [
  "power.ac-dc.supply-v1",
  "compute.media-controller.display-v1",
  "display.panel.large-oled-v1",
  "interface.hdmi.input-v1",
  "actuation.speaker.stereo-v1"
]) {
  if (!addedIds.has(id)) throw new Error(`S2.7 canonical display definition missing: ${id}`);
}

const overlay = JSON.parse(await readFile("library/components/overlays/display-system-v1.json", "utf8"));
if (overlay.overlayId !== "display-system-compat-v1") throw new Error("S2.7 display compatibility overlay identity mismatch");
if (overlay.overlayVersion !== "1") throw new Error("S2.7 display compatibility overlay version mismatch");
if (overlay.signature !== "Tehkné Solutions") throw new Error("S2.7 display compatibility overlay signature missing");
if (overlay.mutations?.length !== 2) throw new Error("S2.7 display compatibility overlay must remain minimal");
for (const id of ["storage.solid-state.general-v1", "communication.wireless.combo-v1"]) {
  const mutation = overlay.mutations.find((item) => item.definitionId === id);
  if (!mutation?.addProductFamilies?.includes("display-system")) throw new Error(`S2.7 display family overlay missing: ${id}`);
}

const profile = JSON.parse(await readFile("presets/tv-01/profile.json", "utf8"));
if (profile.compositionVersion !== "1") throw new Error("S2.7 TV composition version mismatch");
if (profile.profileId !== "tv-01-v1" || profile.projectId !== "tv-01") throw new Error("S2.7 TV profile identity mismatch");
if (profile.productFamily !== "display-system") throw new Error("S2.7 TV family mismatch");
if (profile.signature !== "Tehkné Solutions") throw new Error("S2.7 TV signature missing");
if (profile.root?.id !== "tv.root" || profile.root?.type !== "Television") throw new Error("S2.7 TV root contract invalid");
if (profile.boot?.id !== "tv.boot") throw new Error("S2.7 TV boot contract invalid");
if (profile.slots?.length !== 8) throw new Error(`S2.7 TV requires 8 slots, got ${profile.slots?.length}`);
if (profile.connections?.length !== 9) throw new Error(`S2.7 TV requires 9 connections, got ${profile.connections?.length}`);
if (profile.bootDependencies?.length !== 4) throw new Error("S2.7 TV boot dependency count changed unexpectedly");
if (profile.tuning?.length !== 5) throw new Error("S2.7 TV tuning count changed unexpectedly");
const slots = new Map(profile.slots.map((slot) => [slot.slotId, slot]));
for (const [slotId, definitionId] of Object.entries({
  frame: "structural.frame.modular-v1",
  psu: "power.ac-dc.supply-v1",
  controller: "compute.media-controller.display-v1",
  storage: "storage.solid-state.general-v1",
  wireless: "communication.wireless.combo-v1",
  panel: "display.panel.large-oled-v1",
  hdmi: "interface.hdmi.input-v1",
  speakers: "actuation.speaker.stereo-v1"
})) {
  if (slots.get(slotId)?.definitionId !== definitionId) throw new Error(`S2.7 canonical TV slot mismatch: ${slotId}`);
}
if (slots.get("psu")?.teardown !== true || slots.get("panel")?.teardown !== true) throw new Error("S2.7 TV serviceable PSU/panel contract missing");

const runtime = await readFile("packages/tv-runtime/src/index.ts", "utf8");
for (const token of [
  'TV_SIGNATURE = "Tehkné Solutions"',
  "TvPresetProfile",
  "createTvRegistry",
  "applyComponentCatalogExtension",
  "applyComponentCatalogOverlay",
  "validateTvProfile",
  "createTvProject",
  "materializeProductComposition",
  "applyProductSlotTuning",
  "Invalid tv profile"
]) {
  if (!runtime.includes(token)) throw new Error(`S2.7 TV runtime contract missing: ${token}`);
}

const domain = await readFile("tests/domain/tv-runtime.test.mjs", "utf8");
for (const token of [
  "Catalog Extension adds new display technologies",
  "display overlay expands only reusable base components",
  "materializes 8 components and 9 validated engineering connections",
  "AC/DC supply causes causal POST failure",
  "cannot materialize without its Catalog Extension"
]) {
  if (!domain.includes(token)) throw new Error(`S2.7 TV domain evidence missing: ${token}`);
}

const assembly = await readFile("apps/studio-web/components/TvAssembly.tsx", "utf8");
for (const token of [
  "TvAssembly",
  'session.getEntity("tv.root")',
  "entity.metadata.spatial",
  'root.state === "exploded"',
  'entity.state === "removed"',
  'entity.id === "tv.psu"',
  "createSpatialBinding",
  "resolveSpatialSelection"
]) {
  if (!assembly.includes(token)) throw new Error(`S2.7 TV spatial UX missing: ${token}`);
}

const workbench = await readFile("apps/studio-web/components/SpatialWorkbench.tsx", "utf8");
for (const token of [
  "createTvRegistry",
  "createTvProject",
  "tvSession",
  "tvIntelligence",
  "<TvAssembly session={tvSession}",
  "Chamar TV 01",
  "Restaurar TV salva",
  'saveBrowserProject("tv"',
  "looksTv",
  'execution.targetEntityId?.startsWith("tv.")',
  "TV-01",
  "POWER {tvPowerState.toUpperCase()} · BOOT {tvBootStage}"
]) {
  if (!workbench.includes(token)) throw new Error(`S2.7 TV Workbench integration missing: ${token}`);
}

const persistence = await readFile("apps/studio-web/lib/projectPersistence.ts", "utf8");
if (!persistence.includes('"tv"')) throw new Error("S2.7 persistence adapter does not include TV");

const libraryPanel = await readFile("apps/studio-web/components/ComponentLibraryPanel.tsx", "utf8");
for (const token of ["applyComponentCatalogExtension", "displaySystemExtension", "displaySystemOverlay", "display-system"]) {
  if (!libraryPanel.includes(token)) throw new Error(`S2.7 Component Library display extension not surfaced: ${token}`);
}

const browser = await readFile("tests/browser/tv.spec.ts", "utf8");
for (const token of [
  "Chamar TV 01",
  "Abra a TV",
  "Inspecione a fonte",
  "Tire a fonte",
  "Ligue a TV",
  "Por que não iniciou?",
  "Reinstale a fonte",
  "POWER FAULT · BOOT POST",
  "POWER ON · BOOT RUNNING",
  "Restaurar TV salva",
  "page.reload",
  "Catalog Extension"
]) {
  if (!browser.includes(token)) throw new Error(`S2.7 TV browser evidence missing: ${token}`);
}

const tsconfig = await readFile("tsconfig.core.json", "utf8");
if (!tsconfig.includes("packages/tv-runtime/src/**/*.ts")) throw new Error("S2.7 TV runtime is not part of core typecheck/build");

console.log("S2.7 TV / Display Systems PASS · Catalog Extension + compatibility overlay + 8 components + 9 connections + causal Workbench persistence · Tehkné Solutions");
