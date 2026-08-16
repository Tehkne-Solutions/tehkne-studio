import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { applyComponentCatalogExtension } from "../../dist/packages/component-library/src/extension.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import {
  MECHANICAL_ROTARY_STEP_COMMAND,
  MECHANICAL_ROTARY_TARGET_COMMAND,
  mechanicalCommandRuntimeFor
} from "../../dist/packages/invention-mechanical-command-runtime/src/index.js";
import { rotaryJointRelativeAngle } from "../../dist/packages/invention-assembly-runtime/src/rotary-relative-angle.js";
import { deriveMechanicalAxialConstraints } from "../../dist/packages/invention-assembly-runtime/src/index.js";
import { InventionSpatialScene, parseInventionSpatialDocument } from "../../dist/packages/invention-spatial-runtime/src/index.js";
import { InventionBuilder, createBlankInventionProject } from "../../dist/packages/invention-runtime/src/index.js";
import { createSessionSnapshot, restoreSessionSnapshot } from "../../dist/packages/persistence-runtime/src/index.js";

const DEG = Math.PI / 180;

function assertClose(actual, expected, epsilon = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

async function commandRuntime(projectId = "mechanical-command-test") {
  const base = parseComponentCatalog(JSON.parse(await readFile("library/components/catalog.json", "utf8")));
  const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
  const mechanical = JSON.parse(await readFile("library/components/extensions/mechanical-assembly-v1.json", "utf8"));
  const catalog = applyComponentCatalogExtension(applyComponentCatalogExtension(base, assetForge), mechanical);
  const registry = new ComponentRegistry(catalog);
  const session = new EngineeringSession(createBlankInventionProject(projectId));
  const builder = new InventionBuilder(session, registry);
  const spatial = new InventionSpatialScene(session);
  return { registry, session, builder, spatial };
}

async function snappedRotaryRuntime(projectId = "mechanical-command-rotary") {
  const value = await commandRuntime(projectId);
  const motor = value.builder.addComponent("actuation.motor.dc-brushed-v1");
  const wheel = value.builder.addComponent("mechanical.wheel.drive-v1");
  value.spatial.ensureComponent(motor.id, { x: 0, y: 0, z: 0 });
  value.spatial.ensureComponent(wheel.id, { x: 0, y: 0, z: 0.03185 });
  const connection = value.builder.connect(
    { entityId: motor.id, portId: "shaft-out" },
    { entityId: wheel.id, portId: "hub-in" }
  );
  return { ...value, motor, wheel, connection };
}

test("S2.23 registers one mechanical runtime on the existing session CommandBus", async () => {
  const { session, spatial } = await snappedRotaryRuntime();
  const first = mechanicalCommandRuntimeFor(spatial);
  const second = mechanicalCommandRuntimeFor(spatial);
  assert.equal(first, second);
  assert.equal(first.session, session);
  assert.ok(session.commands);
});

test("S2.23 voice target command uses authoritative connectedTo geometry, atomic spatial commit and persistent event evidence", async () => {
  const { session, builder, spatial, motor, wheel, connection } = await snappedRotaryRuntime("mechanical-command-voice");
  const commands = mechanicalCommandRuntimeFor(spatial);
  const motorBefore = structuredClone(spatial.binding(motor.id));
  const outcome = await commands.setTarget(connection.id, 90 * DEG, "voice");

  assert.equal(outcome.ok, true, outcome.error);
  assert.ok(outcome.result);
  assert.equal(outcome.result.commandId, "mechanical-cmd-1");
  assert.equal(outcome.result.relationshipId, connection.id);
  assert.equal(outcome.result.source, "voice");
  assert.equal(outcome.result.driverEntityId, motor.id);
  assert.equal(outcome.result.followerEntityId, wheel.id);
  assert.equal(outcome.result.mode, "principal-shortest");
  assertClose(outcome.result.beforeRadians, 0);
  assertClose(outcome.result.afterRadians, 90 * DEG);
  assertClose(outcome.result.deltaRadians, 90 * DEG);
  assert.equal(outcome.result.signature, "Tehkné Solutions");
  assert.deepEqual(spatial.binding(motor.id), motorBefore, "CommandBus rotary target must not mutate the driver");

  const axial = deriveMechanicalAxialConstraints(session, builder.connections())[0];
  assert.ok(axial);
  assertClose(rotaryJointRelativeAngle(
    axial.driverAxisLocal,
    axial.followerAxisLocal,
    spatial.binding(motor.id).rotation,
    spatial.binding(wheel.id).rotation
  ), 90 * DEG);

  const event = session.events.list().at(-1);
  assert.ok(event);
  assert.equal(event.type, "MechanicalRotaryTargetExecuted");
  assert.equal(event.source, "voice");
  assert.equal(event.payload.commandId, "mechanical-cmd-1");
  assert.equal(event.payload.relationshipId, connection.id);
  assert.equal(event.payload.signature, "Tehkné Solutions");

  const snapshot = createSessionSnapshot(session, {
    extensions: {
      invention: builder.document(),
      inventionSpatial: spatial.document()
    }
  });
  assert.equal(snapshot.events.at(-1)?.payload.commandId, "mechanical-cmd-1");
  assert.equal(snapshot.events.at(-1)?.source, "voice");
});

test("S2.23 restored automation command continues command IDs and keeps the same persisted spatial source of truth", async () => {
  const { session, builder, spatial, connection } = await snappedRotaryRuntime("mechanical-command-restore");
  const firstRuntime = mechanicalCommandRuntimeFor(spatial);
  const first = await firstRuntime.setTarget(connection.id, 45 * DEG, "ui");
  assert.equal(first.ok, true, first.error);

  const snapshot = createSessionSnapshot(session, {
    extensions: {
      invention: builder.document(),
      inventionSpatial: spatial.document()
    }
  });
  const restoredSession = restoreSessionSnapshot(JSON.parse(JSON.stringify(snapshot)));
  const restoredSpatial = new InventionSpatialScene(
    restoredSession,
    parseInventionSpatialDocument(snapshot.extensions.inventionSpatial)
  );
  const restoredRuntime = mechanicalCommandRuntimeFor(restoredSpatial);
  const second = await restoredRuntime.step(connection.id, 15 * DEG, "automation");

  assert.equal(second.ok, true, second.error);
  assert.ok(second.result);
  assert.equal(second.result.commandId, "mechanical-cmd-2");
  assert.equal(second.result.source, "automation");
  assertClose(second.result.beforeRadians, 45 * DEG);
  assertClose(second.result.afterRadians, 60 * DEG);
  const events = restoredSession.events.list();
  assert.equal(events.at(-2)?.payload.commandId, "mechanical-cmd-1");
  assert.equal(events.at(-1)?.payload.commandId, "mechanical-cmd-2");
  assert.equal(events.at(-1)?.source, "automation");
});

test("S2.23 CommandBus remains fail closed for invalid mechanical relationships without spatial mutation or false evidence", async () => {
  const { session, builder, spatial } = await commandRuntime("mechanical-command-fail-closed");
  const battery = builder.addComponent("energy.battery.lithium-ion-v1");
  const motor = builder.addComponent("actuation.motor.dc-brushed-v1");
  spatial.ensureComponent(battery.id);
  spatial.ensureComponent(motor.id);
  const electrical = builder.connect(
    { entityId: battery.id, portId: "dc-output" },
    { entityId: motor.id, portId: "power-pos" }
  );
  const before = spatial.document();
  const eventCount = session.events.list().length;
  const commands = mechanicalCommandRuntimeFor(spatial);
  const outcome = await commands.setTarget(electrical.id, 90 * DEG, "voice");

  assert.equal(outcome.ok, false);
  assert.match(outcome.error ?? "", /rotary-shaft axial constraint/);
  assert.deepEqual(spatial.document(), before);
  assert.equal(session.events.list().length, eventCount, "failed command must not create success evidence");
});

test("S2.23 exposes stable semantic command type names without a second command bus", () => {
  assert.equal(MECHANICAL_ROTARY_STEP_COMMAND, "invention.mechanical.rotary.step");
  assert.equal(MECHANICAL_ROTARY_TARGET_COMMAND, "invention.mechanical.rotary.setTarget");
});
