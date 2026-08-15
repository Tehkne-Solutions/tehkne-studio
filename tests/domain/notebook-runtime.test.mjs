import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { applyComponentCatalogOverlay } from "../../dist/packages/component-library/src/overlay.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import {
  createNotebookProject,
  createNotebookRegistry,
  validateNotebookProfile
} from "../../dist/packages/notebook-runtime/src/index.js";
import { validateProject } from "../../dist/packages/project-format/src/index.js";

async function inputs() {
  const [baseCatalog, overlay, profile] = await Promise.all([
    readFile("library/components/catalog.json", "utf8").then(JSON.parse),
    readFile("library/components/overlays/notebook-v1.json", "utf8").then(JSON.parse),
    readFile("presets/notebook-01/profile.json", "utf8").then(JSON.parse)
  ]);
  return { baseCatalog, overlay, profile };
}

test("S2.5 signed Notebook overlay extends the catalog without mutating the S2.3 base", async () => {
  const { baseCatalog, overlay } = await inputs();
  const base = parseComponentCatalog(baseCatalog);
  const baseRegistry = new ComponentRegistry(base);
  const baseDisplay = baseRegistry.get("display.oled.touch-v1");
  const baseSoc = baseRegistry.get("compute.soc.mobile-v1");
  assert.equal(baseDisplay.productFamilies.includes("notebook"), false);
  assert.equal(baseSoc.ports.thermal, undefined);
  assert.equal(baseSoc.ports["usb-host"], undefined);
  assert.equal(baseSoc.ports["memory-ddr"], undefined);

  const merged = applyComponentCatalogOverlay(base, overlay);
  const registry = new ComponentRegistry(merged);
  assert.equal(registry.get("display.oled.touch-v1").productFamilies.includes("notebook"), true);
  assert.equal(registry.get("control.mcu.general-v1").productFamilies.includes("notebook"), true);
  assert.deepEqual(registry.get("compute.soc.mobile-v1").ports.thermal.compatibility, ["thermal.compute-spreader"]);
  assert.deepEqual(registry.get("compute.soc.mobile-v1").ports["usb-host"].compatibility, ["usb.usb-c"]);
  assert.deepEqual(registry.get("compute.soc.mobile-v1").ports["memory-ddr"].compatibility, ["memory.ddr"]);

  assert.equal(baseRegistry.get("display.oled.touch-v1").productFamilies.includes("notebook"), false, "overlay must not mutate base catalog");
  assert.throws(() => applyComponentCatalogOverlay(base, { ...overlay, signature: "Other" }), /signature must be Tehkné Solutions/);
  assert.throws(() => applyComponentCatalogOverlay(base, { ...overlay, mutations: [{ definitionId: "missing.component", addProductFamilies: ["notebook"] }] }), /unknown definition/);
});

test("S2.5 Notebook 01 materializes 12 reusable components with 17 validated connections and authored tuning", async () => {
  const { baseCatalog, overlay, profile } = await inputs();
  const { catalog, registry } = createNotebookRegistry(baseCatalog, overlay);
  const result = createNotebookProject(profile, registry);
  const { project } = result;

  assert.equal(catalog.catalogId, "tehkne-universal-components-v1+notebook-v1");
  assert.equal(project.projectId, "notebook-01");
  assert.equal(project.rootEntityId, "notebook.root");
  assert.equal(project.metadata.productFamily, "notebook");
  assert.equal(project.metadata.productCompositionVersion, "1");
  assert.equal(project.metadata.signature, "Tehkné Solutions");
  assert.equal(result.componentCount, 12);
  assert.equal(result.connectionCount, 17);
  assert.deepEqual(validateProject(project), []);

  const components = project.entities.filter((entity) => entity.metadata.provenance === "component-library");
  assert.equal(components.length, 12);
  assert.ok(components.every((entity) => entity.metadata.componentDefinitionId));
  assert.ok(components.every((entity) => entity.metadata.notebookSlotId));

  const byId = new Map(project.entities.map((entity) => [entity.id, entity]));
  assert.equal(byId.get("notebook.battery").properties.capacityWh.value, 55);
  assert.equal(byId.get("notebook.soc").properties.cpuCores.value, 12);
  assert.equal(byId.get("notebook.soc").properties.nominalPowerW.value, 24);
  assert.equal(byId.get("notebook.memory").properties.capacityGB.value, 16);
  assert.equal(byId.get("notebook.storage").properties.capacityGB.value, 512);
  assert.equal(byId.get("notebook.display").properties.diagonalIn.value, 14);
  assert.equal(byId.get("notebook.camera").properties.megapixels.value, 2);

  for (const relationship of project.relationships.filter((item) => item.type === "connectedTo")) {
    assert.equal(relationship.metadata.validatedBy, "component-library");
    assert.ok(relationship.metadata.sharedInterfaces.length >= 1);
  }
});

