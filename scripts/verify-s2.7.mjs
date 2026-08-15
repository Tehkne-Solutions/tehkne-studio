import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/component-library/src/extension.ts",
  "library/components/extensions/display-system-v1.json",
  "library/components/overlays/display-system-v1.json",
  "packages/display-system-runtime/src/index.ts",
  "presets/tv-01/profile.json",
  "tests/domain/display-system-runtime.test.mjs",
  "apps/studio-web/components/TvAssembly.tsx",
  "tests/browser/display-system.spec.ts"
];
for (const path of required) await access(resolve(path));
for (const temporary of [
  ".github/workflows/s2-07-workbench-patch.yml",
  "tools/s2-07-integrate-workbench.mjs"
]) {
  try {
    await access(resolve(temporary));
    throw new Error(`S2.7 temporary write bootstrap must not ship: ${temporary}`);
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  }
}

const extensionRuntime = await readFile("packages/component-library/src/extension.ts", "utf8");
for (const token of [
  "ComponentCatalogExtension",
  "applyComponentCatalogExtension",
  "Component catalog extension signature must be Tehkné Solutions",
  "cannot replace existing definition",
  "repeats definition",
  "validateComponentDefinition",
  "parseComponentCatalog"
]) {
  if (!extensionRuntime.includes(token)) throw new Error(`S2.7 Catalog Extension runtime contract missing: ${token}`);
}

const extension = JSON.parse(await readFile("library/components/extensions/display-system-v1.json", "utf8"));
if (extension.extensionId !== "display-system-v1") throw new Error("S2.7 display extension identity mismatch");
if (extension.extensionVersion !== "1") throw new Error("S2.7 display extension version mismatch");
if (extension.signature !== "Tehkné Solutions") throw new Error("S2.7 display extension signature missing");
if (extension.components?.length !== 6) throw new Error(`S2.7 display extension requires 6 canonical definitions, got ${extension.components?.length}`);
const extensionIds = new Set(extension.components.map((definition) => definition.definitionId));
for (const definitionId of [
  "compute.media-soc.display-v1",
  "power.supply.ac-dc-v1",
  "interface.ac-inlet-v1",
  "display.panel.large-v1",
  "interface.hdmi.port-v1",
  "audio.speaker.stereo-v1"
]) {
  if (!extensionIds.has(definitionId)) throw new Error(`S2.7 canonical display definition missing: ${definitionId}`);
}

const overlay = JSON.parse(await readFile("library/components/overlays/display-system-v1.json", "utf8"));
if (overlay.overlayId !== "display-system-compat-v1") throw new Error("S2.7 display compatibility overlay identity mismatch");
if (overlay.overlayVersion !== "1") throw new Error("S2.7 display compatibility overlay version mismatch");
if (overlay.signature !== "Tehkné Solutions") throw new Error("S2.7 display compatibility overlay signature missing");
if (overlay.mutations?.length !== 3) throw new Error("S2.7 display compatibility overlay must contain exactly three reuse mutations");
const overlayTargets = new Set(overlay.mutations.map((mutation) => mutation.definitionId));
for (const definitionId of [
  "storage.solid-state.general-v1",
  "communication.wireless.combo-v1",
  "control.mcu.general-v1"
]) {
  if (!overlayTargets.has(definitionId)) throw new Error(`S2.7 display reuse overlay target missing: ${definitionId}`);
}

const runtime = await readFile("packages/display-system-runtime/src/index.ts", "utf8");
for (const token of [
  'DISPLAY_SYSTEM_SIGNATURE = "Tehkné Solutions"',
  "DisplaySystemPresetProfile",
  "createDisplaySystemRegistry",
  "applyComponentCatalogExtension",
  "applyComponentCatalogOverlay",
  "validateDisplaySystemProfile",
  "createDisplaySystemProject",
  "materializeProductComposition",
  "applyProductSlotTuning",
  "Invalid display-system profile"
]) {
  if (!runtime.includes(token)) throw new Error(`S2.7 display-system runtime contract missing: ${token}`);
}

