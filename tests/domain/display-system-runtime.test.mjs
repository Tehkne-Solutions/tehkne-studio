import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { applyComponentCatalogExtension } from "../../dist/packages/component-library/src/extension.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import {
  createDisplaySystemProject,
  createDisplaySystemRegistry,
  validateDisplaySystemProfile
} from "../../dist/packages/display-system-runtime/src/index.js";
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

test("S2.7 signed Catalog Extension adds six canonical display technologies without mutating S2.3 base", async () => {
  const { baseCatalog, extension } = await inputs();
  const base = parseComponentCatalog(baseCatalog);
  const baseRegistry = new ComponentRegistry(base);
  assert.throws(() => baseRegistry.get("compute.media-soc.display-v1"), /Unknown component definition/);

  const extended = applyComponentCatalogExtension(base, extension);
  const registry = new ComponentRegistry(extended);
  assert.equal(extended.components.length, base.components.length + 6);
  for (const definitionId of [
    "compute.media-soc.display-v1",
    "power.supply.ac-dc-v1",
    "interface.ac-inlet-v1",
    "display.panel.large-v1",
    "interface.hdmi.port-v1",
    "audio.speaker.stereo-v1"
  ]) {
    assert.equal(registry.get(definitionId).productFamilies.includes("display-system"), true);
  }
  assert.throws(() => baseRegistry.get("power.supply.ac-dc-v1"), /Unknown component definition/, "extension must not mutate base catalog");

  assert.throws(
    () => applyComponentCatalogExtension(base, { ...extension, signature: "Other" }),
    /signature must be Tehkné Solutions/
  );
  assert.throws(
    () => applyComponentCatalogExtension(base, { ...extension, components: [base.components[0]] }),
    /cannot replace existing definition/
  );
  assert.throws(
    () => applyComponentCatalogExtension(base, { ...extension, components: [extension.components[0], extension.components[0]] }),
    /repeats definition/
  );
});

test("S2.7 TV 01 materializes 11 reusable components with 13 validated AC power, media, HDMI and audio connections", async () => {
  const { baseCatalog, extension, overlay, profile } = await inputs();
  const { catalog, registry } = createDisplaySystemRegistry(baseCatalog, extension, overlay);
  const result = createDisplaySystemProject(profile, registry);
  const { project } = result;

  assert.equal(catalog.catalogId, "tehkne-universal-components-v1+display-system-v1+display-system-v1");
  assert.equal(project.projectId, "tv-01");
  assert.equal(project.rootEntityId, "tv.root");
  assert.equal(project.metadata.productFamily, "display-system");
  assert.equal(project.metadata.productCompositionVersion, "1");
  assert.equal(project.metadata.signature, "Tehkné Solutions");
  assert.equal(result.componentCount, 11);
  assert.equal(result.connectionCount, 13);
  assert.deepEqual(validateProject(project), []);

  const components = project.entities.filter((entity) => entity.metadata.provenance === "component-library");
  assert.equal(components.length, 11);
  assert.ok(components.every((entity) => entity.metadata.componentDefinitionId));

  const byId = new Map(project.entities.map((entity) => [entity.id, entity]));
  assert.equal(byId.get("tv.psu").properties.ratedPowerW.value, 220);
  assert.equal(byId.get("tv.soc").properties.cpuCores.value, 6);
  assert.equal(byId.get("tv.storage").properties.capacityGB.value, 32);
  assert.equal(byId.get("tv.panel").properties.diagonalIn.value, 55);
  assert.equal(byId.get("tv.speakers").properties.ratedPowerW.value, 30);

  for (const relationship of project.relationships.filter((item) => item.type === "connectedTo")) {
    assert.equal(relationship.metadata.validatedBy, "component-library");
    assert.ok(relationship.metadata.sharedInterfaces.length >= 1);
  }
  const hdmi = project.relationships.find((item) => item.id === "connection.tv-hdmi-video");
  const audio = project.relationships.find((item) => item.id === "connection.tv-audio");
  const mains = project.relationships.find((item) => item.id === "connection.tv-mains-to-psu");
  assert.deepEqual(hdmi.metadata.sharedInterfaces, ["video.hdmi"]);
  assert.deepEqual(audio.metadata.sharedInterfaces, ["audio.line-level"]);
  assert.deepEqual(mains.metadata.sharedInterfaces, ["power.ac.mains"]);
});

test("S2.7 TV 01 boots healthy, PSU teardown creates causal POST failure and reinstall restores RUNNING", async () => {
  const { baseCatalog, extension, overlay, profile } = await inputs();
  const { registry } = createDisplaySystemRegistry(baseCatalog, extension, overlay);
  const session = new EngineeringSession(createDisplaySystemProject(profile, registry).project);

  const healthy = await session.executeCapability("tv.root", "powerOn");
  assert.equal(healthy.result.bootRun.status, "success");
  assert.equal(healthy.result.bootRun.finalStage, "RUNNING");

  await session.executeCapability("tv.root", "open");
  const psu = session.getEntity("tv.psu");
  assert.equal(psu.metadata.componentDefinitionId, "power.supply.ac-dc-v1");
  assert.equal(psu.metadata.teardownContext, true);
  assert.equal(psu.state, "connected");

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

test("S2.7 display-system overlay remains necessary for reused storage wireless and MCU definitions", async () => {
  const { baseCatalog, extension, profile } = await inputs();
  const extended = applyComponentCatalogExtension(parseComponentCatalog(baseCatalog), extension);
  const registry = new ComponentRegistry(extended);
  const errors = validateDisplaySystemProfile(profile, registry);
  assert.ok(errors.some((error) => error.includes("storage.solid-state.general-v1 is not declared for display-system")));
  assert.ok(errors.some((error) => error.includes("communication.wireless.combo-v1 is not declared for display-system")));
  assert.ok(errors.some((error) => error.includes("control.mcu.general-v1 is not declared for display-system")));
  assert.throws(() => createDisplaySystemProject(profile, registry), /Invalid display-system profile/);
});

test("S2.7 TV tuning remains bounded by canonical Engineering Property constraints", async () => {
  const { baseCatalog, extension, overlay, profile } = await inputs();
  const { registry } = createDisplaySystemRegistry(baseCatalog, extension, overlay);
  const invalid = {
    ...profile,
    tuning: profile.tuning.map((entry) => entry.slotId === "panel"
      ? { ...entry, propertyValues: { ...entry.propertyValues, diagonalIn: 200 } }
      : entry)
  };
  assert.throws(() => createDisplaySystemProject(invalid, registry), /above maximum/);
});
