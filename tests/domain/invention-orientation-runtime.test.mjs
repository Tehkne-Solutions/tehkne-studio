import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { applyComponentCatalogExtension } from "../../dist/packages/component-library/src/extension.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import {
  alignedFollowerRotation,
  deriveMechanicalOrientationConstraints,
  mechanicalAxesAreAligned,
  mechanicalWorldAxis
} from "../../dist/packages/invention-assembly-runtime/src/index.js";
import { InventionSpatialScene, parseInventionSpatialDocument } from "../../dist/packages/invention-spatial-runtime/src/index.js";
import { InventionBuilder, createBlankInventionProject } from "../../dist/packages/invention-runtime/src/index.js";

async function orientationRuntime() {
  const base = parseComponentCatalog(JSON.parse(await readFile("library/components/catalog.json", "utf8")));
  const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
  const mechanical = JSON.parse(await readFile("library/components/extensions/mechanical-assembly-v1.json", "utf8"));
  const catalog = applyComponentCatalogExtension(applyComponentCatalogExtension(base, assetForge), mechanical);
  const registry = new ComponentRegistry(catalog);
  const session = new EngineeringSession(createBlankInventionProject("orientation-test-01"));
  const builder = new InventionBuilder(session, registry);
  const spatial = new InventionSpatialScene(session);
  return { session, builder, spatial };
}

function assertAxisClose(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual.x - expected.x) <= epsilon, `x ${actual.x} != ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) <= epsilon, `y ${actual.y} != ${expected.y}`);
  assert.ok(Math.abs(actual.z - expected.z) <= epsilon, `z ${actual.z} != ${expected.z}`);
}

test("S2.17 derives axis-aligned orientation from the same mechanical connectedTo relationship", async () => {
  const { session, builder, spatial } = await orientationRuntime();
  const motor = builder.addComponent("actuation.motor.dc-brushed-v1");
  const wheel = builder.addComponent("mechanical.wheel.drive-v1");
  spatial.ensureComponent(motor.id);
  spatial.ensureComponent(wheel.id);
  const relationship = builder.connect(
    { entityId: motor.id, portId: "shaft-out" },
    { entityId: wheel.id, portId: "hub-in" }
  );

  const constraints = deriveMechanicalOrientationConstraints(session, builder.connections());
  assert.equal(constraints.length, 1);
  assert.equal(constraints[0].relationshipId, relationship.id);
  assert.equal(constraints[0].constraint, "axis-aligned");
  assert.equal(constraints[0].derivedFrom, "engineering-graph");
  assert.deepEqual(constraints[0].driverAxisLocal, { x: 0, y: 0, z: 1 });
  assert.deepEqual(constraints[0].followerAxisLocal, { x: 0, y: 0, z: 1 });
  assert.deepEqual(constraints[0].sharedInterfaces, ["mechanical.rotary-shaft"]);
});

test("S2.17 generic quaternion solver aligns a follower axis after arbitrary driver rotation", () => {
  const driverAxis = { x: 0, y: 0, z: 1 };
  const followerAxis = { x: 0, y: 1, z: 0 };
  const driverRotation = { x: Math.PI / 5, y: Math.PI / 3, z: -Math.PI / 7 };
  const followerRotation = { x: 0, y: 0, z: 0 };
  const next = alignedFollowerRotation(driverAxis, followerAxis, driverRotation, followerRotation);
  const driverWorld = mechanicalWorldAxis(driverAxis, driverRotation);
  const followerWorld = mechanicalWorldAxis(followerAxis, next);
  assert.equal(mechanicalAxesAreAligned(driverWorld, followerWorld), true);
});

test("S2.17 spatial rotation mutates the same binding and survives document restore", async () => {
  const { session, builder, spatial } = await orientationRuntime();
  const motor = builder.addComponent("actuation.motor.dc-brushed-v1");
  spatial.ensureComponent(motor.id, { x: -0.2, y: 0.1, z: 0 });
  const rotation = { x: Math.PI / 8, y: Math.PI / 2, z: -Math.PI / 12 };
  const rotated = spatial.rotate(motor.id, rotation);
  assert.deepEqual(rotated.rotation, rotation);
  assert.deepEqual(rotated.position, { x: -0.2, y: 0.1, z: 0 });
  assert.equal(rotated.entityId, motor.id);
  assert.throws(() => spatial.rotate(motor.id, { x: Number.NaN, y: 0, z: 0 }), /Spatial rotation x must be finite/);

  const restored = new InventionSpatialScene(session, parseInventionSpatialDocument(JSON.parse(JSON.stringify(spatial.document()))));
  assert.deepEqual(restored.binding(motor.id).rotation, rotation);
  assert.deepEqual(restored.binding(motor.id).position, rotated.position);
});

test("S2.17 real motor shaft axis follows the binding Euler XYZ rotation without altering topology", async () => {
  const { session, builder, spatial } = await orientationRuntime();
  const motor = builder.addComponent("actuation.motor.dc-brushed-v1");
  const wheel = builder.addComponent("mechanical.wheel.drive-v1");
  spatial.ensureComponent(motor.id);
  spatial.ensureComponent(wheel.id);
  const relationship = builder.connect(
    { entityId: motor.id, portId: "shaft-out" },
    { entityId: wheel.id, portId: "hub-in" }
  );
  const before = builder.connections();
  spatial.rotate(motor.id, { x: 0, y: Math.PI / 2, z: 0 });
  const [constraint] = deriveMechanicalOrientationConstraints(session, builder.connections());
  const world = mechanicalWorldAxis(constraint.driverAxisLocal, spatial.binding(motor.id).rotation);
  assertAxisClose(world, { x: 1, y: 0, z: 0 });
  assert.deepEqual(builder.connections(), before);
  assert.equal(builder.connections()[0].id, relationship.id);
});
