import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import {
  applyComponentCatalogExtension,
  validateComponentCatalogExtension
} from "../../dist/packages/component-library/src/extension.js";
import { applyComponentCatalogOverlay } from "../../dist/packages/component-library/src/overlay.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import {
  createTvProject,
  createTvRegistry,
  validateTvProfile
} from "../../dist/packages/tv-runtime/src/index.js";
import { validateProject } from "../../dist/packages/project-format/src/index.js";

async function inputs() {
  const [baseCatalog, extension, overlay, profile] = await Promise.all([
    readFile("library/components/catalog.json", "utf8").then(JSON.parse),
    readFile("library/components/extensions/display-system-v1.json", "utf8").then(JSON.parse),
    readFile("library/components/overlays/display-system-v1.json", "utf8").then(JSON.parse),
    readFile("presets/tv-01/profile.json", "utf8").then(JSON.parse)
  ]);
  return { baseCatalog, extension, overlay, profile };
}

test("S2.7 signed Catalog Extension adds new technologies without mutating or replacing the base catalog", async () => {
  const { baseCatalog, extension } = await inputs();
  const base = parseComponentCatalog(baseCatalog);
  const before = JSON.stringify(base);
  const extended = applyComponentCatalogExtension(base, extension);

  assert.equal(extension.extensionId, "display-system-v1");
  assert.equal(extension.signature, "Tehkné Solutions");
  assert.equal(extended.components.length, base.components.length + 7);
  assert.equal(JSON.stringify(base), before, "catalog extension must not mutate the base catalog");
  assert.ok(extended.components.some((definition) => definition.definitionId === "compute.soc.media-v1"));
  assert.ok(extended.components.some((definition) => definition.definitionId === "audio.amplifier.stereo-v1" && definition.domain === "audio"));
  assert.ok(extended.components.some((definition) => definition.definitionId === "audio.speaker.stereo-v1" && definition.domain === "audio"));

  assert.ok(validateComponentCatalogExtension(base, { ...extension, signature: "Other" }).some((error) => error.includes("signature must be Tehkné Solutions")));
  assert.throws(
    () => applyComponentCatalogExtension(base, { ...extension, components: [...extension.components, base.components[0]] }),
    /cannot replace existing definition/
  );
});

test("S2.7 TV registry composes extension plus compatibility overlay while keeping a single universal catalog", async () => {
  const { baseCatalog, extension, overlay } = await inputs();
  const base = parseComponentCatalog(baseCatalog);
  const extended = applyComponentCatalogExtension(base, extension);
  const catalog = applyComponentCatalogOverlay(extended, overlay);
  const { registry } = createTvRegistry(baseCatalog, extension, overlay);

  assert.equal(registry.catalog().catalogId, catalog.catalogId);
  assert.equal(registry.list({ productFamily: "display-system" }).length >= 12, true);
  for (const definitionId of [
    "power.regulator.dc-v1",
    "memory.lpddr.package-v1",
    "storage.solid-state.general-v1",
    "communication.wireless.combo-v1",
    "thermal.cooling.compact-v1"
  ]) {
    assert.equal(registry.get(definitionId).productFamilies.includes("display-system"), true, `${definitionId} lacks display-system compatibility`);
  }
});

test("S2.7 TV 01 materializes 13 components with 16 interface-validated engineering connections", async () => {
  const { baseCatalog, extension, overlay, profile } = await inputs();
  const { registry } = createTvRegistry(baseCatalog, extension, overlay);
  const result = createTvProject(profile, registry);
  const { project } = result;

  assert.equal(project.projectId, "tv-01");
  assert.equal(project.rootEntityId, "tv.root");
  assert.equal(project.metadata.productFamily, "display-system");
  assert.equal(project.metadata.signature, "Tehkné Solutions");
  assert.equal(result.componentCount, 13);
  assert.equal(result.connectionCount, 16);
  assert.deepEqual(validateProject(project), []);

  const components = project.entities.filter((entity) => entity.metadata.provenance === "component-library");
  assert.equal(components.length, 13);
  assert.ok(components.every((entity) => entity.metadata.componentDefinitionId));
  assert.ok(components.every((entity) => entity.metadata["display-systemSlotId"]));

  for (const relationship of project.relationships.filter((item) => item.type === "connectedTo")) {
    assert.equal(relationship.metadata.validatedBy, "component-library");
    assert.ok(relationship.metadata.sharedInterfaces.length >= 1);
  }

  const byId = new Map(project.entities.map((entity) => [entity.id, entity]));
  assert.equal(byId.get("tv.psu").properties.maxOutputW.value, 220);
  assert.equal(byId.get("tv.soc").properties.cpuCores.value, 8);
  assert.equal(byId.get("tv.memory").properties.capacityGB.value, 4);
  assert.equal(byId.get("tv.display").properties.diagonalIn.value, 55);
  assert.equal(byId.get("tv.amplifier").properties.outputPowerW.value, 30);
});

