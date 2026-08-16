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

test("S2.22 transformBatch commits position and rotation for multiple bindings in one validated transaction", async () => {
  const { spatial, battery, regulator } = await canonicalSpatialCore();
  const result = spatial.transformBatch([
    {
      entityId: battery.id,
      position: { x: -0.21, y: 0.11, z: 0.04 },
      rotation: { x: 0.1, y: 0.2, z: 0.3 }
    },
    {
      entityId: regulator.id,
      position: { x: 0.19, y: -0.08, z: 0.12 },
      rotation: { x: -0.2, y: 0.4, z: -0.1 }
    }
  ]);

  assert.equal(result.length, 2);
  assert.deepEqual(spatial.binding(battery.id).position, { x: -0.21, y: 0.11, z: 0.04 });
  assert.deepEqual(spatial.binding(battery.id).rotation, { x: 0.1, y: 0.2, z: 0.3 });
  assert.deepEqual(spatial.binding(regulator.id).position, { x: 0.19, y: -0.08, z: 0.12 });
  assert.deepEqual(spatial.binding(regulator.id).rotation, { x: -0.2, y: 0.4, z: -0.1 });
});

test("S2.22 transformBatch validates the complete batch before mutating any binding", async () => {
  const { spatial, battery, regulator } = await canonicalSpatialCore();
  const batteryBefore = spatial.binding(battery.id);
  const regulatorBefore = spatial.binding(regulator.id);

  assert.throws(
    () => spatial.transformBatch([
      {
        entityId: battery.id,
        position: { x: 0.2, y: 0.1, z: 0.05 },
        rotation: { x: 0, y: Math.PI / 4, z: 0 }
      },
      {
        entityId: regulator.id,
        position: { x: 0.8, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 }
      }
    ]),
    /outside invention workspace bounds/
  );

  assert.deepEqual(spatial.binding(battery.id), batteryBefore, "first mutation must not leak from a rejected batch");
  assert.deepEqual(spatial.binding(regulator.id), regulatorBefore, "rejected binding must remain untouched");

  assert.throws(
    () => spatial.transformBatch([
      {
        entityId: battery.id,
        position: batteryBefore.position,
        rotation: batteryBefore.rotation
      },
      {
        entityId: regulator.id,
        position: regulatorBefore.position,
        rotation: { x: Number.NaN, y: 0, z: 0 }
      }
    ]),
    /Spatial rotation x must be finite/
  );
  assert.deepEqual(spatial.binding(battery.id), batteryBefore);
  assert.deepEqual(spatial.binding(regulator.id), regulatorBefore);
});

test("S2.22 transformBatch rejects duplicate or unknown entities before commit", async () => {
  const { spatial, battery } = await canonicalSpatialCore();
  const before = spatial.binding(battery.id);
  const mutation = {
    entityId: battery.id,
    position: { x: 0.1, y: 0.1, z: 0.1 },
    rotation: { x: 0.1, y: 0.1, z: 0.1 }
  };

  assert.throws(() => spatial.transformBatch([mutation, mutation]), /Duplicate spatial transform entity/);
  assert.deepEqual(spatial.binding(battery.id), before);
  assert.throws(() => spatial.transformBatch([
    mutation,
    { entityId: "missing-component", position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
  ]), /Unknown invention spatial binding/);
  assert.deepEqual(spatial.binding(battery.id), before);
});

test("S2.22 atomic transforms persist and restore through the existing signed inventionSpatial document", async () => {
  const { session, spatial, battery, regulator } = await canonicalSpatialCore();
  spatial.transformBatch([
    { entityId: battery.id, position: { x: -0.15, y: 0.05, z: 0.08 }, rotation: { x: 0, y: 0.5, z: 0 } },
    { entityId: regulator.id, position: { x: 0.15, y: -0.05, z: 0.08 }, rotation: { x: 0, y: -0.5, z: 0 } }
  ]);
  const document = spatial.document();
  const restored = new InventionSpatialScene(session, parseInventionSpatialDocument(JSON.parse(JSON.stringify(document))));
  assert.deepEqual(restored.document(), document);
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
  assert.equal(before[0].sourcePortId, "dc-output");
  assert.equal(before[0].targetPortId, "dc-input");
  assert.deepEqual(before[0].sharedInterfaces, ["power.dc.source"]);

  spatial.move(battery.id, { x: -0.45, y: -0.22, z: 0 });
  const after = spatial.connectionSegments(builder.connections());
  assert.deepEqual(after[0].source, { x: -0.45, y: -0.22, z: 0 });
  assert.deepEqual(after[0].target, before[0].target);
  assert.equal(after[0].sourcePortId, before[0].sourcePortId);
  assert.equal(after[0].targetPortId, before[0].targetPortId);
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

test("S2.11 automatic layout reuses the first free slot after removal without colliding with surviving nodes", async () => {
  const { builder, spatial, regulator } = await canonicalSpatialCore();
  const released = spatial.binding(regulator.id).position;
  builder.removeComponent(regulator.id);
  spatial.removeComponent(regulator.id);

  const replacement = builder.addComponent("power.regulator.dc-v1");
  const replacementBinding = spatial.ensureComponent(replacement.id);
  assert.deepEqual(replacementBinding.position, released);

  const occupied = spatial.bindings().map((binding) => `${binding.position.x}:${binding.position.y}:${binding.position.z}`);
  assert.equal(new Set(occupied).size, occupied.length, "automatic spatial slots must remain unique");
});
