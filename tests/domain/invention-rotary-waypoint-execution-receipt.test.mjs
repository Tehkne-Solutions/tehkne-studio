import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { applyComponentCatalogExtension } from "../../dist/packages/component-library/src/extension.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { mechanicalCommandRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/index.js";
import { mechanicalRotaryNamedPositionsRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/rotary-named-positions.js";
import { mechanicalRotaryWaypointExecutionReceiptRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/rotary-waypoint-execution-receipt.js";
import { mechanicalRotaryWaypointSequenceRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/rotary-waypoint-sequence.js";
import { InventionSpatialScene, parseInventionSpatialDocument } from "../../dist/packages/invention-spatial-runtime/src/index.js";
import { InventionBuilder, createBlankInventionProject } from "../../dist/packages/invention-runtime/src/index.js";
import { createSessionSnapshot, restoreSessionSnapshot } from "../../dist/packages/persistence-runtime/src/index.js";

const DEG = Math.PI / 180;
function close(actual, expected, epsilon = 1e-7) { assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`); }

async function rotaryRuntime(projectId = "waypoint-receipt-test") {
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

async function authorPositionsAndSequence(spatial, connectionId, steps = [
  { positionName: "Inspect", durationSeconds: 3 },
  { positionName: "Load", durationSeconds: 9 }
]) {
  const commands = mechanicalCommandRuntimeFor(spatial);
  const positions = mechanicalRotaryNamedPositionsRuntimeFor(spatial);
  const sequences = mechanicalRotaryWaypointSequenceRuntimeFor(spatial);
  assert.equal((await commands.setContinuousTarget(connectionId, 90 * DEG, "ui")).ok, true);
  assert.equal((await positions.savePosition(connectionId, "Inspect", "ui")).ok, true);
  assert.equal((await commands.setContinuousTarget(connectionId, 360 * DEG, "ui")).ok, true);
  assert.equal((await positions.savePosition(connectionId, "Load", "ui")).ok, true);
  assert.equal((await commands.setContinuousTarget(connectionId, 0, "ui")).ok, true);
  assert.equal((await sequences.saveSequence(connectionId, "Inspection Cycle", steps, "ui")).ok, true);
  return { commands, positions, sequences, receipts: mechanicalRotaryWaypointExecutionReceiptRuntimeFor(spatial) };
}

test("S2.32 records a verified immutable per-segment receipt from the consumed plan and canonical movement events", async () => {
  const { session, spatial, connection } = await rotaryRuntime("waypoint-receipt-verified");
  const { commands, positions, sequences, receipts } = await authorPositionsAndSequence(spatial, connection.id);
  const eventsBefore = session.events.list().length;
  const outcome = await receipts.runSequenceVerified(connection.id, "Inspection Cycle", "automation");
  assert.equal(outcome.ok, true, outcome.error);
  assert.ok(outcome.result);
  const receipt = outcome.result.receipt;
  assert.equal(receipt.receiptCommandId, "mechanical-sequence-receipt-cmd-1");
  assert.equal(receipt.sequenceRunCommandId, "mechanical-sequence-cmd-2");
  assert.equal(receipt.source, "automation");
  assert.equal(receipt.derivedFrom, "consumed-plan+movement-events");
  assert.equal(receipt.allSegmentsMatched, true);
  assert.equal(receipt.stepsCompleted, 2);
  assert.equal(receipt.segments.length, 2);
  close(receipt.plannedTotalDeltaRadians, 360 * DEG);
  close(receipt.actualTotalDeltaRadians, 360 * DEG);
  close(receipt.plannedCumulativeAbsoluteTravelRadians, 360 * DEG);
  close(receipt.actualCumulativeAbsoluteTravelRadians, 360 * DEG);
  assert.equal(receipt.durationMode, "complete-explicit");
  close(receipt.plannedTotalDurationSeconds, 12);
  assert.equal(session.events.list().length, eventsBefore + 4, "two movements + canonical sequence request + receipt expected");
  assert.equal(session.events.list().at(-1)?.type, "MechanicalRotaryWaypointExecutionReceipt");

  const [inspect, load] = receipt.segments;
  assert.ok(inspect && load);
  assert.equal(inspect.positionName, "Inspect");
  assert.equal(inspect.movementCommandId, "mechanical-cmd-4");
  close(inspect.plannedFromContinuousRadians, 0);
  close(inspect.plannedTargetContinuousRadians, 90 * DEG);
  close(inspect.actualBeforeContinuousRadians, 0);
  close(inspect.actualAfterContinuousRadians, 90 * DEG);
  close(inspect.plannedAverageRpm, 5);
  close(inspect.actualAverageRpm, 5);
  assert.equal(inspect.actualMode, "continuous-absolute");
  assert.equal(inspect.matched, true);
  assert.equal(load.movementCommandId, "mechanical-cmd-5");
  close(load.plannedDeltaRadians, 270 * DEG);
  close(load.actualDeltaRadians, 270 * DEG);
  close(load.actualAverageRpm, 5);

  const historical = receipts.lastReceipt(connection.id, "inspection cycle");
  assert.deepEqual(historical, receipt);
  assert.equal((await commands.setContinuousTarget(connection.id, 120 * DEG, "ui")).ok, true);
  assert.equal((await positions.savePosition(connection.id, "Inspect", "ui")).ok, true);
  assert.equal((await commands.setContinuousTarget(connection.id, 0, "ui")).ok, true);
  const livePlan = sequences.planSequence(connection.id, "Inspection Cycle");
  close(livePlan.segments[0]?.targetContinuousRadians, 120 * DEG);
  close(receipts.lastReceipt(connection.id, "Inspection Cycle")?.segments[0]?.plannedTargetContinuousRadians, 90 * DEG);
});

test("S2.32 preserves unresolved timing honestly inside execution receipts", async () => {
  const { spatial, connection } = await rotaryRuntime("waypoint-receipt-partial");
  const { receipts } = await authorPositionsAndSequence(spatial, connection.id, [
    { positionName: "Inspect" },
    { positionName: "Load", durationSeconds: 9 }
  ]);
  const outcome = await receipts.runSequenceVerified(connection.id, "Inspection Cycle", "voice");
  assert.equal(outcome.ok, true, outcome.error);
  assert.ok(outcome.result);
  const receipt = outcome.result.receipt;
  assert.equal(receipt.durationMode, "partial-explicit");
  assert.equal(receipt.plannedTotalDurationSeconds, null);
  assert.equal(receipt.segments[0]?.plannedDurationSeconds, null);
  assert.equal(receipt.segments[0]?.actualDurationSeconds, null);
  assert.equal(receipt.segments[0]?.plannedAverageRpm, null);
  assert.equal(receipt.segments[0]?.actualAverageRpm, null);
  assert.equal(receipt.segments[0]?.plannedRateMode, "unresolved-no-duration");
  assert.equal(receipt.segments[0]?.actualRateMode, "unresolved-no-duration");
  assert.equal(receipt.segments[1]?.plannedRateMode, "segment-average");
  close(receipt.segments[1]?.actualAverageRpm, 5);
});

test("S2.32 publishes no execution receipt when the shared S2.31 plan blocks before movement", async () => {
  const { session, spatial, connection } = await rotaryRuntime("waypoint-receipt-blocked");
  const { commands, receipts } = await authorPositionsAndSequence(spatial, connection.id);
  assert.equal((await commands.setTravelLimits(connection.id, -90 * DEG, 180 * DEG, "ui")).ok, true);
  const spatialBefore = spatial.document();
  const eventsBefore = session.events.list().length;
  const blocked = await receipts.runSequenceVerified(connection.id, "Inspection Cycle", "automation");
  assert.equal(blocked.ok, false);
  assert.match(blocked.error ?? "", /waypoint sequence travel limit exceeded/);
  assert.deepEqual(spatial.document(), spatialBefore);
  assert.equal(session.events.list().length, eventsBefore, "blocked verified run must not manufacture sequence or receipt success evidence");
  assert.equal(receipts.lastReceipt(connection.id, "Inspection Cycle"), null);
});

test("S2.32 persists receipts in session events without replay and fails closed for tampered receipt evidence", async () => {
  const { session, builder, spatial, connection } = await rotaryRuntime("waypoint-receipt-restore");
  const { receipts } = await authorPositionsAndSequence(spatial, connection.id);
  assert.equal((await receipts.runSequenceVerified(connection.id, "Inspection Cycle", "ui")).ok, true);
  const receipt = receipts.lastReceipt(connection.id, "Inspection Cycle");
  assert.ok(receipt);
  const snapshot = createSessionSnapshot(session, { extensions: { invention: builder.document(), inventionSpatial: spatial.document() } });
  const eventCount = snapshot.events.length;

  const restoredSession = restoreSessionSnapshot(JSON.parse(JSON.stringify(snapshot)));
  const restoredSpatial = new InventionSpatialScene(restoredSession, parseInventionSpatialDocument(snapshot.extensions.inventionSpatial));
  const restoredReceipts = mechanicalRotaryWaypointExecutionReceiptRuntimeFor(restoredSpatial);
  assert.equal(restoredSession.events.list().length, eventCount, "restore must not replay sequence receipt creation");
  assert.deepEqual(restoredReceipts.lastReceipt(connection.id, "Inspection Cycle"), receipt);

  const tamperedSnapshot = JSON.parse(JSON.stringify(snapshot));
  const receiptEvent = tamperedSnapshot.events.find((event) => event.type === "MechanicalRotaryWaypointExecutionReceipt");
  assert.ok(receiptEvent);
  receiptEvent.payload.receipt.signature = "tampered";
  const tamperedSession = restoreSessionSnapshot(tamperedSnapshot);
  const tamperedSpatial = new InventionSpatialScene(tamperedSession, parseInventionSpatialDocument(snapshot.extensions.inventionSpatial));
  const tamperedReceipts = mechanicalRotaryWaypointExecutionReceiptRuntimeFor(tamperedSpatial);
  assert.throws(() => tamperedReceipts.lastReceipt(connection.id, "Inspection Cycle"), /receipt integrity mismatch/);
});