test("S2.7 removing the AC/DC PSU blocks TV boot causally and reinstall restores RUNNING", async () => {
  const { baseCatalog, extension, overlay, profile } = await inputs();
  const { registry } = createTvRegistry(baseCatalog, extension, overlay);
  const session = new EngineeringSession(createTvProject(profile, registry).project);

  const healthy = await session.executeCapability("tv.root", "powerOn");
  assert.equal(healthy.result.bootRun.status, "success");
  assert.equal(healthy.result.bootRun.finalStage, "RUNNING");

  await session.executeCapability("tv.root", "open");
  await session.executeCapability("tv.psu", "remove");
  const failed = await session.executeCapability("tv.root", "powerOn");
  assert.equal(failed.result.bootRun.status, "failure");
  assert.equal(failed.result.bootRun.fault.entityId, "tv.psu");

  const why = await session.executeCapability("tv.boot", "why");
  assert.match(why.result.explanation, /TV AC\/DC Power Supply/);
  assert.ok(why.result.causalTrace.some((step) => step.entityId === "tv.psu"));

  await session.executeCapability("tv.psu", "insert");
  const recovered = await session.executeCapability("tv.root", "powerOn");
  assert.equal(recovered.result.bootRun.status, "success");
  assert.equal(recovered.result.bootRun.finalStage, "RUNNING");
});

test("S2.7 HDMI is serviceable but is not falsely modeled as a boot dependency", async () => {
  const { baseCatalog, extension, overlay, profile } = await inputs();
  const { registry } = createTvRegistry(baseCatalog, extension, overlay);
  const session = new EngineeringSession(createTvProject(profile, registry).project);
  await session.executeCapability("tv.root", "open");
  await session.executeCapability("tv.hdmi", "remove");
  const run = await session.executeCapability("tv.root", "powerOn");
  assert.equal(run.result.bootRun.status, "success");
  assert.equal(run.result.bootRun.finalStage, "RUNNING");
});

test("S2.7 media and audio signal chains use explicit compatible interfaces", async () => {
  const { baseCatalog, extension, overlay } = await inputs();
  const { registry } = createTvRegistry(baseCatalog, extension, overlay);
  const soc = registry.get("compute.soc.media-v1");
  const panel = registry.get("display.panel.4k-v1");
  const hdmi = registry.get("interface.hdmi.input-v1");
  const amp = registry.get("audio.amplifier.stereo-v1");
  const speakers = registry.get("audio.speaker.stereo-v1");

  assert.ok(soc.ports["display-out"].compatibility.includes("display.edp-lvds"));
  assert.ok(panel.ports["display-in"].compatibility.includes("display.edp-lvds"));
  assert.ok(hdmi.ports.internal.compatibility.includes("video.hdmi"));
  assert.ok(soc.ports["hdmi-in"].compatibility.includes("video.hdmi"));
  assert.ok(soc.ports["audio-out"].compatibility.includes("audio.digital-pcm"));
  assert.ok(amp.ports["audio-in"].compatibility.includes("audio.digital-pcm"));
  assert.ok(amp.ports["speaker-out"].compatibility.includes("audio.speaker-level"));
  assert.ok(speakers.ports["audio-in"].compatibility.includes("audio.speaker-level"));
});

test("S2.7 TV remains fail-closed without the extension or compatibility overlay", async () => {
  const { baseCatalog, extension, overlay, profile } = await inputs();
  const baseRegistry = new ComponentRegistry(parseComponentCatalog(baseCatalog));
  const baseErrors = validateTvProfile(profile, baseRegistry);
  assert.ok(baseErrors.some((error) => error.includes("Unknown component definition")));

  const extendedOnly = new ComponentRegistry(applyComponentCatalogExtension(parseComponentCatalog(baseCatalog), extension));
  const overlayErrors = validateTvProfile(profile, extendedOnly);
  assert.ok(overlayErrors.some((error) => error.includes("not declared for display-system")));

  assert.throws(() => createTvRegistry(baseCatalog, { ...extension, signature: "Other" }, overlay), /signature must be Tehkné Solutions/);
});