const profile = JSON.parse(await readFile("presets/tv-01/profile.json", "utf8"));
if (profile.compositionVersion !== "1") throw new Error("S2.7 TV composition version mismatch");
if (profile.profileId !== "tv-01-v1") throw new Error("S2.7 TV profile identity mismatch");
if (profile.projectId !== "tv-01") throw new Error("S2.7 TV project identity mismatch");
if (profile.productFamily !== "display-system") throw new Error("S2.7 TV family mismatch");
if (profile.signature !== "Tehkné Solutions") throw new Error("S2.7 TV signature missing");
if (profile.root?.id !== "tv.root" || profile.root?.type !== "Television") throw new Error("S2.7 TV root contract invalid");
if (profile.boot?.id !== "tv.boot") throw new Error("S2.7 TV boot contract invalid");
if (profile.slots?.length !== 11) throw new Error(`S2.7 TV requires 11 component slots, got ${profile.slots?.length}`);
if (profile.connections?.length !== 13) throw new Error(`S2.7 TV requires 13 validated connections, got ${profile.connections?.length}`);
if (profile.bootDependencies?.length !== 4) throw new Error("S2.7 TV boot dependency count changed unexpectedly");
if (profile.tuning?.length !== 5) throw new Error("S2.7 TV tuning count changed unexpectedly");
const slots = new Map(profile.slots.map((slot) => [slot.slotId, slot]));
for (const [slotId, definitionId] of Object.entries({
  frame: "structural.frame.modular-v1",
  acInlet: "interface.ac-inlet-v1",
  psu: "power.supply.ac-dc-v1",
  soc: "compute.media-soc.display-v1",
  storage: "storage.solid-state.general-v1",
  panel: "display.panel.large-v1",
  wireless: "communication.wireless.combo-v1",
  input: "control.mcu.general-v1",
  hdmi: "interface.hdmi.port-v1",
  speakers: "audio.speaker.stereo-v1",
  usbC: "interface.usb-c.port-v1"
})) {
  if (slots.get(slotId)?.definitionId !== definitionId) throw new Error(`S2.7 canonical TV slot mismatch: ${slotId}`);
}
if (slots.get("psu")?.teardown !== true) throw new Error("S2.7 TV PSU must remain teardown-capable");

const domain = await readFile("tests/domain/display-system-runtime.test.mjs", "utf8");
for (const token of [
  "adds six canonical display technologies without mutating S2.3 base",
  "materializes 11 reusable components with 13 validated AC power, media, HDMI and audio connections",
  "PSU teardown creates causal POST failure",
  "overlay remains necessary for reused storage wireless and MCU definitions",
  "tuning remains bounded by canonical Engineering Property constraints",
  "video.hdmi",
  "audio.line-level",
  "power.ac.mains"
]) {
  if (!domain.includes(token)) throw new Error(`S2.7 display-system domain evidence missing: ${token}`);
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
  "createDisplaySystemRegistry",
  "createDisplaySystemProject",
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
  "notebookOverlay",
  "tabletOverlay"
]) {
  if (!libraryPanel.includes(token)) throw new Error(`S2.7 extension/overlay composition is not surfaced in Component Library UX: ${token}`);
}

const browser = await readFile("tests/browser/display-system.spec.ts", "utf8");
for (const token of [
  "Chamar TV 01",
  "Abra a TV",
  "Inspecione o HDMI",
  "Tire a fonte",
  "Ligue a TV",
  "Por que não iniciou?",
  "Reinstale a fonte",
  "POWER FAULT · BOOT POST",
  "POWER ON · BOOT RUNNING",
  "Restaurar TV salva",
  "Abra a televisão",
  "Component Library exposes canonical display-system extension",
  "video.hdmi.external",
  "audio.line-level"
]) {
  if (!browser.includes(token)) throw new Error(`S2.7 TV browser evidence missing: ${token}`);
}

const tsconfig = await readFile("tsconfig.core.json", "utf8");
if (!tsconfig.includes("packages/display-system-runtime/src/**/*.ts")) throw new Error("S2.7 display-system runtime is not part of core typecheck/build");

const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
if (rootPackage.scripts?.["verify:s2.7"] !== "node scripts/verify-s2.7.mjs") throw new Error("S2.7 package verification script missing");

const workflow = await readFile(".github/workflows/ci.yml", "utf8");
for (const token of ["npm run verify:s2.7", "npm run smoke:browser", "Assert AF-001I deterministic evidence"]) {
  if (!workflow.includes(token)) throw new Error(`S2.7 accumulated CI contract missing: ${token}`);
}
if (workflow.includes("contents: write")) throw new Error("S2.7 final CI must remain read-only");

console.log("S2.7 Display System structure PASS · signed Catalog Extension + compatibility overlay + TV 01 + 11 components + 13 connections + causal PSU + Workbench persistence · Tehkné Solutions");
