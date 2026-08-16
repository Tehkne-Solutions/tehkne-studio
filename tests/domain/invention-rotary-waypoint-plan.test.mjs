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

async function rotaryRuntime(projectId = "waypoint-plan-test") {
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

test("S2.31 plans a fully timed waypoint sequence without mutation and derives deterministic per-segment rates", async () => {
  const { session, spatial, connection } = await rotaryRuntime("waypoint-plan-timed");
  const commands = mechanicalCommandRuntimeFor(spatial);
  const positions = mechanicalRotaryNamedPositionsRuntimeFor(spatial);
  const sequences = mechanicalRotaryWaypointSequenceRuntimeFor(spatial);
  await authorTwoPositions(commands, positions, connection.id);
  assert.equal((await sequences.saveSequence(connection.id, "Inspection Cycle", [
    { positionName: "Inspect", durationSeconds: 3 },
    { positionName: "Load", durationSeconds: 9 }
  ], "ui")).ok, true);
  const spatialBefore = spatial.document();
  const eventsBefore = session.events.list().length;
  const kinematicsBefore = commands.kinematics(connection.id);
  const rateBefore = commands.rate(connection.id);

  const plan = sequences.planSequence(connection.id, "inspection cycle");
  assert.equal(plan.signature, "Tehkné Solutions");
  assert.equal(plan.sequenceKey, "inspection cycle");
  assert.equal(plan.segments.length, 2);
  assert.equal(plan.admissible, true);
  assert.equal(plan.travelLimitsActive, false);
  assert.equal(plan.durationMode, "complete-explicit");
  assert.equal(plan.timedSteps, 2);
  assert.equal(plan.untimedSteps, 0);
  close(plan.beforeContinuousRadians, 0);
  close(plan.afterContinuousRadians, 360 * DEG);
  close(plan.totalDeltaRadians, 360 * DEG);
  close(plan.cumulativeAbsoluteTravelRadians, 360 * DEG);
  close(plan.explicitDurationSeconds, 12);
  close(plan.totalDurationSeconds, 12);

  const [inspect, load] = plan.segments;
  assert.ok(inspect && load);
  close(inspect.fromContinuousRadians, 0);
  close(inspect.targetContinuousRadians, 90 * DEG);
  close(inspect.deltaRadians, 90 * DEG);
  assert.equal(inspect.durationSeconds, 3);
  assert.equal(inspect.rateMode, "segment-average");
  close(inspect.averageRpm, 5);
  assert.equal(inspect.withinTravelLimits, true);
  close(load.fromContinuousRadians, 90 * DEG);
  close(load.targetContinuousRadians, 360 * DEG);
  close(load.deltaRadians, 270 * DEG);
  assert.equal(load.durationSeconds, 9);
  assert.equal(load.rateMode, "segment-average");
  close(load.averageRpm, 5);

  assert.deepEqual(spatial.document(), spatialBefore, "PREVIEW must not mutate inventionSpatial");
  assert.equal(session.events.list().length, eventsBefore, "PREVIEW must not manufacture audit or movement events");
  assert.deepEqual(commands.kinematics(connection.id), kinematicsBefore);
  assert.deepEqual(commands.rate(connection.id), rateBefore);

  const run = await sequences.runSequence(connection.id, "Inspection Cycle", "ui");
  assert.equal(run.ok, true, run.error);
  assert.equal(run.result?.commandId, "mechanical-sequence-cmd-2", "pure plan query must not consume a CommandBus sequence ID");
});

test("S2.31 keeps partial timing unresolved instead of inventing total duration while preserving route geometry", async () => {
  const { session, spatial, connection } = await rotaryRuntime("waypoint-plan-partial");
  const commands = mechanicalCommandRuntimeFor(spatial);
  const positions = mechanicalRotaryNamedPositionsRuntimeFor(spatial);
  const sequences = mechanicalRotaryWaypointSequenceRuntimeFor(spatial);
  await authorTwoPositions(commands, positions, connection.id);
  assert.equal((await sequences.saveSequence(connection.id, "Mixed Timing", [
    { positionName: "Load" },
    { positionName: "Inspect", durationSeconds: 3 }
  ], "ui")).ok, true);
  const eventsBefore = session.events.list().length;

  const plan = sequences.planSequence(connection.id, "Mixed Timing");
  assert.equal(plan.durationMode, "partial-explicit");
  assert.equal(plan.timedSteps, 1);
  assert.equal(plan.untimedSteps, 1);
  close(plan.explicitDurationSeconds, 3);
  assert.equal(plan.totalDurationSeconds, null, "partial timing must not be promoted to a fictional total duration");
  close(plan.totalDeltaRadians, 90 * DEG);
  close(plan.cumulativeAbsoluteTravelRadians, 630 * DEG);
  assert.equal(plan.segments[0]?.rateMode, "unresolved-no-duration");
  assert.equal(plan.segments[0]?.durationSeconds, null);
  assert.equal(plan.segments[0]?.averageRpm, null);
  assert.equal(plan.segments[1]?.rateMode, "segment-average");
  close(plan.segments[1]?.deltaRadians, -270 * DEG);
  close(plan.segments[1]?.averageRpm, -15);
  assert.equal(session.events.list().length, eventsBefore, "planning partial timing remains a read-only query");
});

test("S2.31 exposes blocked waypoint segments and RUN SEQUENCE consumes the same plan as fail-closed preflight", async () => {
  const { session, spatial, connection } = await rotaryRuntime("waypoint-plan-limits");
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
  const eventsBefore = session.events.list().length;
  const kinematicsBefore = commands.kinematics(connection.id);
  const rateBefore = commands.rate(connection.id);

  const plan = sequences.planSequence(connection.id, "Inspect then Load");
  assert.equal(plan.travelLimitsActive, true);
  assert.equal(plan.admissible, false);
  assert.equal(plan.segments[0]?.withinTravelLimits, true);
  assert.equal(plan.segments[1]?.withinTravelLimits, false);
  close(plan.segments[1]?.targetContinuousRadians, 360 * DEG);
  assert.deepEqual(spatial.document(), spatialBefore);
  assert.equal(session.events.list().length, eventsBefore);

  const blocked = await sequences.runSequence(connection.id, "Inspect then Load", "automation");
  assert.equal(blocked.ok, false);
  assert.match(blocked.error ?? "", /waypoint sequence travel limit exceeded/);
  assert.deepEqual(spatial.document(), spatialBefore, "RUN must reject the same blocked plan before waypoint 1");
  assert.deepEqual(commands.kinematics(connection.id), kinematicsBefore);
  assert.deepEqual(commands.rate(connection.id), rateBefore);
  assert.equal(session.events.list().length, eventsBefore, "blocked shared plan must publish no sequence-success evidence");
});

test("S2.31 recomputes plans from live Named Positions after restore and persists no independent plan document", async () => {
  const { session, builder, spatial, connection } = await rotaryRuntime("waypoint-plan-restore");
  const commands = mechanicalCommandRuntimeFor(spatial);
  const positions = mechanicalRotaryNamedPositionsRuntimeFor(spatial);
  const sequences = mechanicalRotaryWaypointSequenceRuntimeFor(spatial);
  await authorTwoPositions(commands, positions, connection.id);
  assert.equal((await sequences.saveSequence(connection.id, "Inspection Loop", [
    { positionName: "Inspect", durationSeconds: 3 },
    { positionName: "Load", durationSeconds: 9 }
  ], "ui")).ok, true);
  const firstPlan = sequences.planSequence(connection.id, "Inspection Loop");
  close(firstPlan.segments[0]?.targetContinuousRadians, 90 * DEG);
  const relationshipBefore = session.graph.snapshot().relationships.find((entry) => entry.id === connection.id);
  assert.ok(relationshipBefore);
  assert.equal(relationshipBefore.metadata.rotaryWaypointPlan, undefined);
  assert.equal(relationshipBefore.metadata.sequencePlan, undefined);

  const snapshot = createSessionSnapshot(session, { extensions: { invention: builder.document(), inventionSpatial: spatial.document() } });
  const eventCount = snapshot.events.length;
  const restoredSession = restoreSessionSnapshot(JSON.parse(JSON.stringify(snapshot)));
  const restoredSpatial = new InventionSpatialScene(restoredSession, parseInventionSpatialDocument(snapshot.extensions.inventionSpatial));
  const restoredCommands = mechanicalCommandRuntimeFor(restoredSpatial);
  const restoredPositions = mechanicalRotaryNamedPositionsRuntimeFor(restoredSpatial);
  const restoredSequences = mechanicalRotaryWaypointSequenceRuntimeFor(restoredSpatial);
  assert.equal(restoredSession.events.list().length, eventCount, "restore must not replay or materialize a sequence plan");

  assert.equal((await restoredCommands.setContinuousTarget(connection.id, 120 * DEG, "ui")).ok, true);
  assert.equal((await restoredPositions.savePosition(connection.id, "Inspect", "ui")).ok, true);
  assert.equal((await restoredCommands.setContinuousTarget(connection.id, 0, "ui")).ok, true);
  const livePlan = restoredSequences.planSequence(connection.id, "Inspection Loop");
  close(livePlan.segments[0]?.targetContinuousRadians, 120 * DEG, 1e-6);
  close(livePlan.segments[0]?.deltaRadians, 120 * DEG, 1e-6);
  close(livePlan.segments[0]?.averageRpm, 60 / 3 / 3, 1e-6);
  const restoredRelationship = restoredSession.graph.snapshot().relationships.find((entry) => entry.id === connection.id);
  assert.ok(restoredRelationship);
  assert.equal(restoredRelationship.metadata.rotaryWaypointPlan, undefined);
  assert.equal(restoredRelationship.metadata.sequencePlan, undefined);
});
