import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ComponentRegistry,
  parseComponentCatalog
} from "../../dist/packages/component-library/src/index.js";
import { applyComponentCatalogExtension } from "../../dist/packages/component-library/src/extension.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import {
  coincidentFollowerPosition,
  deriveMechanicalAssemblyConstraints,
  endpointsAreCoincident,
  mechanicalAssemblyMembers,
  planMechanicalAssemblyTranslation
} from "../../dist/packages/invention-assembly-runtime/src/index.js";
import { InventionSpatialScene } from "../../dist/packages/invention-spatial-runtime/src/index.js";
import { InventionBuilder, createBlankInventionProject } from "../../dist/packages/invention-runtime/src/index.js";

async function assemblyRuntime() {
  const base = parseComponentCatalog(JSON.parse(await readFile("library/components/catalog.json", "utf8")));
  const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
  const mechanical = JSON.parse(await readFile("library/components/extensions/mechanical-assembly-v1.json", "utf8"));
  const catalog = applyComponentCatalogExtension(applyComponentCatalogExtension(base, assetForge), mechanical);
  const registry = new ComponentRegistry(catalog);
  const session = new EngineeringSession(createBlankInventionProject("assembly-test-01"));
  const builder = new InventionBuilder(session, registry);
  const spatial = new InventionSpatialScene(session);
  return { session, builder, spatial };
}

function assertClose(actual, expected, epsilon = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be within ${epsilon} of ${expected}`);
}

test("S2.15 derives a coincident mechanical constraint from the authoritative connectedTo relationship", async () => {
  const { session, builder, spatial } = await assemblyRuntime();
  const motor = builder.addComponent("actuation.motor.dc-brushed-v1");
  const wheel = builder.addComponent("mechanical.wheel.drive-v1");
  spatial.ensureComponent(motor.id);
  spatial.ensureComponent(wheel.id);

  const connection = builder.connect(
    { entityId: motor.id, portId: "shaft-out" },
    { entityId: wheel.id, portId: "hub-in" }
  );
  const constraints = deriveMechanicalAssemblyConstraints(session, builder.connections());
  assert.equal(constraints.length, 1);
  assert.equal(constraints[0].relationshipId, connection.id);
  assert.deepEqual(constraints[0].driver, { entityId: motor.id, portId: "shaft-out" });
  assert.deepEqual(constraints[0].follower, { entityId: wheel.id, portId: "hub-in" });
  assert.deepEqual(constraints[0].sharedInterfaces, ["mechanical.rotary-shaft"]);
  assert.equal(constraints[0].constraint, "coincident");
  assert.equal(constraints[0].derivedFrom, "engineering-graph");
  assert.deepEqual(new Set(mechanicalAssemblyMembers(constraints, motor.id)), new Set([motor.id, wheel.id]));
});

test("S2.15 coincident snap translates only the follower binding and closes the physical endpoint gap", async () => {
  const { builder, spatial } = await assemblyRuntime();
  const motor = builder.addComponent("actuation.motor.dc-brushed-v1");
  const wheel = builder.addComponent("mechanical.wheel.drive-v1");
  const motorBinding = spatial.ensureComponent(motor.id, { x: -0.2, y: 0.1, z: 0 });
  const wheelBinding = spatial.ensureComponent(wheel.id, { x: 0.2, y: 0.1, z: 0 });
  const driverEndpoint = { x: motorBinding.position.x, y: motorBinding.position.y, z: 0.03185 };
  const followerEndpoint = { ...wheelBinding.position };

  const next = coincidentFollowerPosition(driverEndpoint, followerEndpoint, wheelBinding);
  assert.deepEqual(next, driverEndpoint);
  const moved = spatial.move(wheel.id, next);
  assert.deepEqual(moved.position, driverEndpoint);
  assert.equal(endpointsAreCoincident(driverEndpoint, moved.position), true);
  assert.deepEqual(spatial.binding(motor.id).position, motorBinding.position, "snap must not move the driver");
});

test("S2.15 assembly translation is atomic and fails closed before any member leaves spatial bounds", async () => {
  const { session, builder, spatial } = await assemblyRuntime();
  const motor = builder.addComponent("actuation.motor.dc-brushed-v1");
  const wheel = builder.addComponent("mechanical.wheel.drive-v1");
  spatial.ensureComponent(motor.id, { x: 0.35, y: 0, z: 0 });
  spatial.ensureComponent(wheel.id, { x: 0.38, y: 0, z: 0 });
  builder.connect(
    { entityId: motor.id, portId: "shaft-out" },
    { entityId: wheel.id, portId: "hub-in" }
  );
  const constraints = deriveMechanicalAssemblyConstraints(session, builder.connections());
  const members = mechanicalAssemblyMembers(constraints, wheel.id);
  const before = spatial.bindings();

  assert.throws(
    () => planMechanicalAssemblyTranslation(before, members, { x: 0.2, y: 0, z: 0 }),
    /outside invention workspace bounds/
  );
  assert.deepEqual(spatial.bindings(), before, "planning failure must not partially mutate the spatial scene");

  const plan = planMechanicalAssemblyTranslation(before, members, { x: 0.05, y: 0, z: 0 });
  for (const move of plan) spatial.move(move.entityId, move.to);
  assertClose(spatial.binding(motor.id).position.x, 0.4);
  assertClose(spatial.binding(wheel.id).position.x, 0.43);
});

test("S2.15 keeps electrical relationships out of the mechanical constraint projection", async () => {
  const { session, builder, spatial } = await assemblyRuntime();
  const battery = builder.addComponent("energy.battery.lithium-ion-v1");
  const motor = builder.addComponent("actuation.motor.dc-brushed-v1");
  spatial.ensureComponent(battery.id);
  spatial.ensureComponent(motor.id);
  builder.connect(
    { entityId: battery.id, portId: "dc-output" },
    { entityId: motor.id, portId: "power-pos" }
  );
  assert.deepEqual(deriveMechanicalAssemblyConstraints(session, builder.connections()), []);
});
