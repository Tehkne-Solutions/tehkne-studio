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
  "validateComponentCatalogExtension",
  "applyComponentCatalogExtension",
  "signature must be Tehkné Solutions",
  "cannot replace existing definition",
  "parseComponentCatalog"
]) {
  if (!extensionRuntime.includes(token)) throw new Error(`S2.7 Catalog Extension runtime contract missing: ${token}`);
}

const extension = JSON.parse(await readFile("library/components/extensions/display-system-v1.json", "utf8"));
if (extension.extensionId !== "display-system-v1") throw new Error("S2.7 display-system extension identity mismatch");
if (extension.extensionVersion !== "1") throw new Error("S2.7 display-system extension version mismatch");
if (extension.signature !== "Tehkné Solutions") throw new Error("S2.7 display-system extension signature missing");
if (extension.components?.length !== 7) throw new Error(`S2.7 display-system extension requires 7 new components, got ${extension.components?.length}`);
const extensionIds = new Set(extension.components.map((definition) => definition.definitionId));
if (extensionIds.size !== 7) throw new Error("S2.7 display-system extension IDs must be unique");
for (const definitionId of [
  "power.supply.ac-dc.display-v1",
  "compute.soc.media-v1",
  "display.panel.4k-v1",
  "interface.hdmi.input-v1",
  "audio.amplifier.stereo-v1",
  "audio.speaker.stereo-v1",
  "sensing.ir.receiver-v1"
]) {
  if (!extensionIds.has(definitionId)) throw new Error(`S2.7 canonical extension component missing: ${definitionId}`);
}
for (const definitionId of ["audio.amplifier.stereo-v1", "audio.speaker.stereo-v1"]) {
  const definition = extension.components.find((item) => item.definitionId === definitionId);
  if (definition?.domain !== "audio") throw new Error(`S2.7 ${definitionId} must use canonical audio domain`);
}

const libraryRuntime = await readFile("packages/component-library/src/index.ts", "utf8");
if (!libraryRuntime.includes('| "audio"')) throw new Error("S2.7 ComponentDomain does not include audio");
if (!libraryRuntime.includes('"display", "audio", "sensing"')) throw new Error("S2.7 audio domain is not validated by Component Library");

const overlay = JSON.parse(await readFile("library/components/overlays/display-system-v1.json", "utf8"));
if (overlay.overlayId !== "display-system-v1") throw new Error("S2.7 display-system overlay identity mismatch");
if (overlay.overlayVersion !== "1") throw new Error("S2.7 display-system overlay version mismatch");
if (overlay.signature !== "Tehkné Solutions") throw new Error("S2.7 display-system overlay signature missing");
if (overlay.mutations?.length !== 5) throw new Error("S2.7 display-system overlay must contain exactly 5 compatibility mutations");
const overlayTargets = new Set(overlay.mutations.map((mutation) => mutation.definitionId));
for (const definitionId of [
  "power.regulator.dc-v1",
  "memory.lpddr.package-v1",
  "storage.solid-state.general-v1",
  "communication.wireless.combo-v1",
  "thermal.cooling.compact-v1"
]) {
  if (!overlayTargets.has(definitionId)) throw new Error(`S2.7 display-system compatibility target missing: ${definitionId}`);
}
if (!overlay.mutations.every((mutation) => mutation.addProductFamilies?.includes("display-system"))) {
  throw new Error("S2.7 compatibility overlay must add display-system only through explicit product family extension");
}

