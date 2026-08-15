import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { applyComponentCatalogExtension } from "../../dist/packages/component-library/src/extension.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import {
  deriveMechanicalAxialConstraints,
  mechanicalAxesAreAligned,
  mechanicalWorldAxis,
  planMechanicalAssemblyRotation,
  planMechanicalAxialAlignment
} from "../../dist/packages/invention-assembly-runtime/src/index.js";
import { InventionSpatialScene } from "../../dist/packages/invention-spatial-runtime/src/index.js";
import { InventionBuilder, createBlankInventionProject } from "../../dist/packages/invention-runtime/src/index.js";

async function axialRuntime() {
  const base = parseComponentCatalog(JSON.parse(await readFile("library/components/catalog.json", "utf8")));
  const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
  const mechanical = JSON.parse(await readFile("library/components/extensions/mechanical-assembly-v1.json", "utf8"));
  const catalog = applyComponentCatalogExtension(applyComponentCatalogExtension(base, assetForge), mechanical);
  const registry = new ComponentRegistry(catalog);
  const session = new EngineeringSession(createBlankInventionProject("axial-test-01"));
  const builder = new InventionBuilder(session, registry);
  const spatial = new InventionSpatialScene(session);
  return { session, builder, spatial };
}

function assertClose(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

function assertVectorClose(actual, expected, epsilon = 1e-9) {
  assertClose(actual.x, expected.x, epsilon);
  assertClose(actual.y, expected.y, epsilon);
  assertClose(actual.z, expected.z, epsilon);
}

test("S2.18 derives one rotary axial constraint from the same connectedTo relationship and ignores non-rotary mounts", async () => {
  const { session, builder, spatial } = await axialRuntime();
  const motor = builder.addComponent("actuation.motor.dc-brushed-v1");
  const wheel = builder.addComponent("mechanical.wheel.drive-v1");
  const bracket = builder.addComponent("mechanical.bracket.motor-a-v1");
  spatial.ensureComponent(motor.id);
  spatial.ensureComponent(wheel.id);
  spatial.ensureComponent(bracket.id);
  const shaft = builder.connect({ entityId: motor.id, portId: "shaft-out" }, { entityId: wheel.id, portId: "hub-in" });
  builder.connect({ entityId: motor.id, portId: "mount-front" }, { entityId: bracket.id, portId: "motor-mount" });

  const constraints = deriveMechanicalAxialConstraints(session, builder.connections());
  assert.equal(constraints.length, 1);
  assert.equal(constraints[0].relationshipId, shaft.id);
  assert.equal(constraints[0].constraint, "axis-aligned");
  assert.equal(constraints[0].derivedFrom, "engineering-graph");
  assert.deepEqual(constraints[0].sharedInterfaces, ["mechanical.rotary-shaft"]);
  assert.deepEqual(constraints[0].driverAxisLocal, { x: 0, y: 0, z: 1 });
  assert.deepEqual(constraints[0].followerAxisLocal, { x: 0, y: 0, z: 1 });
});

test("S2.18 atomic axial planner aligns orientation and keeps the rotated local hub on the driver endpoint", () => {
  const driverBinding = {
    entityId: "motor-1",
    position: { x: 0.1, y: 0.02, z: 0.04 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  };
  const followerBinding = {
    entityId: "wheel-1",
    position: { x: -0.2, y: 0.1, z: -0.1 },
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  };
  const driverEndpoint = { x: 0.1, y: 0.02, z: 0.07185 };
  const followerLocalEndpoint = { x: 0, y: 0, z: 0.01 };
  const plan = planMechanicalAxialAlignment(
    driverEndpoint,
    followerLocalEndpoint,
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: 1 },
    driverBinding,
    followerBinding
  );

  const driverAxis = mechanicalWorldAxis({ x: 0, y: 0, z: 1 }, driverBinding.rotation);
  const followerAxis = mechanicalWorldAxis({ x: 0, y: 0, z: 1 }, plan.toRotation);
  assert.equal(mechanicalAxesAreAligned(driverAxis, followerAxis), true);
  assertVectorClose(plan.toPosition, { x: 0.1, y: 0.02, z: 0.06185 }, 1e-8);
  assert.deepEqual(plan.fromPosition, followerBinding.position);
  assert.deepEqual(plan.fromRotation, followerBinding.rotation);
  assert.deepEqual(followerBinding.rotation, { x: 0, y: Math.PI / 2, z: 0 }, "planner must not mutate input binding");
});

test("S2.18 axial planner fails closed before any out-of-bounds follower transform can be applied", () => {
  const driverBinding = { entityId: "motor-1", position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
  const followerBinding = { entityId: "wheel-1", position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: Math.PI / 2, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
  assert.throws(() => planMechanicalAxialAlignment(
    { x: 99, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: 1 },
    driverBinding,
    followerBinding
  ), /outside invention workspace bounds/);
});

test("S2.18 axial alignment remains true after the S2.17 rigid assembly rotation planner rotates both members", () => {
  const bindings = [
    { entityId: "motor-1", position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    { entityId: "wheel-1", position: { x: 0, y: 0, z: 0.03185 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }
  ];
  const plan = planMechanicalAssemblyRotation(bindings, ["motor-1", "wheel-1"], "motor-1", "y", Math.PI / 12);
  const motor = plan.find((entry) => entry.entityId === "motor-1");
  const wheel = plan.find((entry) => entry.entityId === "wheel-1");
  assert.ok(motor && wheel);
  const motorAxis = mechanicalWorldAxis({ x: 0, y: 0, z: 1 }, motor.toRotation);
  const wheelAxis = mechanicalWorldAxis({ x: 0, y: 0, z: 1 }, wheel.toRotation);
  assert.equal(mechanicalAxesAreAligned(motorAxis, wheelAxis), true);
  assertVectorClose(motorAxis, { x: Math.sin(Math.PI / 12), y: 0, z: Math.cos(Math.PI / 12) }, 1e-8);
});
