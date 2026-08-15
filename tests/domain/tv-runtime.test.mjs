import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { applyComponentCatalogExtension } from "../../dist/packages/component-library/src/extension.js";
import { applyComponentCatalogOverlay } from "../../dist/packages/component-library/src/overlay.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { createTvProject, createTvRegistry } from "../../dist/packages/tv-runtime/src/index.js";
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

test("S2.7 signed Catalog Extension adds new display technologies without mutating the base catalog", async () => {
  const { baseCatalog, extension } = await inputs();
  const base = parseComponentCatalog(baseCatalog);
  const baseRegistry = new ComponentRegistry(base);
  assert.throws(() => baseRegistry.get("power.ac-dc.supply-v1"), /Unknown component definition/);

  const extended = applyComponentCatalogExtension(base, extension);
  const registry = new ComponentRegistry(extended);
  assert.equal(extended.components.length, base.components.length + 5);
  assert.equal(registry.get("power.ac-dc.supply-v1").productFamilies.includes("display-system"), true);
  assert.equal(registry.get("compute.media-controller.display-v1").ports["hdmi-in"].compatibility[0], "video.hdmi");
  assert.equal(registry.get("display.panel.large-oled-v1").properties.diagonalIn.value, 55);
  assert.equal(registry.get("actuation.speaker.stereo-v1").domain, "actuation");

  assert.throws(() => baseRegistry.get("compute.media-controller.display-v1"), /Unknown component definition/, "extension must not mutate base catalog");
  assert.throws(() => applyComponentCatalogExtension(base, { ...extension, signature: "Other" }), /signature must be Tehkné Solutions/);
  assert.throws(() => applyComponentCatalogExtension(base, { ...extension, components: [base.components[0]] }), /cannot replace existing definition/);
});

test("S2.7 display overlay expands only reusable base components after the Catalog Extension", async () => {
  const { baseCatalog, extension, overlay } = await inputs();
  const base = parseComponentCatalog(baseCatalog);
  const extended = applyComponentCatalogExtension(base, extension);
  const merged = applyComponentCatalogOverlay(extended, overlay);
  const registry = new ComponentRegistry(merged);

  assert.equal(registry.get("storage.solid-state.general-v1").productFamilies.includes("display-system"), true);
  assert.equal(registry.get("communication.wireless.combo-v1").productFamilies.includes("display-system"), true);
  assert.equal(new ComponentRegistry(base).get("storage.solid-state.general-v1").productFamilies.includes("display-system"), false);
  assert.equal(merged.components.length, extended.components.length, "overlay must not add canonical definitions");
});

test("S2.7 TV 01 materializes 8 components and 9 validated engineering connections", async () => {
  const { baseCatalog, extension, overlay, profile } = await inputs();
  const { catalog, registry } = createTvRegistry(baseCatalog, extension, overlay);
  const result = createTvProject(profile, registry);
  const { project } = result;

  assert.equal(catalog.catalogId, "tehkne-universal-components-v1+display-system-v1+display-system-v1");
  assert.equal(project.projectId, "tv-01");
  assert.equal(project.rootEntityId, "tv.root");
  assert.equal(project.metadata.productFamily, "display-system");
  assert.equal(project.metadata.signature, "Tehkné Solutions");
  assert.equal(result.componentCount, 8);
  assert.equal(result.connectionCount, 9);
  assert.deepEqual(validateProject(project), []);

  const components = project.entities.filter((entity) => entity.metadata.provenance === "component-library");
  assert.equal(components.length, 8);
  assert.ok(components.every((entity) => entity.metadata.componentDefinitionId));
  assert.ok(components.every((entity) => entity.metadata["display-systemSlotId"]));

  const byId = new Map(project.entities.map((entity) => [entity.id, entity]));
  assert.equal(byId.get("tv.psu").properties.ratedPowerW.value, 180);
  assert.equal(byId.get("tv.controller").properties.videoPipelines.value, 4);
  assert.equal(byId.get("tv.storage").properties.capacityGB.value, 256);
  assert.equal(byId.get("tv.panel").properties.peakBrightnessNits.value, 1100);
  assert.equal(byId.get("tv.speakers").properties.ratedPowerW.value, 30);

  for (const relationship of project.relationships.filter((item) => item.type === "connectedTo")) {
    assert.equal(relationship.metadata.validatedBy, "component-library");
    assert.ok(relationship.metadata.sharedInterfaces.length >= 1);
  }
  const hdmi = project.relationships.find((item) => item.id === "tv-hdmi");
  assert.deepEqual(hdmi.metadata.sharedInterfaces, ["video.hdmi"]);
});

test("S2.7 removing the AC/DC supply causes causal POST failure and reinstall restores RUNNING", async () => {
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
  assert.equal(failed.result.bootRun.fault.stage, "POST");

  const why = await session.executeCapability("tv.boot", "why");
  assert.match(why.result.explanation, /TV AC\/DC Power Supply/);
  assert.ok(why.result.causalTrace.some((step) => step.entityId === "tv.psu"));

  await session.executeCapability("tv.psu", "insert");
  const recovered = await session.executeCapability("tv.root", "powerOn");
  assert.equal(recovered.result.bootRun.status, "success");
  assert.equal(recovered.result.bootRun.finalStage, "RUNNING");
});

test("S2.7 TV cannot materialize without its Catalog Extension and tuning stays bounded", async () => {
  const { baseCatalog, extension, overlay, profile } = await inputs();
  const base = parseComponentCatalog(baseCatalog);
  const overlayOnly = applyComponentCatalogOverlay(base, overlay);
  assert.throws(() => createTvProject(profile, new ComponentRegistry(overlayOnly)), /Unknown component definition/);

  const { registry } = createTvRegistry(baseCatalog, extension, overlay);
  const invalid = {
    ...profile,
    tuning: profile.tuning.map((item) => item.slotId === "panel"
      ? { ...item, propertyValues: { ...item.propertyValues, diagonalIn: 200 } }
      : item)
  };
  assert.throws(() => createTvProject(invalid, registry), /Invalid tv profile/);
});
