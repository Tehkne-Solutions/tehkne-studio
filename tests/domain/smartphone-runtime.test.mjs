import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { validateProject } from "../../dist/packages/project-format/src/index.js";
import {
  createSmartphoneProject,
  validateSmartphoneProfile
} from "../../dist/packages/smartphone-runtime/src/index.js";

async function inputs() {
  const [catalog, profile] = await Promise.all([
    readFile("library/components/catalog.json", "utf8").then(JSON.parse),
    readFile("presets/smartphone-01/profile.json", "utf8").then(JSON.parse)
  ]);
  return { registry: new ComponentRegistry(parseComponentCatalog(catalog)), profile };
}

test("S2.4 Smartphone 01 materializes from Universal Component Library with validated interfaces", async () => {
  const { registry, profile } = await inputs();
  const result = createSmartphoneProject(profile, registry);
  const { project } = result;

  assert.equal(project.projectId, "smartphone-01");
  assert.equal(project.rootEntityId, "phone.root");
  assert.equal(project.metadata.signature, "Tehkné Solutions");
  assert.equal(project.metadata.materializedFrom, "tehkne-universal-components-v1");
  assert.equal(result.componentCount, 11);
  assert.equal(result.connectionCount, 15);
  assert.deepEqual(validateProject(project), []);

  const componentEntities = project.entities.filter((entity) => entity.metadata.provenance === "component-library");
  assert.equal(componentEntities.length, 11);
  for (const entity of componentEntities) {
    assert.equal(entity.metadata.componentLibraryVersion, "1");
    assert.equal(entity.metadata.signature, "Tehkné Solutions");
    assert.equal(typeof entity.metadata.componentDefinitionId, "string");
    assert.equal(typeof entity.metadata.smartphoneSlotId, "string");
    assert.ok(entity.metadata.spatial);
  }

  const connected = project.relationships.filter((relationship) => relationship.type === "connectedTo");
  assert.equal(connected.length, 15);
  for (const relationship of connected) {
    assert.equal(relationship.metadata.validatedBy, "component-library");
    assert.ok(Array.isArray(relationship.metadata.sharedInterfaces));
    assert.ok(relationship.metadata.sharedInterfaces.length >= 1);
  }
});

test("S2.4 Smartphone functional boot succeeds with all library components available", async () => {
  const { registry, profile } = await inputs();
  const { project } = createSmartphoneProject(profile, registry);
  const session = new EngineeringSession(project);

  const result = await session.executeCapability("phone.root", "powerOn");
  assert.equal(result.ok, true);
  assert.equal(result.result.bootRun.status, "success");
  assert.equal(result.result.bootRun.finalStage, "RUNNING");
  assert.equal(session.getEntity("phone.root").properties.powerState.value, "on");
  assert.equal(session.getEntity("phone.boot").state, "running");
});

test("S2.4 battery teardown creates causal POST failure and reinstall restores the same phone", async () => {
  const { registry, profile } = await inputs();
  const { project } = createSmartphoneProject(profile, registry);
  const session = new EngineeringSession(project);

  await session.executeCapability("phone.root", "open");
  const battery = session.getEntity("phone.battery");
  assert.equal(battery.metadata.componentDefinitionId, "energy.battery.lithium-ion-v1");
  assert.equal(battery.metadata.teardownContext, true);
  assert.ok(battery.capabilities.some((capability) => capability.id === "remove"));
  assert.ok(battery.capabilities.some((capability) => capability.id === "insert"));

  const removed = await session.executeCapability("phone.battery", "remove");
  assert.equal(removed.ok, true);
  assert.equal(session.getEntity("phone.battery").state, "removed");
  assert.equal(session.getEntity("phone.battery").properties.connected.value, false);

  const failedBoot = await session.executeCapability("phone.root", "powerOn");
  assert.equal(failedBoot.ok, true);
  assert.equal(failedBoot.result.bootRun.status, "failure");
  assert.equal(failedBoot.result.bootRun.fault.entityId, "phone.battery");
  assert.equal(failedBoot.result.bootRun.fault.stage, "POST");
  assert.equal(session.getEntity("phone.root").properties.powerState.value, "fault");

  const why = await session.executeCapability("phone.boot", "why");
  assert.equal(why.ok, true);
  assert.match(why.result.explanation, /Battery Pack/);
  assert.ok(why.result.causalTrace.some((step) => step.entityId === "phone.battery"));

  const inserted = await session.executeCapability("phone.battery", "insert");
  assert.equal(inserted.ok, true);
  assert.equal(session.getEntity("phone.battery").properties.connected.value, true);

  const recovered = await session.executeCapability("phone.root", "powerOn");
  assert.equal(recovered.ok, true);
  assert.equal(recovered.result.bootRun.status, "success");
  assert.equal(recovered.result.bootRun.finalStage, "RUNNING");
  assert.equal(session.getEntity("phone.root").properties.powerState.value, "on");
});

test("S2.4 smartphone profile rejects incompatible interfaces before project materialization", async () => {
  const { registry, profile } = await inputs();
  const invalid = {
    ...profile,
    connections: profile.connections.map((connection) =>
      connection.id === "phone-power-source"
        ? { ...connection, to: ["camera", "video-out"] }
        : connection
    )
  };
  const errors = validateSmartphoneProfile(invalid, registry);
  assert.ok(errors.some((error) => error.includes("incompatible interfaces")));
  assert.throws(() => createSmartphoneProject(invalid, registry), /Invalid smartphone profile/);
});

test("S2.4 smartphone boot graph depends only on declared essential component slots", async () => {
  const { registry, profile } = await inputs();
  const { project } = createSmartphoneProject(profile, registry);
  const dependencies = project.relationships.filter((relationship) => relationship.source === "phone.boot" && relationship.type === "dependsOn");
  assert.deepEqual(
    new Set(dependencies.map((relationship) => relationship.target)),
    new Set(["phone.battery", "phone.regulator", "phone.soc", "phone.memory", "phone.storage", "phone.display"])
  );
  assert.equal(dependencies.some((relationship) => relationship.target === "phone.camera"), false);
  assert.equal(dependencies.some((relationship) => relationship.target === "phone.wireless"), false);
});