test("S2.5 Notebook DDR teardown produces causal POST failure and reinstall restores RUNNING", async () => {
  const { baseCatalog, overlay, profile } = await inputs();
  const { registry } = createNotebookRegistry(baseCatalog, overlay);
  const { project } = createNotebookProject(profile, registry);
  const session = new EngineeringSession(project);

  const healthy = await session.executeCapability("notebook.root", "powerOn");
  assert.equal(healthy.result.bootRun.status, "success");
  assert.equal(healthy.result.bootRun.finalStage, "RUNNING");

  await session.executeCapability("notebook.root", "open");
  const memory = session.getEntity("notebook.memory");
  assert.equal(memory.metadata.componentDefinitionId, "memory.ddr.module-v1");
  assert.equal(memory.metadata.teardownContext, true);
  assert.ok(memory.capabilities.some((capability) => capability.id === "remove"));
  assert.ok(memory.capabilities.some((capability) => capability.id === "insert"));

  await session.executeCapability("notebook.memory", "remove");
  const failed = await session.executeCapability("notebook.root", "powerOn");
  assert.equal(failed.result.bootRun.status, "failure");
  assert.equal(failed.result.bootRun.fault.entityId, "notebook.memory");
  assert.equal(failed.result.bootRun.fault.stage, "POST");

  const why = await session.executeCapability("notebook.boot", "why");
  assert.match(why.result.explanation, /DDR Memory/);
  assert.ok(why.result.causalTrace.some((step) => step.entityId === "notebook.memory"));

  await session.executeCapability("notebook.memory", "insert");
  const recovered = await session.executeCapability("notebook.root", "powerOn");
  assert.equal(recovered.result.bootRun.status, "success");
  assert.equal(recovered.result.bootRun.finalStage, "RUNNING");
});

test("S2.5 Notebook battery remains a second independent causal teardown point", async () => {
  const { baseCatalog, overlay, profile } = await inputs();
  const { registry } = createNotebookRegistry(baseCatalog, overlay);
  const session = new EngineeringSession(createNotebookProject(profile, registry).project);
  await session.executeCapability("notebook.root", "open");
  await session.executeCapability("notebook.battery", "remove");
  const failed = await session.executeCapability("notebook.root", "powerOn");
  assert.equal(failed.result.bootRun.status, "failure");
  assert.equal(failed.result.bootRun.fault.entityId, "notebook.battery");
  await session.executeCapability("notebook.battery", "insert");
  assert.equal((await session.executeCapability("notebook.root", "powerOn")).result.bootRun.status, "success");
});

test("S2.5 Notebook cannot materialize against the unextended S2.3 catalog", async () => {
  const { baseCatalog, profile } = await inputs();
  const baseRegistry = new ComponentRegistry(parseComponentCatalog(baseCatalog));
  const errors = validateNotebookProfile(profile, baseRegistry);
  assert.ok(errors.some((error) => error.includes("display.oled.touch-v1 is not declared for notebook")));
  assert.ok(errors.some((error) => error.includes("missing source port memory-ddr")));
  assert.ok(errors.some((error) => error.includes("missing source port thermal")));
  assert.ok(errors.some((error) => error.includes("missing source port usb-host")));
  assert.throws(() => createNotebookProject(profile, baseRegistry), /Invalid notebook profile/);
});

test("S2.5 Notebook tuning remains bounded by Engineering Property constraints", async () => {
  const { baseCatalog, overlay, profile } = await inputs();
  const { registry } = createNotebookRegistry(baseCatalog, overlay);
  const invalid = {
    ...profile,
    tuning: profile.tuning.map((entry) => entry.slotId === "display"
      ? { ...entry, propertyValues: { ...entry.propertyValues, diagonalIn: 200 } }
      : entry)
  };
  assert.throws(() => createNotebookProject(invalid, registry), /above maximum/);
});
