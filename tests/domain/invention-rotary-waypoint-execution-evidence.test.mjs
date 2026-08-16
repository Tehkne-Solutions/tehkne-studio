import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { applyComponentCatalogExtension } from "../../dist/packages/component-library/src/extension.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { mechanicalCommandRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/index.js";
import { mechanicalRotaryNamedPositionsRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/rotary-named-positions.js";
import { mechanicalRotaryWaypointSequenceRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/rotary-waypoint-sequence.js";
import { latestRotaryWaypointExecutionEvidence, rotaryWaypointExecutionEvidence } from "../../dist/packages/invention-mechanical-command-runtime/src/rotary-waypoint-execution-evidence.js";
import { InventionSpatialScene } from "../../dist/packages/invention-spatial-runtime/src/index.js";
import { InventionBuilder, createBlankInventionProject } from "../../dist/packages/invention-runtime/src/index.js";

const DEG = Math.PI / 180;
function close(actual, expected, epsilon = 1e-7) { assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`); }

async function rotaryRuntime(projectId) {
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
  return { session, spatial, connection };
}

async function authorPositions(commands, positions, relationshipId) {
  assert.equal((await commands.setContinuousTarget(relationshipId, 90 * DEG, "ui")).ok, true);
  assert.equal((await positions.savePosition(relationshipId, "Inspect", "ui")).ok, true);
  assert.equal((await commands.setContinuousTarget(relationshipId, 360 * DEG, "ui")).ok, true);
  assert.equal((await positions.savePosition(relationshipId, "Load", "ui")).ok, true);
  assert.equal((await commands.setContinuousTarget(relationshipId, 0, "ui")).ok, true);
}

test("S2.32 derives immutable execution evidence from the canonical sequence request and movement events", async () => {
  const { session, spatial, connection } = await rotaryRuntime("waypoint-execution-evidence");
  const commands = mechanicalCommandRuntimeFor(spatial);
  const positions = mechanicalRotaryNamedPositionsRuntimeFor(spatial);
  const sequences = mechanicalRotaryWaypointSequenceRuntimeFor(spatial);
  await authorPositions(commands, positions, connection.id);
  assert.equal((await sequences.saveSequence(connection.id, "Inspection Cycle", [
    { positionName: "Inspect", durationSeconds: 3 },
    { positionName: "Load", durationSeconds: 9 }
  ], "ui")).ok, true);
  const eventCountBeforeRun = session.events.list().length;
  const run = await sequences.runSequence(connection.id, "Inspection Cycle", "automation");
  assert.equal(run.ok, true, run.error);
  const eventCountAfterRun = session.events.list().length;

  const evidence = latestRotaryWaypointExecutionEvidence(session, connection.id, "inspection cycle");
  assert.ok(evidence);
  assert.equal(evidence.signature, "Tehkné Solutions");
  assert.equal(evidence.derivedFrom, "session-events");
  assert.equal(evidence.commandId, run.result.commandId);
  assert.equal(evidence.sequenceKey, "inspection cycle");
  assert.equal(evidence.source, "automation");
  assert.equal(evidence.stepsCompleted, 2);
  assert.deepEqual(evidence.movementCommandIds, run.result.movementCommandIds);
  assert.equal(evidence.durationMode, "complete-explicit");
  assert.equal(evidence.timedSteps, 2);
  assert.equal(evidence.untimedSteps, 0);
  close(evidence.explicitDurationSeconds, 12);
  close(evidence.totalDurationSeconds, 12);
  close(evidence.beforeContinuousRadians, 0);
  close(evidence.afterContinuousRadians, 360 * DEG);
  close(evidence.totalDeltaRadians, 360 * DEG);
  close(evidence.cumulativeAbsoluteTravelRadians, 360 * DEG);
  assert.equal(evidence.segments[0].mode, "continuous-absolute");
  assert.equal(evidence.segments[0].durationSeconds, 3);
  close(evidence.segments[0].averageRpm, 5);
  assert.equal(evidence.segments[1].durationSeconds, 9);
  close(evidence.segments[1].averageRpm, 5);
  assert.equal(session.events.list().length, eventCountAfterRun, "evidence projection must not manufacture events");
  assert.ok(eventCountAfterRun > eventCountBeforeRun);
});

test("S2.32 preserves unresolved timing and supports multiple historical executions without a parallel execution document", async () => {
  const { session, spatial, connection } = await rotaryRuntime("waypoint-execution-history");
  const commands = mechanicalCommandRuntimeFor(spatial);
  const positions = mechanicalRotaryNamedPositionsRuntimeFor(spatial);
  const sequences = mechanicalRotaryWaypointSequenceRuntimeFor(spatial);
  await authorPositions(commands, positions, connection.id);
  assert.equal((await sequences.saveSequence(connection.id, "Mixed Cycle", [
    { positionName: "Load" },
    { positionName: "Inspect", durationSeconds: 3 }
  ], "ui")).ok, true);
  assert.equal((await sequences.runSequence(connection.id, "Mixed Cycle", "ui")).ok, true);
  assert.equal((await commands.setContinuousTarget(connection.id, 0, "ui")).ok, true);
  assert.equal((await sequences.runSequence(connection.id, "Mixed Cycle", "voice")).ok, true);

  const history = rotaryWaypointExecutionEvidence(session, connection.id, "mixed cycle");
  assert.equal(history.length, 2);
  assert.equal(history[0].durationMode, "partial-explicit");
  assert.equal(history[0].timedSteps, 1);
  assert.equal(history[0].untimedSteps, 1);
  assert.equal(history[0].totalDurationSeconds, null);
  assert.equal(history[0].segments[0].rateMode, "unresolved-no-duration");
  assert.equal(history[0].segments[0].averageRpm, null);
  assert.equal(history[1].source, "voice");
  const relationship = session.graph.snapshot().relationships.find((entry) => entry.id === connection.id);
  assert.ok(relationship);
  assert.equal(relationship.metadata.rotaryWaypointExecutionEvidence, undefined);
  assert.equal(relationship.metadata.sequenceExecution, undefined);
});
