import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import {
  INVENTION_RUNTIME_SIGNATURE,
  InventionBuilder,
  createBlankInventionProject
} from "../../dist/packages/invention-runtime/src/index.js";
import {
  createSessionSnapshot,
  restoreSessionSnapshot
} from "../../dist/packages/persistence-runtime/src/index.js";

async function runtime() {
  const catalog = JSON.parse(await readFile("library/components/catalog.json", "utf8"));
  const registry = new ComponentRegistry(parseComponentCatalog(catalog));
  const session = new EngineeringSession(createBlankInventionProject());
  return { registry, session, builder: new InventionBuilder(session, registry) };
}

async function canonicalPhoneCore() {
  const value = await runtime();
  const battery = value.builder.addComponent("energy.battery.lithium-ion-v1");
  const regulator = value.builder.addComponent("power.regulator.dc-v1");
  const soc = value.builder.addComponent("compute.soc.mobile-v1");
  const display = value.builder.addComponent("display.oled.touch-v1");
  return { ...value, battery, regulator, soc, display };
}

test("S2.10 blank invention starts as a signed non-preset Engineering Graph", async () => {
  const { session, builder } = await runtime();
  assert.equal(session.project.projectType, "invention");
  assert.equal(session.project.rootEntityId, "invention.root");
  assert.equal(session.project.metadata.signature, INVENTION_RUNTIME_SIGNATURE);
  assert.equal(session.project.metadata.preset, false);
  assert.equal(builder.components().length, 0);
  assert.equal(builder.connections().length, 0);
  assert.equal(builder.document().simulationStatus, "not-requested");
});

test("S2.10 materializes canonical Component Library definitions without product-specific glue", async () => {
  const { session, builder, battery, regulator, soc, display } = await canonicalPhoneCore();
  assert.equal(builder.components().length, 4);
  for (const entity of [battery, regulator, soc, display]) {
    assert.equal(entity.parentId, "invention.root");
    assert.equal(entity.metadata.provenance, "component-library");
    assert.equal(entity.metadata.inventionComponent, true);
    assert.equal(entity.metadata.signature, "Tehkné Solutions");
  }
  assert.equal(session.getEntity("invention.root").properties.compositionStatus.value, "components-added");
});

test("S2.10 connects only compatible available ports and records shared interfaces", async () => {
  const { session, builder, battery, regulator, soc, display } = await canonicalPhoneCore();
  const powerSource = builder.connect(
    { entityId: battery.id, portId: "dc-output" },
    { entityId: regulator.id, portId: "dc-input" }
  );
  const socPower = builder.connect(
    { entityId: regulator.id, portId: "regulated-output" },
    { entityId: soc.id, portId: "power-in" }
  );
  const image = builder.connect(
    { entityId: soc.id, portId: "display-out" },
    { entityId: display.id, portId: "display-in" }
  );

  assert.deepEqual(powerSource.sharedInterfaces, ["power.dc.source"]);
  assert.deepEqual(socPower.sharedInterfaces, ["power.dc.low-voltage"]);
  assert.deepEqual(image.sharedInterfaces, ["display.mipi-dsi"]);
  assert.equal(builder.connections().length, 3);
  assert.ok(builder.connections().every((relation) => relation.type === "connectedTo" && relation.metadata.validatedBy === "component-library"));
  assert.equal(session.getEntity(battery.id).ports["dc-output"].state, "connected");
  assert.equal(session.getEntity(display.id).ports["display-in"].state, "connected");
  assert.equal(session.getEntity("invention.root").properties.compositionStatus.value, "composed");
});

test("S2.10 remains fail closed for self, incompatible and occupied port connections", async () => {
  const { builder, battery, regulator, soc, display } = await canonicalPhoneCore();
  assert.throws(
    () => builder.connect({ entityId: battery.id, portId: "dc-output" }, { entityId: battery.id, portId: "charge-input" }),
    /cannot connect a component to itself/
  );
  assert.throws(
    () => builder.connect({ entityId: battery.id, portId: "dc-output" }, { entityId: display.id, portId: "display-in" }),
    /Incompatible invention ports/
  );
  builder.connect({ entityId: battery.id, portId: "dc-output" }, { entityId: regulator.id, portId: "dc-input" });
  assert.throws(
    () => builder.connect({ entityId: battery.id, portId: "dc-output" }, { entityId: soc.id, portId: "power-in" }),
    /already occupied/
  );
});

test("S2.10 requires explicit disconnect before component removal", async () => {
  const { session, builder, battery, regulator } = await canonicalPhoneCore();
  const connection = builder.connect(
    { entityId: battery.id, portId: "dc-output" },
    { entityId: regulator.id, portId: "dc-input" }
  );
  assert.throws(() => builder.removeComponent(battery.id), /Disconnect 1 invention connection/);
  builder.disconnect(connection.id);
  assert.equal(session.getEntity(battery.id).ports["dc-output"].state, "available");
  assert.equal(session.getEntity(regulator.id).ports["dc-input"].state, "available");
  builder.removeComponent(battery.id);
  assert.equal(builder.components().some((entity) => entity.id === battery.id), false);
});

test("S2.10 snapshot restores the authored topology without replay or duplicate materialization", async () => {
  const { registry, session, builder, battery, regulator, soc, display } = await canonicalPhoneCore();
  builder.connect({ entityId: battery.id, portId: "dc-output" }, { entityId: regulator.id, portId: "dc-input" });
  builder.connect({ entityId: regulator.id, portId: "regulated-output" }, { entityId: soc.id, portId: "power-in" });
  builder.connect({ entityId: soc.id, portId: "display-out" }, { entityId: display.id, portId: "display-in" });
  const beforeEvents = session.events.list().length;
  const snapshot = createSessionSnapshot(session, { extensions: { invention: builder.document() } });
  const restoredSession = restoreSessionSnapshot(snapshot);
  const restored = new InventionBuilder(restoredSession, registry);

  assert.equal(restored.components().length, 4);
  assert.equal(restored.connections().length, 3);
  assert.equal(restoredSession.events.list().length, beforeEvents);
  assert.equal(restored.document().signature, INVENTION_RUNTIME_SIGNATURE);
  assert.deepEqual(
    restored.document().connections.map((connection) => connection.sharedInterfaces),
    [["power.dc.source"], ["power.dc.low-voltage"], ["display.mipi-dsi"]]
  );
});
