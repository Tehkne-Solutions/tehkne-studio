import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { applyComponentCatalogExtension } from "../../dist/packages/component-library/src/extension.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import {
  deriveRotarySegmentRate,
  mechanicalCommandRuntimeFor
} from "../../dist/packages/invention-mechanical-command-runtime/src/index.js";
import { InventionSpatialScene, parseInventionSpatialDocument } from "../../dist/packages/invention-spatial-runtime/src/index.js";
import { InventionBuilder, createBlankInventionProject } from "../../dist/packages/invention-runtime/src/index.js";
import { createSessionSnapshot, restoreSessionSnapshot } from "../../dist/packages/persistence-runtime/src/index.js";

const DEG = Math.PI / 180;
function close(actual, expected, epsilon = 1e-7) { assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`); }

async function rotaryRuntime(projectId = "segment-rate-test") {
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

test("S2.25 derives deterministic segment-average angular rate and RPM only from explicit duration", () => {
  const rate = deriveRotarySegmentRate(15 * DEG, 0.5);
  close(rate.averageAngularVelocityRadPerSec, Math.PI / 6);
  close(rate.averageRpm, 5);
  assert.equal(rate.mode, "segment-average");
  assert.equal(rate.signature, "Tehkné Solutions");

  const reverse = deriveRotarySegmentRate(-30 * DEG, 1);
  close(reverse.averageAngularVelocityRadPerSec, -Math.PI / 6);
  close(reverse.averageRpm, -5);
  assert.throws(() => deriveRotarySegmentRate(15 * DEG, 0), /greater than zero/);
  assert.throws(() => deriveRotarySegmentRate(15 * DEG, Number.NaN), /must be finite/);
});

test("S2.25 untimed rotary commands keep rate unresolved instead of inferring from wall-clock timestamps", async () => {
  const { session, spatial, connection } = await rotaryRuntime("segment-rate-unresolved");
  const commands = mechanicalCommandRuntimeFor(spatial);
  const outcome = await commands.step(connection.id, 15 * DEG, "ui");
  assert.equal(outcome.ok, true, outcome.error);
  assert.equal(outcome.result.durationSeconds, null);
  assert.equal(outcome.result.averageAngularVelocityRadPerSec, null);
  assert.equal(outcome.result.averageRpm, null);
  assert.equal(outcome.result.rateMode, "unresolved-no-duration");
  const event = session.events.list().at(-1);
  assert.equal(typeof event?.occurredAt, "string");
  assert.equal(commands.rate(connection.id).mode, "unresolved-no-duration");
  assert.equal(commands.rate(connection.id).derivedFrom, "session-events-explicit-duration");
});

test("S2.25 timed step records and restores segment-average rate through the existing session event stream", async () => {
  const { session, builder, spatial, connection } = await rotaryRuntime("segment-rate-restore");
  const commands = mechanicalCommandRuntimeFor(spatial);
  const outcome = await commands.step(connection.id, 15 * DEG, "automation", 0.5);
  assert.equal(outcome.ok, true, outcome.error);
  assert.equal(outcome.result.durationSeconds, 0.5);
  close(outcome.result.averageAngularVelocityRadPerSec, Math.PI / 6);
  close(outcome.result.averageRpm, 5);
  assert.equal(outcome.result.rateMode, "segment-average");
  const before = commands.rate(connection.id);
  assert.equal(before.commandId, "mechanical-cmd-1");
  close(before.averageRpm, 5);

  const snapshot = createSessionSnapshot(session, { extensions: { invention: builder.document(), inventionSpatial: spatial.document() } });
  const restoredSession = restoreSessionSnapshot(JSON.parse(JSON.stringify(snapshot)));
  const restoredSpatial = new InventionSpatialScene(restoredSession, parseInventionSpatialDocument(snapshot.extensions.inventionSpatial));
  const restoredCommands = mechanicalCommandRuntimeFor(restoredSpatial);
  assert.deepEqual(restoredCommands.rate(connection.id), before);
});

test("S2.25 timed principal target uses the actual shortest delta and explicit duration for segment rate", async () => {
  const { spatial, connection } = await rotaryRuntime("segment-rate-target");
  const commands = mechanicalCommandRuntimeFor(spatial);
  const first = await commands.step(connection.id, 15 * DEG, "ui");
  assert.equal(first.ok, true, first.error);
  const outcome = await commands.setTarget(connection.id, 75 * DEG, "voice", 2);
  assert.equal(outcome.ok, true, outcome.error);
  close(outcome.result.deltaRadians, 60 * DEG);
  close(outcome.result.averageAngularVelocityRadPerSec, Math.PI / 6);
  close(outcome.result.averageRpm, 5);
  assert.equal(commands.rate(connection.id).commandId, "mechanical-cmd-2");
});

test("S2.25 latest untimed command makes rate unresolved even after timed evidence", async () => {
  const { spatial, connection } = await rotaryRuntime("segment-rate-latest");
  const commands = mechanicalCommandRuntimeFor(spatial);
  await commands.step(connection.id, 15 * DEG, "ui", 0.5);
  assert.equal(commands.rate(connection.id).mode, "segment-average");
  await commands.step(connection.id, 15 * DEG, "ui");
  const latest = commands.rate(connection.id);
  assert.equal(latest.mode, "unresolved-no-duration");
  assert.equal(latest.durationSeconds, null);
  assert.equal(latest.averageRpm, null);
});

test("S2.25 rejects tampered persisted rate evidence", async () => {
  const { session, spatial, connection } = await rotaryRuntime("segment-rate-tamper");
  session.events.record({
    id: "event-tampered-rate",
    type: "MechanicalRotaryStepExecuted",
    occurredAt: new Date().toISOString(),
    source: "system",
    payload: {
      commandId: "mechanical-cmd-1",
      relationshipId: connection.id,
      beforeRadians: 0,
      deltaRadians: 15 * DEG,
      afterContinuousRadians: 15 * DEG,
      durationSeconds: 0.5,
      averageAngularVelocityRadPerSec: Math.PI / 6,
      averageRpm: 99
    }
  });
  const commands = mechanicalCommandRuntimeFor(spatial);
  assert.throws(() => commands.rate(connection.id), /RPM evidence mismatch/);
});
