import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { applyComponentCatalogExtension } from "../../dist/packages/component-library/src/extension.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { mechanicalCommandRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/index.js";
import { mechanicalRotaryNamedPositionsRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/rotary-named-positions.js";
import { mechanicalRotaryWaypointPlanAttestationRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/rotary-waypoint-plan-attestation.js";
import { rotaryWaypointExecutionEvidence } from "../../dist/packages/invention-mechanical-command-runtime/src/rotary-waypoint-execution-evidence.js";
import { mechanicalRotaryWaypointSequenceRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/rotary-waypoint-sequence.js";
import { InventionSpatialScene, parseInventionSpatialDocument } from "../../dist/packages/invention-spatial-runtime/src/index.js";
import { InventionBuilder, createBlankInventionProject } from "../../dist/packages/invention-runtime/src/index.js";
import { createSessionSnapshot, restoreSessionSnapshot } from "../../dist/packages/persistence-runtime/src/index.js";

const DEG = Math.PI / 180;
function close(actual, expected, epsilon = 1e-7) { assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`); }

async function rotaryRuntime(projectId = "waypoint-attestation-test") {
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

async function authorCycle(spatial, relationshipId, steps = [
  { positionName: "Inspect", durationSeconds: 3 },
  { positionName: "Load", durationSeconds: 9 }
]) {
  const commands = mechanicalCommandRuntimeFor(spatial);
  const positions = mechanicalRotaryNamedPositionsRuntimeFor(spatial);
  const sequences = mechanicalRotaryWaypointSequenceRuntimeFor(spatial);
  assert.equal((await commands.setContinuousTarget(relationshipId, 90 * DEG, "ui")).ok, true);
  assert.equal((await positions.savePosition(relationshipId, "Inspect", "ui")).ok, true);
  assert.equal((await commands.setContinuousTarget(relationshipId, 360 * DEG, "ui")).ok, true);
  assert.equal((await positions.savePosition(relationshipId, "Load", "ui")).ok, true);
  assert.equal((await commands.setContinuousTarget(relationshipId, 0, "ui")).ok, true);
  assert.equal((await sequences.saveSequence(relationshipId, "Inspection Cycle", steps, "ui")).ok, true);
  return { commands, positions, sequences, attestations: mechanicalRotaryWaypointPlanAttestationRuntimeFor(spatial) };
}

test("S2.34 attests the consumed S2.31 plan against canonical S2.32 execution evidence per segment", async () => {
  const { session, spatial, connection } = await rotaryRuntime("attestation-verified");
  const { attestations } = await authorCycle(spatial, connection.id);
  const eventsBefore = session.events.list().length;
  const outcome = await attestations.runSequenceAttested(connection.id, "Inspection Cycle", "automation");
  assert.equal(outcome.ok, true, outcome.error);
  assert.ok(outcome.result);
  const attestation = outcome.result.attestation;
  assert.equal(attestation.attestationCommandId, "mechanical-sequence-attestation-cmd-1");
  assert.equal(attestation.sequenceRunCommandId, "mechanical-sequence-cmd-2");
  assert.equal(attestation.source, "automation");
  assert.equal(attestation.derivedFrom, "consumed-plan+s2.32-execution-evidence");
  assert.equal(attestation.allSegmentsMatched, true);
  assert.equal(attestation.stepsCompleted, 2);
  assert.equal(attestation.segments.length, 2);
  close(attestation.plannedTotalDeltaRadians, 360 * DEG);
  close(attestation.actualTotalDeltaRadians, 360 * DEG);
  close(attestation.plannedCumulativeAbsoluteTravelRadians, 360 * DEG);
  close(attestation.actualCumulativeAbsoluteTravelRadians, 360 * DEG);
  assert.equal(session.events.list().length, eventsBefore + 4, "two canonical movements + sequence request + attestation expected");
  assert.equal(session.events.list().at(-1)?.type, "MechanicalRotaryWaypointPlanExecutionAttested");

  const execution = rotaryWaypointExecutionEvidence(session, connection.id, "Inspection Cycle");
  assert.equal(execution.length, 1);
  assert.equal(execution[0]?.commandId, attestation.sequenceRunCommandId);
  const [inspect, load] = attestation.segments;
  assert.ok(inspect && load);
  assert.equal(inspect.positionName, "Inspect");
  assert.equal(inspect.movementCommandId, "mechanical-cmd-4");
  close(inspect.plannedTargetContinuousRadians, 90 * DEG);
  close(inspect.actualAfterContinuousRadians, 90 * DEG);
  close(inspect.plannedAverageRpm, 5);
  close(inspect.actualAverageRpm, 5);
  assert.equal(inspect.actualMode, "continuous-absolute");
  assert.equal(load.movementCommandId, "mechanical-cmd-5");
  close(load.plannedDeltaRadians, 270 * DEG);
  close(load.actualDeltaRadians, 270 * DEG);
  assert.equal(attestations.lastAttestation(connection.id, "inspection cycle")?.allSegmentsMatched, true);
});

test("S2.34 freezes consumed plan coordinates while future live plans follow edited Named Positions", async () => {
  const { spatial, connection } = await rotaryRuntime("attestation-live-edit");
  const { commands, positions, sequences, attestations } = await authorCycle(spatial, connection.id);
  assert.equal((await attestations.runSequenceAttested(connection.id, "Inspection Cycle", "ui")).ok, true);
  const historical = attestations.lastAttestation(connection.id, "Inspection Cycle");
  assert.ok(historical);
  close(historical.segments[0]?.plannedTargetContinuousRadians, 90 * DEG);

  assert.equal((await commands.setContinuousTarget(connection.id, 120 * DEG, "ui")).ok, true);
  assert.equal((await positions.savePosition(connection.id, "Inspect", "ui")).ok, true);
  assert.equal((await commands.setContinuousTarget(connection.id, 0, "ui")).ok, true);
  const futurePlan = sequences.planSequence(connection.id, "Inspection Cycle");
  close(futurePlan.segments[0]?.targetContinuousRadians, 120 * DEG);
  close(attestations.lastAttestation(connection.id, "Inspection Cycle")?.segments[0]?.plannedTargetContinuousRadians, 90 * DEG);
});

test("S2.34 publishes no attestation when the canonical S2.31 preflight blocks before movement", async () => {
  const { session, spatial, connection } = await rotaryRuntime("attestation-blocked");
  const { commands, attestations } = await authorCycle(spatial, connection.id);
  assert.equal((await commands.setTravelLimits(connection.id, -90 * DEG, 180 * DEG, "ui")).ok, true);
  const spatialBefore = spatial.document();
  const eventsBefore = session.events.list().length;
  const blocked = await attestations.runSequenceAttested(connection.id, "Inspection Cycle", "automation");
  assert.equal(blocked.ok, false);
  assert.match(blocked.error ?? "", /waypoint sequence travel limit exceeded/);
  assert.deepEqual(spatial.document(), spatialBefore);
  assert.equal(session.events.list().length, eventsBefore, "blocked attested run must create neither canonical run-success nor attestation evidence");
  assert.equal(attestations.lastAttestation(connection.id, "Inspection Cycle"), null);
  assert.equal(rotaryWaypointExecutionEvidence(session, connection.id, "Inspection Cycle").length, 0);
});

test("S2.34 restores attestation without replay and fails closed when either attestation or S2.32 evidence is tampered", async () => {
  const { session, builder, spatial, connection } = await rotaryRuntime("attestation-restore");
  const { attestations } = await authorCycle(spatial, connection.id);
  assert.equal((await attestations.runSequenceAttested(connection.id, "Inspection Cycle", "voice")).ok, true);
  const attestation = attestations.lastAttestation(connection.id, "Inspection Cycle");
  assert.ok(attestation);
  const snapshot = createSessionSnapshot(session, { extensions: { invention: builder.document(), inventionSpatial: spatial.document() } });
  const eventCount = snapshot.events.length;

  const restoredSession = restoreSessionSnapshot(JSON.parse(JSON.stringify(snapshot)));
  const restoredSpatial = new InventionSpatialScene(restoredSession, parseInventionSpatialDocument(snapshot.extensions.inventionSpatial));
  const restoredAttestations = mechanicalRotaryWaypointPlanAttestationRuntimeFor(restoredSpatial);
  assert.equal(restoredSession.events.list().length, eventCount, "restore must not replay plan attestation or movement");
  assert.deepEqual(restoredAttestations.lastAttestation(connection.id, "Inspection Cycle"), attestation);

  const tamperedAttestationSnapshot = JSON.parse(JSON.stringify(snapshot));
  const attestationEvent = tamperedAttestationSnapshot.events.find((event) => event.type === "MechanicalRotaryWaypointPlanExecutionAttested");
  assert.ok(attestationEvent);
  attestationEvent.payload.attestation.signature = "tampered";
  const tamperedAttestationSession = restoreSessionSnapshot(tamperedAttestationSnapshot);
  const tamperedAttestationSpatial = new InventionSpatialScene(tamperedAttestationSession, parseInventionSpatialDocument(snapshot.extensions.inventionSpatial));
  assert.throws(
    () => mechanicalRotaryWaypointPlanAttestationRuntimeFor(tamperedAttestationSpatial).lastAttestation(connection.id, "Inspection Cycle"),
    /attestation integrity mismatch/
  );

  const tamperedExecutionSnapshot = JSON.parse(JSON.stringify(snapshot));
  const movementEvent = tamperedExecutionSnapshot.events.find((event) => event.type === "MechanicalRotaryContinuousTargetExecuted" && event.payload?.commandId === "mechanical-cmd-4");
  assert.ok(movementEvent);
  movementEvent.payload.afterContinuousRadians = 999;
  const tamperedExecutionSession = restoreSessionSnapshot(tamperedExecutionSnapshot);
  const tamperedExecutionSpatial = new InventionSpatialScene(tamperedExecutionSession, parseInventionSpatialDocument(snapshot.extensions.inventionSpatial));
  assert.throws(
    () => mechanicalRotaryWaypointPlanAttestationRuntimeFor(tamperedExecutionSpatial).lastAttestation(connection.id, "Inspection Cycle"),
    /execution|continuity|aggregate|match/i
  );
});
