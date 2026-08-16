import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { applyComponentCatalogExtension } from "../../dist/packages/component-library/src/extension.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { mechanicalCommandRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/index.js";
import { mechanicalRotaryNamedPositionsRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/rotary-named-positions.js";
import { InventionSpatialScene, parseInventionSpatialDocument } from "../../dist/packages/invention-spatial-runtime/src/index.js";
import { InventionBuilder, createBlankInventionProject } from "../../dist/packages/invention-runtime/src/index.js";
import { createSessionSnapshot, restoreSessionSnapshot } from "../../dist/packages/persistence-runtime/src/index.js";

const DEG = Math.PI / 180;
function close(actual, expected, epsilon = 1e-7) { assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`); }

async function rotaryRuntime(projectId = "rotary-named-position-test") {
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

test("S2.28 saves and updates normalized rotary named positions on connectedTo metadata without manufacturing movement evidence", async () => {
  const { session, spatial, connection } = await rotaryRuntime("rotary-named-position-authoring");
  const mechanical = mechanicalCommandRuntimeFor(spatial);
  const positions = mechanicalRotaryNamedPositionsRuntimeFor(spatial);
  assert.equal((await mechanical.setContinuousTarget(connection.id, 90 * DEG, "ui")).ok, true);
  const evidenceBefore = mechanical.kinematics(connection.id).evidenceCommands;

  const created = await positions.savePosition(connection.id, "  Inspect   Port  ", "voice");
  assert.equal(created.ok, true, created.error);
  assert.ok(created.result);
  assert.equal(created.result.commandId, "mechanical-position-cmd-1");
  assert.equal(created.result.action, "created");
  assert.equal(created.result.current?.name, "Inspect Port");
  assert.equal(created.result.current?.key, "inspect port");
  close(created.result.current?.continuousRadians, 90 * DEG);
  assert.equal(mechanical.kinematics(connection.id).evidenceCommands, evidenceBefore);

  assert.equal((await mechanical.setContinuousTarget(connection.id, 135 * DEG, "ui")).ok, true);
  const updated = await positions.savePosition(connection.id, "inspect port", "automation");
  assert.equal(updated.ok, true, updated.error);
  assert.ok(updated.result);
  assert.equal(updated.result.action, "updated");
  close(updated.result.previous?.continuousRadians, 90 * DEG);
  close(updated.result.current?.continuousRadians, 135 * DEG);
  assert.equal(positions.positions(connection.id).length, 1);
  assert.equal(positions.positions(connection.id)[0]?.name, "inspect port");
  assert.equal(mechanical.kinematics(connection.id).evidenceCommands, 2, "named-position authoring events must stay outside the movement fold");
  assert.equal(session.events.list().at(-1)?.type, "MechanicalRotaryNamedPositionSaved");
  assert.equal(relationship(session, connection.id).metadata.rotaryNamedPositions?.signature, "Tehkné Solutions");
});

test("S2.28 GO POSITION delegates to canonical continuous target and remains blocked by S2.26 travel limits before mutation", async () => {
  const { session, spatial, connection } = await rotaryRuntime("rotary-named-position-motion");
  const mechanical = mechanicalCommandRuntimeFor(spatial);
  const positions = mechanicalRotaryNamedPositionsRuntimeFor(spatial);
  assert.equal((await mechanical.setContinuousTarget(connection.id, 360 * DEG, "ui")).ok, true);
  assert.equal((await positions.savePosition(connection.id, "Load", "ui")).ok, true);
  assert.equal((await mechanical.setContinuousTarget(connection.id, 0, "ui")).ok, true);
  assert.equal((await mechanical.setTravelLimits(connection.id, -90 * DEG, 90 * DEG, "ui")).ok, true);
  const spatialBefore = spatial.document();
  const eventsBefore = session.events.list().length;

  const blocked = await positions.goToPosition(connection.id, "load", "automation");
  assert.equal(blocked.ok, false);
  assert.match(blocked.error ?? "", /travel limit exceeded/);
  assert.deepEqual(spatial.document(), spatialBefore, "blocked GO POSITION must not mutate inventionSpatial");
  assert.equal(session.events.list().length, eventsBefore, "blocked GO POSITION must not record movement or request-success evidence");
  close(mechanical.kinematics(connection.id).continuousRadians, 0);

  assert.equal((await mechanical.clearTravelLimits(connection.id, "ui")).ok, true);
  const moved = await positions.goToPosition(connection.id, "LOAD", "automation");
  assert.equal(moved.ok, true, moved.error);
  assert.ok(moved.result);
  assert.equal(moved.result.mode, "continuous-absolute");
  assert.equal(moved.result.source, "automation");
  close(moved.result.afterContinuousRadians, 360 * DEG);
  assert.equal(session.events.list().at(-1)?.type, "MechanicalRotaryNamedPositionRequested");
  const request = session.events.list().at(-1)?.payload;
  assert.equal(request?.name, "Load");
  assert.equal(request?.movementCommandId, moved.result.commandId);
});

test("S2.28 persists multiple named positions restores without replay navigates them independently and deletes only the selected bookmark", async () => {
  const { session, builder, spatial, connection } = await rotaryRuntime("rotary-named-position-restore");
  const mechanical = mechanicalCommandRuntimeFor(spatial);
  const positions = mechanicalRotaryNamedPositionsRuntimeFor(spatial);
  assert.equal((await mechanical.setContinuousTarget(connection.id, 170 * DEG, "ui")).ok, true);
  assert.equal((await positions.savePosition(connection.id, "Inspect", "ui")).ok, true);
  assert.equal((await mechanical.setContinuousTarget(connection.id, -450 * DEG, "ui")).ok, true);
  assert.equal((await positions.savePosition(connection.id, "Load", "ui")).ok, true);
  const snapshot = createSessionSnapshot(session, { extensions: { invention: builder.document(), inventionSpatial: spatial.document() } });
  const eventCount = snapshot.events.length;

  const restoredSession = restoreSessionSnapshot(JSON.parse(JSON.stringify(snapshot)));
  const restoredSpatial = new InventionSpatialScene(restoredSession, parseInventionSpatialDocument(snapshot.extensions.inventionSpatial));
  const restoredMechanical = mechanicalCommandRuntimeFor(restoredSpatial);
  const restoredPositions = mechanicalRotaryNamedPositionsRuntimeFor(restoredSpatial);
  assert.deepEqual(restoredPositions.positions(connection.id).map((entry) => entry.name), ["Inspect", "Load"]);
  close(restoredPositions.position(connection.id, "inspect")?.continuousRadians, 170 * DEG);
  close(restoredPositions.position(connection.id, "load")?.continuousRadians, -450 * DEG);
  assert.equal(restoredSession.events.list().length, eventCount, "restore must not replay named-position authoring or movement");

  assert.equal((await restoredMechanical.setContinuousTarget(connection.id, 0, "ui")).ok, true);
  const inspect = await restoredPositions.goToPosition(connection.id, "Inspect", "voice");
  assert.equal(inspect.ok, true, inspect.error);
  close(inspect.result?.afterContinuousRadians, 170 * DEG);
  const load = await restoredPositions.goToPosition(connection.id, "Load", "automation");
  assert.equal(load.ok, true, load.error);
  close(load.result?.afterContinuousRadians, -450 * DEG);

  const deleted = await restoredPositions.deletePosition(connection.id, "Inspect", "voice");
  assert.equal(deleted.ok, true, deleted.error);
  assert.ok(deleted.result);
  assert.equal(deleted.result.action, "deleted");
  assert.equal(restoredPositions.position(connection.id, "Inspect"), null);
  assert.equal(restoredPositions.positions(connection.id).length, 1);
  assert.equal(restoredPositions.positions(connection.id)[0]?.name, "Load");
  close(restoredMechanical.kinematics(connection.id).continuousRadians, -450 * DEG, "deleting a bookmark must not move the joint");
  assert.equal(restoredSession.events.list().at(-1)?.type, "MechanicalRotaryNamedPositionDeleted");
});

test("S2.28 fails closed for invalid names missing bookmarks and tampered named-position metadata without false movement evidence", async () => {
  const { session, spatial, connection } = await rotaryRuntime("rotary-named-position-fail-closed");
  const mechanical = mechanicalCommandRuntimeFor(spatial);
  const positions = mechanicalRotaryNamedPositionsRuntimeFor(spatial);
  const blank = await positions.savePosition(connection.id, "   ", "system");
  assert.equal(blank.ok, false);
  assert.match(blank.error ?? "", /1 to 64 characters/);
  const missing = await positions.goToPosition(connection.id, "Missing", "system");
  assert.equal(missing.ok, false);
  assert.match(missing.error ?? "", /not authored/);
  assert.equal(mechanical.kinematics(connection.id).evidenceCommands, 0);

  const original = relationship(session, connection.id);
  session.graph.replaceRelationship({
    ...original,
    metadata: {
      ...original.metadata,
      rotaryNamedPositions: {
        version: 1,
        signature: "Tehkné Solutions",
        positions: [
          { key: "inspect", name: "Inspect", continuousRadians: 0, signature: "Tehkné Solutions" },
          { key: "inspect", name: "Inspect", continuousRadians: 1, signature: "Tehkné Solutions" }
        ]
      }
    }
  });
  const eventsBefore = session.events.list().length;
  const tampered = await positions.goToPosition(connection.id, "Inspect", "system");
  assert.equal(tampered.ok, false);
  assert.match(tampered.error ?? "", /duplicate key/);
  assert.equal(session.events.list().length, eventsBefore);
  assert.equal(mechanical.kinematics(connection.id).evidenceCommands, 0);
});
