import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { InventionBuilder, createBlankInventionProject } from "../../dist/packages/invention-runtime/src/index.js";
import {
  INVENTION_SPATIAL_SIGNATURE,
  InventionSpatialScene,
  parseInventionSpatialDocument
} from "../../dist/packages/invention-spatial-runtime/src/index.js";

async function runtime() {
  const catalog = JSON.parse(await readFile("library/components/catalog.json", "utf8"));
  const registry = new ComponentRegistry(parseComponentCatalog(catalog));
  const session = new EngineeringSession(createBlankInventionProject("spatial-invention-01"));
  const builder = new InventionBuilder(session, registry);
  const spatial = new InventionSpatialScene(session);
  return { catalog, registry, session, builder, spatial };
}

async function canonicalSpatialCore() {
  const value = await runtime();
  const battery = value.builder.addComponent("energy.battery.lithium-ion-v1");
  const regulator = value.builder.addComponent("power.regulator.dc-v1");
  const soc = value.builder.addComponent("compute.soc.mobile-v1");
  const display = value.builder.addComponent("display.oled.touch-v1");
  for (const entity of [battery, regulator, soc, display]) value.spatial.ensureComponent(entity.id);
  return { ...value, battery, regulator, soc, display };
}

test("S2.11 spatial scene binds the same invention Engineering Entities instead of cloning domain state", async () => {
  const { session, spatial, battery, regulator, soc, display } = await canonicalSpatialCore();
  assert.equal(spatial.bindings().length, 4);
  for (const entity of [battery, regulator, soc, display]) {
    const binding = spatial.binding(entity.id);
    assert.equal(binding.entityId, entity.id);
    assert.equal(binding.selectable, true);
    assert.equal(spatial.select(entity.id).entity, session.getEntity(entity.id));
  }
  assert.equal(spatial.document().signature, INVENTION_SPATIAL_SIGNATURE);
});

test("S2.11 move is bounded, finite and preserves entity identity", async () => {
  const { spatial, battery } = await canonicalSpatialCore();
  const moved = spatial.move(battery.id, { x: 0.42, y: -0.18, z: 0.04 });
  assert.deepEqual(moved.position, { x: 0.42, y: -0.18, z: 0.04 });
  assert.equal(spatial.select(battery.id).entity.id, battery.id);
  assert.throws(() => spatial.move(battery.id, { x: 0.7, y: 0, z: 0 }), /outside invention workspace bounds/);
  assert.throws(() => spatial.move(battery.id, { x: Number.NaN, y: 0, z: 0 }), /must be finite/);
});

test("S2.11 visual wire segments derive from the authored connectedTo relationships and follow movement", async () => {
  const { builder, spatial, battery, regulator } = await canonicalSpatialCore();
  const connection = builder.connect(
    { entityId: battery.id, portId: "dc-output" },
    { entityId: regulator.id, portId: "dc-input" }
  );
  const before = spatial.connectionSegments(builder.connections());
  assert.equal(before.length, 1);
  assert.equal(before[0].relationshipId, connection.id);
  assert.deepEqual(before[0].sharedInterfaces, ["power.dc.source"]);

  spatial.move(battery.id, { x: -0.45, y: -0.22, z: 0 });
  const after = spatial.connectionSegments(builder.connections());
  assert.deepEqual(after[0].source, { x: -0.45, y: -0.22, z: 0 });
  assert.deepEqual(after[0].target, before[0].target);
});

test("S2.11 spatial document restores exact layout and rejects tampered or incomplete evidence", async () => {
  const { session, spatial, battery } = await canonicalSpatialCore();
  spatial.move(battery.id, { x: 0.31, y: 0.21, z: 0 });
  const document = spatial.document();
  const parsed = parseInventionSpatialDocument(JSON.parse(JSON.stringify(document)));
  const restored = new InventionSpatialScene(session, parsed);
  assert.deepEqual(restored.document(), document);

  assert.throws(
    () => parseInventionSpatialDocument({ ...document, signature: "Other" }),
    /Invalid invention spatial signature/
  );
  assert.throws(
    () => new InventionSpatialScene(session, { ...document, bindings: document.bindings.slice(1) }),
    /does not cover the current component graph/
  );
});

test("S2.11 default layout covers the complete canonical base catalog without leaving workspace bounds", async () => {
  const { catalog, builder, spatial } = await runtime();
  for (const definition of catalog.components) {
    const entity = builder.addComponent(definition.definitionId);
    const binding = spatial.ensureComponent(entity.id);
    assert.ok(binding.position.x >= -0.5 && binding.position.x <= 0.5);
    assert.ok(binding.position.y >= -0.3 && binding.position.y <= 0.3);
  }
  assert.equal(spatial.bindings().length, catalog.components.length);
});
