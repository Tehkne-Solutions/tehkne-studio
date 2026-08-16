import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { applyComponentCatalogExtension } from "../../dist/packages/component-library/src/extension.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { mechanicalCommandRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/index.js";
import { mechanicalRotaryHomeRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/rotary-home.js";
import { InventionSpatialScene, parseInventionSpatialDocument } from "../../dist/packages/invention-spatial-runtime/src/index.js";
import { InventionBuilder, createBlankInventionProject } from "../../dist/packages/invention-runtime/src/index.js";
import { createSessionSnapshot, restoreSessionSnapshot } from "../../dist/packages/persistence-runtime/src/index.js";

const DEG = Math.PI / 180;
function close(actual, expected, epsilon = 1e-7) { assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`); }

async function rotaryRuntime(projectId = "rotary-home-test") {
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
  return { session, builder, spatial, connection };
}

function relationship(session, id) {
  const found = session.graph.snapshot().relationships.find((entry) => entry.id === id);
  assert.ok(found, `missing relationship ${id}`);
  return found;
}

test("S2.27 captures the current continuous position as authored rotary home without entering the kinematic fold", async () => {
  const { session, spatial, connection } = await rotaryRuntime("rotary-home-authoring");
  const mechanical = mechanicalCommandRuntimeFor(spatial);
  assert.equal((await mechanical.setContinuousTarget(connection.id, 360 * DEG, "ui")).ok, true);
  const home = mechanicalRotaryHomeRuntimeFor(spatial);
  assert.equal(home.home(connection.id), null);
  const evidenceBefore = mechanical.kinematics(connection.id).evidenceCommands;

  const outcome = await home.setHome(connection.id, "voice");
  assert.equal(outcome.ok, true, outcome.error);
  assert.ok(outcome.result);
  assert.equal(outcome.result.commandId, "mechanical-home-cmd-1");
  assert.equal(outcome.result.source, "voice");
  assert.equal(outcome.result.action, "set");
  assert.ok(outcome.result.current);
  close(outcome.result.current.homeContinuousRadians, 360 * DEG);
  assert.equal(outcome.result.current.signature, "Tehkné Solutions");
  assert.deepEqual(relationship(session, connection.id).metadata.rotaryHome, outcome.result.current);
  assert.deepEqual(home.home(connection.id), outcome.result.current);
  assert.equal(mechanical.kinematics(connection.id).evidenceCommands, evidenceBefore, "SET HOME must not manufacture rotary movement evidence");
  assert.equal(session.events.list().at(-1)?.type, "MechanicalRotaryHomeSet");
});

test("S2.27 GO HOME reuses the canonical continuous target command and travel-limit enforcement", async () => {
  const { session, spatial, connection } = await rotaryRuntime("rotary-home-motion");
  const mechanical = mechanicalCommandRuntimeFor(spatial);
  const home = mechanicalRotaryHomeRuntimeFor(spatial);
  assert.equal((await mechanical.setContinuousTarget(connection.id, 360 * DEG, "ui")).ok, true);
  assert.equal((await home.setHome(connection.id, "ui")).ok, true);
  assert.equal((await mechanical.setContinuousTarget(connection.id, 0, "ui")).ok, true);
  assert.equal((await mechanical.setTravelLimits(connection.id, -90 * DEG, 90 * DEG, "ui")).ok, true);
  const spatialBefore = spatial.document();
  const eventsBefore = session.events.list().length;

  const blocked = await home.goHome(connection.id, "automation");
  assert.equal(blocked.ok, false);
  assert.match(blocked.error ?? "", /travel limit exceeded/);
  assert.deepEqual(spatial.document(), spatialBefore, "blocked GO HOME must not mutate inventionSpatial");
  assert.equal(session.events.list().length, eventsBefore, "blocked GO HOME must not record movement or request-success evidence");
  close(mechanical.kinematics(connection.id).continuousRadians, 0);

  assert.equal((await mechanical.clearTravelLimits(connection.id, "ui")).ok, true);
  const moved = await home.goHome(connection.id, "automation");
  assert.equal(moved.ok, true, moved.error);
  assert.ok(moved.result);
  assert.equal(moved.result.mode, "continuous-absolute");
  assert.equal(moved.result.source, "automation");
  close(moved.result.afterContinuousRadians, 360 * DEG);
  assert.equal(session.events.list().at(-1)?.type, "MechanicalRotaryHomeRequested");
  const request = session.events.list().at(-1)?.payload;
  assert.equal(request?.movementCommandId, moved.result.commandId);
  assert.equal(mechanical.kinematics(connection.id).evidenceCommands, 3, "home request audit must stay outside the movement fold");
});

test("S2.27 persists rotary home in the graph snapshot restores without replay and clears through the same CommandBus", async () => {
  const { session, builder, spatial, connection } = await rotaryRuntime("rotary-home-restore");
  const mechanical = mechanicalCommandRuntimeFor(spatial);
  const home = mechanicalRotaryHomeRuntimeFor(spatial);
  assert.equal((await mechanical.setContinuousTarget(connection.id, -450 * DEG, "ui")).ok, true);
  assert.equal((await home.setHome(connection.id, "automation")).ok, true);
  const snapshot = createSessionSnapshot(session, { extensions: { invention: builder.document(), inventionSpatial: spatial.document() } });
  const eventCount = snapshot.events.length;

  const restoredSession = restoreSessionSnapshot(JSON.parse(JSON.stringify(snapshot)));
  const restoredSpatial = new InventionSpatialScene(restoredSession, parseInventionSpatialDocument(snapshot.extensions.inventionSpatial));
  const restoredMechanical = mechanicalCommandRuntimeFor(restoredSpatial);
  const restoredHome = mechanicalRotaryHomeRuntimeFor(restoredSpatial);
  const authored = restoredHome.home(connection.id);
  assert.ok(authored);
  close(authored.homeContinuousRadians, -450 * DEG);
  close(restoredMechanical.kinematics(connection.id).continuousRadians, -450 * DEG);
  assert.equal(restoredSession.events.list().length, eventCount, "restore must not replay HOME authoring or movement");

  assert.equal((await restoredMechanical.setContinuousTarget(connection.id, 90 * DEG, "ui")).ok, true);
  const returned = await restoredHome.goHome(connection.id, "voice");
  assert.equal(returned.ok, true, returned.error);
  assert.ok(returned.result);
  close(returned.result.afterContinuousRadians, -450 * DEG);
  const cleared = await restoredHome.clearHome(connection.id, "voice");
  assert.equal(cleared.ok, true, cleared.error);
  assert.ok(cleared.result);
  assert.equal(cleared.result.action, "clear");
  assert.equal(restoredHome.home(connection.id), null);
  assert.equal(relationship(restoredSession, connection.id).metadata.rotaryHome, undefined);
  assert.equal(restoredSession.events.list().at(-1)?.type, "MechanicalRotaryHomeCleared");
});

test("S2.27 fails closed for missing or tampered HOME metadata without false rotary evidence", async () => {
  const { session, spatial, connection } = await rotaryRuntime("rotary-home-fail-closed");
  const mechanical = mechanicalCommandRuntimeFor(spatial);
  const home = mechanicalRotaryHomeRuntimeFor(spatial);
  const eventsBeforeMissing = session.events.list().length;
  const missing = await home.goHome(connection.id, "system");
  assert.equal(missing.ok, false);
  assert.match(missing.error ?? "", /home is not authored/);
  assert.equal(session.events.list().length, eventsBeforeMissing);

  const original = relationship(session, connection.id);
  session.graph.replaceRelationship({
    ...original,
    metadata: {
      ...original.metadata,
      rotaryHome: { mode: "continuous", homeContinuousRadians: 0, signature: "tampered" }
    }
  });
  const eventsBeforeTampered = session.events.list().length;
  const tampered = await home.goHome(connection.id, "system");
  assert.equal(tampered.ok, false);
  assert.match(tampered.error ?? "", /signature mismatch/);
  assert.equal(session.events.list().length, eventsBeforeTampered);
  assert.equal(mechanical.kinematics(connection.id).evidenceCommands, 0);
});