const profile = JSON.parse(await readFile("presets/tv-01/profile.json", "utf8"));
if (profile.compositionVersion !== "1") throw new Error("S2.7 TV composition version mismatch");
if (profile.profileId !== "tv-01-v1") throw new Error("S2.7 TV profile identity mismatch");
if (profile.projectId !== "tv-01") throw new Error("S2.7 TV project identity mismatch");
if (profile.productFamily !== "display-system") throw new Error("S2.7 TV family mismatch");
if (profile.signature !== "Tehkné Solutions") throw new Error("S2.7 TV signature missing");
if (profile.root?.id !== "tv.root" || profile.root?.type !== "Television") throw new Error("S2.7 TV root contract invalid");
if (profile.boot?.id !== "tv.boot") throw new Error("S2.7 TV boot contract invalid");
if (profile.slots?.length !== 13) throw new Error(`S2.7 TV requires 13 component slots, got ${profile.slots?.length}`);
if (profile.connections?.length !== 16) throw new Error(`S2.7 TV requires 16 connections, got ${profile.connections?.length}`);
if (profile.bootDependencies?.length !== 6) throw new Error("S2.7 TV boot dependency count changed unexpectedly");
if (profile.tuning?.length !== 8) throw new Error("S2.7 TV tuning count changed unexpectedly");
const slots = new Map(profile.slots.map((slot) => [slot.slotId, slot]));
for (const [slotId, definitionId] of Object.entries({
  frame: "structural.frame.modular-v1",
  psu: "power.supply.ac-dc.display-v1",
  regulator: "power.regulator.dc-v1",
  soc: "compute.soc.media-v1",
  memory: "memory.lpddr.package-v1",
  storage: "storage.solid-state.general-v1",
  display: "display.panel.4k-v1",
  wireless: "communication.wireless.combo-v1",
  hdmi: "interface.hdmi.input-v1",
  amplifier: "audio.amplifier.stereo-v1",
  speakers: "audio.speaker.stereo-v1",
  ir: "sensing.ir.receiver-v1",
  cooling: "thermal.cooling.compact-v1"
})) {
  if (slots.get(slotId)?.definitionId !== definitionId) throw new Error(`S2.7 canonical TV slot mismatch: ${slotId}`);
}
for (const serviceable of ["psu", "display", "hdmi"]) {
  if (slots.get(serviceable)?.teardown !== true) throw new Error(`S2.7 TV serviceable slot must remain teardown-capable: ${serviceable}`);
}
if (profile.bootDependencies.some((dependency) => dependency.slotId === "hdmi")) {
  throw new Error("S2.7 HDMI must remain functional/serviceable without becoming a false boot dependency");
}

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
  "Invalid TV profile"
]) {
  if (!runtime.includes(token)) throw new Error(`S2.7 TV runtime contract missing: ${token}`);
}

const domain = await readFile("tests/domain/tv-runtime.test.mjs", "utf8");
for (const token of [
  "signed Catalog Extension adds new technologies without mutating or replacing the base catalog",
  "TV registry composes extension plus compatibility overlay",
  "materializes 13 components with 16 interface-validated engineering connections",
  "removing the AC/DC PSU blocks TV boot causally",
  "HDMI is serviceable but is not falsely modeled as a boot dependency",
  "media and audio signal chains use explicit compatible interfaces",
  "TV remains fail-closed without the extension or compatibility overlay"
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
  'entity.id === "tv.display"',
  'entity.id === "tv.hdmi"',
  "createSpatialBinding",
  "resolveSpatialSelection"
]) {
  if (!assembly.includes(token)) throw new Error(`S2.7 TV spatial UX missing: ${token}`);
}

const workbench = await readFile("apps/studio-web/components/SpatialWorkbench.tsx", "utf8");
for (const token of [
  "createTvRegistry",
  "createTvProject",
  "createTvRuntime",
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
for (const token of [
  "applyComponentCatalogExtension",
  "displaySystemExtension",
  "displaySystemOverlay",
  "displayExtendedCatalog",
  '"display-system"',
  "CATALOG EXTENSION · DISPLAY-SYSTEM-V1"
]) {
  if (!libraryPanel.includes(token)) throw new Error(`S2.7 display-system extension is not surfaced in Component Library UX: ${token}`);
}

const browser = await readFile("tests/browser/tv.spec.ts", "utf8");
for (const token of [
  "Chamar TV 01",
  "Abra a TV",
  "Inspecione a fonte",
  "Remova a fonte",
  "Ligue a TV",
  "Por que não iniciou?",
  "Reinstale a fonte",
  "POWER FAULT",
  "POWER ON · BOOT RUNNING",
  "Restaurar TV salva",
  "page.reload",
  "Component Library exposes display-system extension",
  "CATALOG EXTENSION · DISPLAY-SYSTEM-V1"
]) {
  if (!browser.includes(token)) throw new Error(`S2.7 TV browser evidence missing: ${token}`);
}

const tsconfig = await readFile("tsconfig.core.json", "utf8");
if (!tsconfig.includes("packages/tv-runtime/src/**/*.ts")) throw new Error("S2.7 TV runtime is not part of core typecheck/build");

console.log("S2.7 TV / Display Systems structure PASS · signed Catalog Extension + audio domain + 13 components + 16 connections + causal Workbench persistence · Tehkné Solutions");
