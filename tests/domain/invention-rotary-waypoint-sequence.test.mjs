import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { applyComponentCatalogExtension } from "../../dist/packages/component-library/src/extension.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { mechanicalCommandRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/index.js";
import { mechanicalRotaryNamedPositionsRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/rotary-named-positions.js";
import { mechanicalRotaryWaypointSequenceRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/rotary-waypoint-sequence.js";
import { InventionSpatialScene, parseInventionSpatialDocument } from "../../dist/packages/invention-spatial-runtime/src/index.js";
import { InventionBuilder, createBlankInventionProject } from "../../dist/packages/invention-runtime/src/index.js";
import { createSessionSnapshot, restoreSessionSnapshot } from "../../dist/packages/persistence-runtime/src/index.js";

const DEG = Math.PI / 180;
function close(actual, expected, epsilon = 1e-7) { assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`); }

async function rotaryRuntime(projectId = "waypoint-sequence-test") {
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

async function authorTwoPositions(commands, positions, relationshipId) {
  assert.equal((await commands.setContinuousTarget(relationshipId, 90 * DEG, "ui")).ok, true);
  assert.equal((await positions.savePosition(relationshipId, "Inspect", "ui")).ok, true);
  assert.equal((await commands.setContinuousTarget(relationshipId, 360 * DEG, "ui")).ok, true);
  assert.equal((await positions.savePosition(relationshipId, "Load", "ui")).ok, true);
  assert.equal((await commands.setContinuousTarget(relationshipId, 0, "ui")).ok, true);
}

test("S2.30 authors normalized ordered waypoint sequences on connectedTo metadata without manufacturing movement evidence", async () => {
  const { session, spatial, connection } = await rotaryRuntime("waypoint-authoring");
  const commands = mechanicalCommandRuntimeFor(spatial);
  const positions = mechanicalRotaryNamedPositionsRuntimeFor(spatial);
  const sequences = mechanicalRotaryWaypointSequenceRuntimeFor(spatial);
  await authorTwoPositions(commands, positions, connection.id);
  const movementEvidenceBefore = commands.kinematics(connection.id).evidenceCommands;
  const eventCountBefore = session.events.list().length;

  const saved = await sequences.saveSequence(connection.id, "  Inspect   Cycle  ", [
    { positionName: "Inspect", durationSeconds: 3 },
    { positionName: "Load", durationSeconds: 9 },
    { positionName: "Inspect" }
  ], "voice");
  assert.equal(saved.ok, true, saved.error);
  assert.ok(saved.result?.current);
  assert.equal(saved.result.action, "created");
  assert.equal(saved.result.current.key, "inspect cycle");
  assert.equal(saved.result.current.name, "Inspect Cycle");
  assert.deepEqual(saved.result.current.steps.map((step) => [step.positionKey, step.durationSeconds]), [
    ["inspect", 3], ["load", 9], ["inspect", null]
  ]);
  assert.equal(commands.kinematics(connection.id).evidenceCommands, movementEvidenceBefore, "sequence authoring must remain outside movement fold");
  assert.equal(session.events.list().length, eventCountBefore + 1);
  assert.equal(session.events.list().at(-1)?.type, "MechanicalRotaryWaypointSequenceSaved");

  const relationship = session.graph.snapshot().relationships.find((entry) => entry.id === connection.id);
  assert.equal(relationship?.metadata.rotaryWaypointSequences?.version, 1);
  assert.equal(relationship?.metadata.rotaryWaypointSequences?.signature, "Tehkné Solutions");

  const updated = await sequences.saveSequence(connection.id, "inspect cycle", [
    { positionName: "Load", durationSeconds: 6 }
  ], "automation");
  assert.equal(updated.ok, true, updated.error);
  assert.equal(updated.result?.action, "updated");
  assert.equal(sequences.sequences(connection.id).length, 1, "normalized sequence name must update rather than duplicate");
  assert.equal(sequences.sequence(connection.id, "INSPECT CYCLE")?.steps[0]?.positionKey, "load");

  await assert.rejects(() => sequences.saveSequence(connection.id, "Empty", [], "ui"), /requires 1 to 32 steps/);
  await assert.rejects(() => sequences.saveSequence(connection.id, "Missing", [{ positionName: "Unknown" }], "ui"), /position is not authored/);
  await assert.rejects(() => sequences.saveSequence(connection.id, "Bad duration", [{ positionName: "Inspect", durationSeconds: 0 }], "ui"), /greater than zero/);
});

test("S2.30 RUN SEQUENCE executes canonical continuous targets in order and leaves rate authority on the final movement segment", async () => {
  const { session, spatial, connection } = await rotaryRuntime("waypoint-run");
  const commands = mechanicalCommandRuntimeFor(spatial);
  const positions = mechanicalRotaryNamedPositionsRuntimeFor(spatial);
  const sequences = mechanicalRotaryWaypointSequenceRuntimeFor(spatial);
  await authorTwoPositions(commands, positions, connection.id);
  assert.equal((await sequences.saveSequence(connection.id, "Cycle", [
    { positionName: "Inspect", durationSeconds: 3 },
    { positionName: "Load", durationSeconds: 9 }
  ], "ui")).ok, true);
  const eventsBefore = session.events.list().length;

  const run = await sequences.runSequence(connection.id, "cycle", "automation");
  assert.equal(run.ok, true, run.error);
  assert.ok(run.result);
  assert.equal(run.result.commandId, "mechanical-sequence-cmd-2");
  assert.equal(run.result.stepsCompleted, 2);
  assert.deepEqual(run.result.movementCommandIds, ["mechanical-cmd-4", "mechanical-cmd-5"]);
  assert.equal(run.result.finalMovementCommandId, "mechanical-cmd-5");
  assert.equal(run.result.finalRateMode, "segment-average");
  close(run.result.beforeContinuousRadians, 0);
  close(run.result.afterContinuousRadians, 360 * DEG);
  close(run.result.totalDeltaRadians, 360 * DEG);
  close(commands.kinematics(connection.id).continuousRadians, 360 * DEG);

  const rate = commands.rate(connection.id);
  assert.equal(rate.commandId, "mechanical-cmd-5");
  assert.equal(rate.mode, "segment-average");
  close(rate.averageRpm, 5);
  assert.equal(session.events.list().length, eventsBefore + 3, "two canonical movement events plus one sequence request event expected");
  const request = session.events.list().at(-1);
  assert.equal(request?.type, "MechanicalRotaryWaypointSequenceRequested");
  assert.deepEqual(request?.payload?.movementCommandIds, ["mechanical-cmd-4", "mechanical-cmd-5"]);
  assert.equal(request?.payload?.finalRateMode, "segment-average");
  assert.equal(commands.kinematics(connection.id).evidenceCommands, 5, "sequence request audit event must remain outside movement fold");
});

test("S2.30 preflights every waypoint against travel limits before the first sequence movement", async () => {
  const { session, spatial, connection } = await rotaryRuntime("waypoint-preflight");
  const commands = mechanicalCommandRuntimeFor(spatial);
  const positions = mechanicalRotaryNamedPositionsRuntimeFor(spatial);
  const sequences = mechanicalRotaryWaypointSequenceRuntimeFor(spatial);
  await authorTwoPositions(commands, positions, connection.id);
  assert.equal((await sequences.saveSequence(connection.id, "Inspect then Load", [
    { positionName: "Inspect", durationSeconds: 3 },
    { positionName: "Load", durationSeconds: 9 }
  ], "ui")).ok, true);
  assert.equal((await commands.setTravelLimits(connection.id, -90 * DEG, 180 * DEG, "ui")).ok, true);
  const spatialBefore = spatial.document();
  const kinematicsBefore = commands.kinematics(connection.id);
  const rateBefore = commands.rate(connection.id);
  const eventsBefore = session.events.list().length;

  const blocked = await sequences.runSequence(connection.id, "Inspect then Load", "voice");
  assert.equal(blocked.ok, false);
  assert.match(blocked.error ?? "", /waypoint sequence travel limit exceeded/);
  assert.deepEqual(spatial.document(), spatialBefore, "preflight failure must preserve inventionSpatial before waypoint 1");
  assert.deepEqual(commands.kinematics(connection.id), kinematicsBefore, "preflight failure must publish no movement evidence");
  assert.deepEqual(commands.rate(connection.id), rateBefore, "preflight failure must publish no rate evidence");
  assert.equal(session.events.list().length, eventsBefore, "preflight failure must publish no sequence-success audit event");
});

test("S2.30 persists sequences without replay resolves bookmarks live and fails closed for missing or tampered references", async () => {
  const { session, builder, spatial, connection } = await rotaryRuntime("waypoint-restore");
  const commands = mechanicalCommandRuntimeFor(spatial);
  const positions = mechanicalRotaryNamedPositionsRuntimeFor(spatial);
  const sequences = mechanicalRotaryWaypointSequenceRuntimeFor(spatial);
  await authorTwoPositions(commands, positions, connection.id);
  assert.equal((await sequences.saveSequence(connection.id, "Inspection Loop", [
    { positionName: "Inspect", durationSeconds: 3 },
    { positionName: "Load", durationSeconds: 9 }
  ], "ui")).ok, true);

  const snapshot = createSessionSnapshot(session, { extensions: { invention: builder.document(), inventionSpatial: spatial.document() } });
  const eventCount = snapshot.events.length;
  const restoredSession = restoreSessionSnapshot(JSON.parse(JSON.stringify(snapshot)));
  const restoredSpatial = new InventionSpatialScene(restoredSession, parseInventionSpatialDocument(snapshot.extensions.inventionSpatial));
  const restoredCommands = mechanicalCommandRuntimeFor(restoredSpatial);
  const restoredPositions = mechanicalRotaryNamedPositionsRuntimeFor(restoredSpatial);
  const restoredSequences = mechanicalRotaryWaypointSequenceRuntimeFor(restoredSpatial);
  assert.equal(restoredSequences.sequences(connection.id).length, 1);
  assert.equal(restoredSession.events.list().length, eventCount, "restore must not replay sequence or movement commands");

  assert.equal((await restoredCommands.setContinuousTarget(connection.id, 120 * DEG, "ui")).ok, true);
  assert.equal((await restoredPositions.savePosition(connection.id, "Inspect", "ui")).ok, true, "updating bookmark should not require rewriting sequence");
  assert.equal((await restoredCommands.setContinuousTarget(connection.id, 0, "ui")).ok, true);
  const live = await restoredSequences.runSequence(connection.id, "Inspection Loop", "system");
  assert.equal(live.ok, true, live.error);
  assert.ok(live.result);
  close(restoredSession.events.list().filter((event) => event.type === "MechanicalRotaryContinuousTargetExecuted").at(-2)?.payload?.afterContinuousRadians, 120 * DEG);
  close(live.result.afterContinuousRadians, 360 * DEG);

  assert.equal((await restoredPositions.deletePosition(connection.id, "Load", "ui")).ok, true);
  const beforeMissing = restoredSpatial.document();
  const eventCountBeforeMissing = restoredSession.events.list().length;
  const missing = await restoredSequences.runSequence(connection.id, "Inspection Loop", "ui");
  assert.equal(missing.ok, false);
  assert.match(missing.error ?? "", /position is not authored: Load/);
  assert.deepEqual(restoredSpatial.document(), beforeMissing);
  assert.equal(restoredSession.events.list().length, eventCountBeforeMissing);

  const deleted = await restoredSequences.deleteSequence(connection.id, "inspection loop", "ui");
  assert.equal(deleted.ok, true, deleted.error);
  assert.equal(deleted.result?.action, "deleted");
  assert.equal(restoredSequences.sequences(connection.id).length, 0);

  const tamperRuntime = await rotaryRuntime("waypoint-tamper");
  const tamperCommands = mechanicalCommandRuntimeFor(tamperRuntime.spatial);
  const tamperPositions = mechanicalRotaryNamedPositionsRuntimeFor(tamperRuntime.spatial);
  const tamperSequences = mechanicalRotaryWaypointSequenceRuntimeFor(tamperRuntime.spatial);
  assert.equal((await tamperCommands.setContinuousTarget(tamperRuntime.connection.id, 90 * DEG, "ui")).ok, true);
  assert.equal((await tamperPositions.savePosition(tamperRuntime.connection.id, "Inspect", "ui")).ok, true);
  assert.equal((await tamperSequences.saveSequence(tamperRuntime.connection.id, "Safe", [{ positionName: "Inspect" }], "ui")).ok, true);
  const relationship = tamperRuntime.session.graph.snapshot().relationships.find((entry) => entry.id === tamperRuntime.connection.id);
  assert.ok(relationship);
  tamperRuntime.session.graph.replaceRelationship({
    ...relationship,
    metadata: {
      ...relationship.metadata,
      rotaryWaypointSequences: {
        ...relationship.metadata.rotaryWaypointSequences,
        signature: "tampered"
      }
    }
  });
  assert.throws(() => tamperSequences.sequences(tamperRuntime.connection.id), /signature mismatch/);
});
