import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { applyComponentCatalogExtension } from "../../dist/packages/component-library/src/extension.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { mechanicalCommandRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/index.js";
import { InventionSpatialScene, parseInventionSpatialDocument } from "../../dist/packages/invention-spatial-runtime/src/index.js";
import { InventionBuilder, createBlankInventionProject } from "../../dist/packages/invention-runtime/src/index.js";
import { createSessionSnapshot, restoreSessionSnapshot } from "../../dist/packages/persistence-runtime/src/index.js";

const DEG = Math.PI / 180;
function close(actual, expected, epsilon = 1e-7) { assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`); }

async function rotaryRuntime(projectId = "travel-limits-test") {
  const base = parseComponentCatalog(JSON.parse(await readFile("library/components/catalog.json", "utf8")));
  const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
  const mechanical = JSON.parse(await readFile("library/components/extensions/mechanical-assembly-v1.json", "utf8"));
  const registry = new ComponentRegistry(applyComponentCatalogExtension(applyComponentCatalogExtension(base, assetForge), mechanical));
  const session = new EngineeringSession(createBlankInventionProject(projectId));
  const builder = new InventionBuilder(session, registry);
  const spatial = new InventionSpatialScene(session);
  const motor = builder.addComponent("actuation.motor.dc-brushed-v1");
  const wheel = builder.addComponent("mechanical.wheel.drive-v1");
  spatial.ensureComponent(motor.id, { x: 0, y: 0, z: 0 });
  spatial.ensureComponent(wheel.id, { x: 0, y: 0, z: 0.03185 });
  const connection = builder.connect({ entityId: motor.id, portId: "shaft-out" }, { entityId: wheel.id, portId: "hub-in" });
  return { session, builder, spatial, motor, wheel, connection };
}

function relationship(session, id) {
  const found = session.graph.snapshot().relationships.find((entry) => entry.id === id);
  assert.ok(found, `missing relationship ${id}`);
  return found;
}

test("S2.26 authors continuous rotary travel limits on the authoritative connectedTo relationship", async () => {
  const { session, spatial, connection } = await rotaryRuntime("travel-limits-authoring");
  const commands = mechanicalCommandRuntimeFor(spatial);
  assert.equal(commands.travelLimits(connection.id), null);

  const outcome = await commands.setTravelLimits(connection.id, -180 * DEG, 540 * DEG, "voice");
  assert.equal(outcome.ok, true, outcome.error);
  assert.ok(outcome.result);
  assert.equal(outcome.result.commandId, "mechanical-cmd-1");
  assert.equal(outcome.result.source, "voice");
  assert.equal(outcome.result.action, "set");
  close(outcome.result.current.minContinuousRadians, -180 * DEG);
  close(outcome.result.current.maxContinuousRadians, 540 * DEG);
  const limits = commands.travelLimits(connection.id);
  assert.ok(limits);
  assert.equal(limits.mode, "continuous");
  assert.equal(limits.signature, "Tehkné Solutions");
  const metadata = relationship(session, connection.id).metadata.rotaryTravelLimits;
  assert.deepEqual(metadata, limits);
  assert.equal(commands.kinematics(connection.id).evidenceCommands, 0, "limit authoring must not enter the kinematic fold");
  assert.equal(session.events.list().at(-1)?.type, "MechanicalRotaryTravelLimitsSet");

  const eventCount = session.events.list().length;
  const inverted = await commands.setTravelLimits(connection.id, 10 * DEG, -10 * DEG, "automation");
  assert.equal(inverted.ok, false);
  assert.match(inverted.error ?? "", /minContinuousRadians <= maxContinuousRadians/);
  assert.equal(session.events.list().length, eventCount);
  assert.deepEqual(commands.travelLimits(connection.id), limits);

  const excludesCurrent = await commands.setTravelLimits(connection.id, 10 * DEG, 20 * DEG, "automation");
  assert.equal(excludesCurrent.ok, false);
  assert.match(excludesCurrent.error ?? "", /travel limit exceeded/);
  assert.equal(session.events.list().length, eventCount);
  assert.deepEqual(commands.travelLimits(connection.id), limits);
});

test("S2.26 enforces travel limits before any spatial mutation for continuous target principal target and incremental step", async () => {
  const { session, spatial, connection } = await rotaryRuntime("travel-limits-enforcement");
  const commands = mechanicalCommandRuntimeFor(spatial);
  const authored = await commands.setTravelLimits(connection.id, -180 * DEG, 540 * DEG, "ui");
  assert.equal(authored.ok, true, authored.error);

  const to360 = await commands.setContinuousTarget(connection.id, 360 * DEG, "ui");
  assert.equal(to360.ok, true, to360.error);
  close(commands.kinematics(connection.id).continuousRadians, 360 * DEG);

  const beforeBlockedContinuous = spatial.document();
  const eventCountBeforeContinuous = session.events.list().length;
  const to720 = await commands.setContinuousTarget(connection.id, 720 * DEG, "ui");
  assert.equal(to720.ok, false);
  assert.match(to720.error ?? "", /travel limit exceeded/);
  assert.deepEqual(spatial.document(), beforeBlockedContinuous, "blocked continuous target must not mutate inventionSpatial");
  assert.equal(session.events.list().length, eventCountBeforeContinuous, "blocked continuous target must not record success evidence");
  close(commands.kinematics(connection.id).continuousRadians, 360 * DEG);

  const to170Principal = await commands.setTarget(connection.id, 170 * DEG, "ui");
  assert.equal(to170Principal.ok, true, to170Principal.error);
  close(commands.kinematics(connection.id).continuousRadians, 530 * DEG);

  const beforeBlockedStep = spatial.document();
  const eventCountBeforeStep = session.events.list().length;
  const overMax = await commands.step(connection.id, 15 * DEG, "ui");
  assert.equal(overMax.ok, false);
  assert.match(overMax.error ?? "", /travel limit exceeded/);
  assert.deepEqual(spatial.document(), beforeBlockedStep, "blocked incremental step must not mutate inventionSpatial");
  assert.equal(session.events.list().length, eventCountBeforeStep);
  close(commands.kinematics(connection.id).continuousRadians, 530 * DEG);
});

test("S2.26 persists travel limits in graph snapshots restores them without replay and clears them through the same CommandBus", async () => {
  const { session, builder, spatial, connection } = await rotaryRuntime("travel-limits-restore");
  const commands = mechanicalCommandRuntimeFor(spatial);
  assert.equal((await commands.setTravelLimits(connection.id, -180 * DEG, 540 * DEG, "ui")).ok, true);
  assert.equal((await commands.setContinuousTarget(connection.id, 360 * DEG, "ui")).ok, true);
  const snapshot = createSessionSnapshot(session, { extensions: { invention: builder.document(), inventionSpatial: spatial.document() } });
  const eventCount = snapshot.events.length;

  const restoredSession = restoreSessionSnapshot(JSON.parse(JSON.stringify(snapshot)));
  const restoredSpatial = new InventionSpatialScene(restoredSession, parseInventionSpatialDocument(snapshot.extensions.inventionSpatial));
  const restoredCommands = mechanicalCommandRuntimeFor(restoredSpatial);
  const restoredLimits = restoredCommands.travelLimits(connection.id);
  assert.ok(restoredLimits);
  close(restoredLimits.minContinuousRadians, -180 * DEG);
  close(restoredLimits.maxContinuousRadians, 540 * DEG);
  close(restoredCommands.kinematics(connection.id).continuousRadians, 360 * DEG);
  assert.equal(restoredSession.events.list().length, eventCount, "restore must not replay limit or motion commands");

  const blocked = await restoredCommands.setContinuousTarget(connection.id, 720 * DEG, "automation");
  assert.equal(blocked.ok, false);
  assert.match(blocked.error ?? "", /travel limit exceeded/);
  const cleared = await restoredCommands.clearTravelLimits(connection.id, "automation");
  assert.equal(cleared.ok, true, cleared.error);
  assert.ok(cleared.result);
  assert.equal(cleared.result.action, "clear");
  assert.equal(cleared.result.current, null);
  assert.equal(restoredCommands.travelLimits(connection.id), null);
  assert.equal(restoredSession.events.list().at(-1)?.type, "MechanicalRotaryTravelLimitsCleared");
  assert.equal(restoredCommands.kinematics(connection.id).evidenceCommands, 1, "travel authoring/clearing events must not enter kinematic evidence");

  const unrestricted = await restoredCommands.setContinuousTarget(connection.id, 720 * DEG, "automation");
  assert.equal(unrestricted.ok, true, unrestricted.error);
  assert.ok(unrestricted.result);
  close(unrestricted.result.afterContinuousRadians, 720 * DEG);
  assert.equal(unrestricted.result.afterRevolutions, 2);
});

test("S2.26 preserves unlimited rotary shafts when no travel envelope is authored", async () => {
  const { session, spatial, connection } = await rotaryRuntime("travel-limits-unlimited");
  const commands = mechanicalCommandRuntimeFor(spatial);
  assert.equal(commands.travelLimits(connection.id), null);
  const outcome = await commands.setContinuousTarget(connection.id, 1080 * DEG, "system");
  assert.equal(outcome.ok, true, outcome.error);
  assert.ok(outcome.result);
  close(outcome.result.afterContinuousRadians, 1080 * DEG);
  assert.equal(outcome.result.afterRevolutions, 3);
  assert.equal(relationship(session, connection.id).metadata.rotaryTravelLimits, undefined);
});
