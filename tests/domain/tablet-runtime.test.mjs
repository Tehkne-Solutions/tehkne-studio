import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { validateProject } from "../../dist/packages/project-format/src/index.js";
import {
  createTabletProject,
  createTabletRegistry,
  validateTabletProfile
} from "../../dist/packages/tablet-runtime/src/index.js";

async function inputs() {
  const [baseCatalog, overlay, profile] = await Promise.all([
    readFile("library/components/catalog.json", "utf8").then(JSON.parse),
    readFile("library/components/overlays/tablet-v1.json", "utf8").then(JSON.parse),
    readFile("presets/tablet-01/profile.json", "utf8").then(JSON.parse)
  ]);
  return { baseCatalog, overlay, profile };
}

test("S2.6 Tablet overlay adds only the missing tablet controller family", async () => {
  const { baseCatalog, overlay } = await inputs();
  const baseRegistry = new ComponentRegistry(parseComponentCatalog(baseCatalog));
  assert.equal(baseRegistry.get("control.mcu.general-v1").productFamilies.includes("tablet"), false);

  const { catalog, registry } = createTabletRegistry(baseCatalog, overlay);
  assert.equal(catalog.catalogId, "tehkne-universal-components-v1+tablet-v1");
  assert.equal(registry.get("control.mcu.general-v1").productFamilies.includes("tablet"), true);
  assert.equal(registry.list().length, baseRegistry.list().length, "overlay must not duplicate component definitions");
  assert.equal(baseRegistry.get("control.mcu.general-v1").productFamilies.includes("tablet"), false, "overlay must not mutate base catalog");
});

test("S2.6 Tablet 01 materializes 12 reusable components with 17 validated connections and tuning", async () => {
  const { baseCatalog, overlay, profile } = await inputs();
  const { registry } = createTabletRegistry(baseCatalog, overlay);
  const result = createTabletProject(profile, registry);
  const { project } = result;

  assert.equal(project.projectId, "tablet-01");
  assert.equal(project.rootEntityId, "tablet.root");
  assert.equal(project.metadata.productFamily, "tablet");
  assert.equal(project.metadata.productCompositionVersion, "1");
  assert.equal(project.metadata.signature, "Tehkné Solutions");
  assert.equal(result.componentCount, 12);
  assert.equal(result.connectionCount, 17);
  assert.deepEqual(validateProject(project), []);

  const components = project.entities.filter((entity) => entity.metadata.provenance === "component-library");
  assert.equal(components.length, 12);
  assert.ok(components.every((entity) => entity.metadata.tabletSlotId));

  const byId = new Map(project.entities.map((entity) => [entity.id, entity]));
  assert.equal(byId.get("tablet.battery").properties.capacityWh.value, 30);
  assert.equal(byId.get("tablet.soc").properties.cpuCores.value, 10);
  assert.equal(byId.get("tablet.soc").properties.nominalPowerW.value, 15);
  assert.equal(byId.get("tablet.memory").properties.capacityGB.value, 12);
  assert.equal(byId.get("tablet.storage").properties.capacityGB.value, 512);
  assert.equal(byId.get("tablet.display").properties.diagonalIn.value, 11);
  assert.equal(byId.get("tablet.camera").properties.megapixels.value, 12);
  assert.equal(byId.get("tablet.input").properties.clockMHz.value, 240);

  for (const relationship of project.relationships.filter((item) => item.type === "connectedTo")) {
    assert.equal(relationship.metadata.validatedBy, "component-library");
    assert.ok(relationship.metadata.sharedInterfaces.length >= 1);
  }
});

test("S2.6 Tablet battery teardown produces causal POST failure and persistence-ready recovery state", async () => {
  const { baseCatalog, overlay, profile } = await inputs();
  const { registry } = createTabletRegistry(baseCatalog, overlay);
  const session = new EngineeringSession(createTabletProject(profile, registry).project);

  assert.equal((await session.executeCapability("tablet.root", "powerOn")).result.bootRun.status, "success");
  await session.executeCapability("tablet.root", "open");
  const battery = session.getEntity("tablet.battery");
  assert.equal(battery.metadata.teardownContext, true);
  assert.ok(battery.capabilities.some((capability) => capability.id === "remove"));
  assert.ok(battery.capabilities.some((capability) => capability.id === "insert"));

  await session.executeCapability("tablet.battery", "remove");
  const failed = await session.executeCapability("tablet.root", "powerOn");
  assert.equal(failed.result.bootRun.status, "failure");
  assert.equal(failed.result.bootRun.fault.entityId, "tablet.battery");
  assert.equal(failed.result.bootRun.fault.stage, "POST");

  const why = await session.executeCapability("tablet.boot", "why");
  assert.match(why.result.explanation, /Tablet Battery/);
  assert.ok(why.result.causalTrace.some((step) => step.entityId === "tablet.battery"));

  await session.executeCapability("tablet.battery", "insert");
  const recovered = await session.executeCapability("tablet.root", "powerOn");
  assert.equal(recovered.result.bootRun.status, "success");
  assert.equal(recovered.result.bootRun.finalStage, "RUNNING");
});

test("S2.6 Tablet cannot materialize without its signed controller-family overlay", async () => {
  const { baseCatalog, profile } = await inputs();
  const baseRegistry = new ComponentRegistry(parseComponentCatalog(baseCatalog));
  const errors = validateTabletProfile(profile, baseRegistry);
  assert.ok(errors.some((error) => error.includes("control.mcu.general-v1 is not declared for tablet")));
  assert.throws(() => createTabletProject(profile, baseRegistry), /Invalid tablet profile/);
});

test("S2.6 Tablet tuning remains bounded by Engineering Property constraints", async () => {
  const { baseCatalog, overlay, profile } = await inputs();
  const { registry } = createTabletRegistry(baseCatalog, overlay);
  const invalid = {
    ...profile,
    tuning: profile.tuning.map((entry) => entry.slotId === "memory"
      ? { ...entry, propertyValues: { capacityGB: 128 } }
      : entry)
  };
  assert.throws(() => createTabletProject(invalid, registry), /above maximum/);
});

test("S2.6 Tablet touch controller bridges the SoC sensor bus to the display touch interface", async () => {
  const { baseCatalog, overlay, profile } = await inputs();
  const { registry } = createTabletRegistry(baseCatalog, overlay);
  const { project } = createTabletProject(profile, registry);
  const controllerEdges = project.relationships.filter((item) => item.source === "tablet.input" || item.target === "tablet.input");
  assert.ok(controllerEdges.some((item) => item.id === "tablet-input-host" && item.metadata.sharedInterfaces.includes("bus.i2c-spi")));
  assert.ok(controllerEdges.some((item) => item.id === "tablet-touch-controller" && item.metadata.sharedInterfaces.includes("bus.i2c-spi")));
});
