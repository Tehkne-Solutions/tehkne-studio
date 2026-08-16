import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { applyComponentCatalogExtension } from "../../dist/packages/component-library/src/extension.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { advanceRotaryContinuousState, rotaryContinuousState, ROTARY_TAU } from "../../dist/packages/invention-assembly-runtime/src/rotary-continuous-angle.js";
import { mechanicalCommandRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/index.js";
import { InventionSpatialScene, parseInventionSpatialDocument } from "../../dist/packages/invention-spatial-runtime/src/index.js";
import { InventionBuilder, createBlankInventionProject } from "../../dist/packages/invention-runtime/src/index.js";
import { createSessionSnapshot, restoreSessionSnapshot } from "../../dist/packages/persistence-runtime/src/index.js";

const DEG = Math.PI / 180;
function close(actual, expected, epsilon = 1e-7) { assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`); }

async function rotaryRuntime(projectId = "multiturn-test") {
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

test("S2.24 pure continuous state reconciles principal angle with integer revolutions", () => {
  const oneTurn = rotaryContinuousState(0, ROTARY_TAU);
  assert.equal(oneTurn.revolutions, 1);
  close(oneTurn.continuousRadians, ROTARY_TAU);
  const crossed = advanceRotaryContinuousState(350 * DEG, 20 * DEG, 10 * DEG);
  assert.equal(crossed.revolutions, 1);
  close(crossed.continuousRadians, 370 * DEG);
  assert.throws(() => rotaryContinuousState(0, 0.5), /inconsistent with principal evidence/);
});

test("S2.24 twenty-four 15-degree CommandBus steps produce exactly one continuous revolution", async () => {
  const { spatial, connection } = await rotaryRuntime("multiturn-24steps");
  const commands = mechanicalCommandRuntimeFor(spatial);
  for (let index = 0; index < 24; index += 1) {
    const outcome = await commands.step(connection.id, 15 * DEG, "automation");
    assert.equal(outcome.ok, true, outcome.error);
  }
  const state = commands.kinematics(connection.id);
  close(state.principalRadians, 0);
  close(state.continuousRadians, 360 * DEG);
  assert.equal(state.revolutions, 1);
  assert.equal(state.evidenceCommands, 24);
  assert.equal(state.derivedFrom, "session-events+spatial");
});

test("S2.24 principal target commands preserve shortest-path semantics while advancing continuous turns", async () => {
  const { spatial, connection } = await rotaryRuntime("multiturn-targets");
  const commands = mechanicalCommandRuntimeFor(spatial);
  for (let index = 0; index < 24; index += 1) await commands.step(connection.id, 15 * DEG, "ui");
  const to170 = await commands.setTarget(connection.id, 170 * DEG, "voice");
  assert.equal(to170.ok, true, to170.error);
  close(to170.result.deltaRadians, 170 * DEG);
  close(to170.result.afterRadians, 170 * DEG);
  close(to170.result.afterContinuousRadians, 530 * DEG);
  assert.equal(to170.result.afterRevolutions, 1);
  const toMinus170 = await commands.setTarget(connection.id, -170 * DEG, "voice");
  assert.equal(toMinus170.ok, true, toMinus170.error);
  close(toMinus170.result.deltaRadians, 20 * DEG);
  close(toMinus170.result.afterRadians, -170 * DEG);
  close(toMinus170.result.afterContinuousRadians, 550 * DEG);
  assert.equal(toMinus170.result.afterRevolutions, 2);
});

test("S2.24 canonicalizes near-zero principal residue before an exact pi target", async () => {
  const { spatial, connection } = await rotaryRuntime("multiturn-pi-boundary");
  const commands = mechanicalCommandRuntimeFor(spatial);
  for (let index = 0; index < 24; index += 1) await commands.step(connection.id, 15 * DEG, "ui");
  const before = commands.kinematics(connection.id);
  close(before.principalRadians, 0);
  close(before.continuousRadians, 360 * DEG);
  const outcome = await commands.setTarget(connection.id, 180 * DEG, "ui");
  assert.equal(outcome.ok, true, outcome.error);
  close(outcome.result.deltaRadians, Math.PI);
  close(outcome.result.afterContinuousRadians, 540 * DEG);
  assert.equal(outcome.result.afterRevolutions, 1);
});

test("S2.24 restore reconstructs multi-turn state from persisted session events plus spatial evidence without command replay", async () => {
  const { session, builder, spatial, connection } = await rotaryRuntime("multiturn-restore");
  const commands = mechanicalCommandRuntimeFor(spatial);
  for (let index = 0; index < 24; index += 1) await commands.step(connection.id, 15 * DEG, "ui");
  const before = commands.kinematics(connection.id);
  const snapshot = createSessionSnapshot(session, { extensions: { invention: builder.document(), inventionSpatial: spatial.document() } });
  const restoredSession = restoreSessionSnapshot(JSON.parse(JSON.stringify(snapshot)));
  const restoredSpatial = new InventionSpatialScene(restoredSession, parseInventionSpatialDocument(snapshot.extensions.inventionSpatial));
  const restoredCommands = mechanicalCommandRuntimeFor(restoredSpatial);
  const restored = restoredCommands.kinematics(connection.id);
  assert.deepEqual(restored, before);
  const next = await restoredCommands.step(connection.id, 15 * DEG, "automation");
  assert.equal(next.ok, true, next.error);
  assert.equal(next.result.commandId, "mechanical-cmd-25");
  close(next.result.afterContinuousRadians, 375 * DEG);
  assert.equal(next.result.afterRevolutions, 1);
});

test("S2.24 rejects tampered continuous event evidence instead of silently changing revolution count", async () => {
  const { session, spatial, connection } = await rotaryRuntime("multiturn-tamper");
  session.events.record({ id: "event-tampered", type: "MechanicalRotaryStepExecuted", occurredAt: new Date().toISOString(), source: "system", payload: { commandId: "mechanical-cmd-1", relationshipId: connection.id, beforeRadians: 0, deltaRadians: 15 * DEG, afterContinuousRadians: 99 } });
  const commands = mechanicalCommandRuntimeFor(spatial);
  assert.throws(() => commands.kinematics(connection.id), /continuous evidence mismatch/);
});
