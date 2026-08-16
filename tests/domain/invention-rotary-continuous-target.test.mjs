import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { applyComponentCatalogExtension } from "../../dist/packages/component-library/src/extension.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { rotaryContinuousTargetDelta } from "../../dist/packages/invention-assembly-runtime/src/rotary-continuous-angle.js";
import {
  MECHANICAL_ROTARY_CONTINUOUS_TARGET_COMMAND,
  mechanicalCommandRuntimeFor
} from "../../dist/packages/invention-mechanical-command-runtime/src/index.js";
import { InventionSpatialScene, parseInventionSpatialDocument } from "../../dist/packages/invention-spatial-runtime/src/index.js";
import { InventionBuilder, createBlankInventionProject } from "../../dist/packages/invention-runtime/src/index.js";
import { createSessionSnapshot, restoreSessionSnapshot } from "../../dist/packages/persistence-runtime/src/index.js";

const DEG = Math.PI / 180;
function close(actual, expected, epsilon = 1e-7) { assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`); }

async function runtime(projectId = "continuous-target-test") {
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

test("S2.25 pure continuous target delta preserves requested multi-turn absolute angle", () => {
  const twoTurns = rotaryContinuousTargetDelta(0, 720 * DEG);
  close(twoTurns.currentContinuousRadians, 0);
  close(twoTurns.targetContinuousRadians, 720 * DEG);
  close(twoTurns.targetPrincipalRadians, 0);
  assert.equal(twoTurns.targetRevolutions, 2);
  close(twoTurns.deltaRadians, 720 * DEG);
  assert.equal(twoTurns.mode, "continuous-absolute");

  const reverse = rotaryContinuousTargetDelta(720 * DEG, -450 * DEG);
  close(reverse.targetContinuousRadians, -450 * DEG);
  close(reverse.targetPrincipalRadians, -90 * DEG);
  assert.equal(reverse.targetRevolutions, -1);
  close(reverse.deltaRadians, -1170 * DEG);
  assert.throws(() => rotaryContinuousTargetDelta(0, Number.POSITIVE_INFINITY), /must be finite/);
});

test("S2.25 voice and automation continuous targets use the same session CommandBus and exact turn evidence", async () => {
  const { session, spatial, motor, connection } = await runtime("continuous-target-commandbus");
  const commands = mechanicalCommandRuntimeFor(spatial);
  const driverBefore = structuredClone(spatial.binding(motor.id));

  const first = await commands.setContinuousTarget(connection.id, 720 * DEG, "voice");
  assert.equal(first.ok, true, first.error);
  assert.ok(first.result);
  assert.equal(first.result.commandId, "mechanical-cmd-1");
  assert.equal(first.result.source, "voice");
  assert.equal(first.result.mode, "continuous-absolute");
  close(first.result.deltaRadians, 720 * DEG);
  close(first.result.afterRadians, 0);
  close(first.result.afterContinuousRadians, 720 * DEG);
  assert.equal(first.result.afterRevolutions, 2);
  assert.deepEqual(spatial.binding(motor.id), driverBefore, "continuous target must keep the driver immutable");

  const second = await commands.setContinuousTarget(connection.id, -450 * DEG, "automation");
  assert.equal(second.ok, true, second.error);
  assert.ok(second.result);
  assert.equal(second.result.commandId, "mechanical-cmd-2");
  assert.equal(second.result.source, "automation");
  assert.equal(second.result.mode, "continuous-absolute");
  close(second.result.deltaRadians, -1170 * DEG);
  close(second.result.afterRadians, -90 * DEG);
  close(second.result.afterContinuousRadians, -450 * DEG);
  assert.equal(second.result.afterRevolutions, -1);

  const state = commands.kinematics(connection.id);
  close(state.principalRadians, -90 * DEG);
  close(state.continuousRadians, -450 * DEG);
  assert.equal(state.revolutions, -1);
  assert.equal(state.evidenceCommands, 2);
  const events = session.events.list();
  assert.equal(events.at(-2)?.type, "MechanicalRotaryContinuousTargetExecuted");
  assert.equal(events.at(-2)?.source, "voice");
  assert.equal(events.at(-1)?.type, "MechanicalRotaryContinuousTargetExecuted");
  assert.equal(events.at(-1)?.source, "automation");
});

test("S2.25 restore preserves continuous target evidence without replay and resumes command IDs", async () => {
  const { session, builder, spatial, connection } = await runtime("continuous-target-restore");
  const commands = mechanicalCommandRuntimeFor(spatial);
  const first = await commands.setContinuousTarget(connection.id, 720 * DEG, "ui");
  assert.equal(first.ok, true, first.error);
  const before = commands.kinematics(connection.id);
  const snapshot = createSessionSnapshot(session, { extensions: { invention: builder.document(), inventionSpatial: spatial.document() } });

  const restoredSession = restoreSessionSnapshot(JSON.parse(JSON.stringify(snapshot)));
  const restoredSpatial = new InventionSpatialScene(restoredSession, parseInventionSpatialDocument(snapshot.extensions.inventionSpatial));
  const restoredCommands = mechanicalCommandRuntimeFor(restoredSpatial);
  assert.deepEqual(restoredCommands.kinematics(connection.id), before);
  assert.equal(restoredSession.events.list().length, snapshot.events.length, "restore must not replay the continuous target command");

  const next = await restoredCommands.setContinuousTarget(connection.id, 810 * DEG, "automation");
  assert.equal(next.ok, true, next.error);
  assert.ok(next.result);
  assert.equal(next.result.commandId, "mechanical-cmd-2");
  close(next.result.deltaRadians, 90 * DEG);
  close(next.result.afterRadians, 90 * DEG);
  close(next.result.afterContinuousRadians, 810 * DEG);
  assert.equal(next.result.afterRevolutions, 2);
});

test("S2.25 continuous target remains fail closed for non-rotary relationships without false evidence", async () => {
  const base = parseComponentCatalog(JSON.parse(await readFile("library/components/catalog.json", "utf8")));
  const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
  const mechanical = JSON.parse(await readFile("library/components/extensions/mechanical-assembly-v1.json", "utf8"));
  const registry = new ComponentRegistry(applyComponentCatalogExtension(applyComponentCatalogExtension(base, assetForge), mechanical));
  const session = new EngineeringSession(createBlankInventionProject("continuous-target-fail-closed"));
  const builder = new InventionBuilder(session, registry);
  const spatial = new InventionSpatialScene(session);
  const battery = builder.addComponent("energy.battery.lithium-ion-v1");
  const motor = builder.addComponent("actuation.motor.dc-brushed-v1");
  spatial.ensureComponent(battery.id);
  spatial.ensureComponent(motor.id);
  const electrical = builder.connect({ entityId: battery.id, portId: "dc-output" }, { entityId: motor.id, portId: "power-pos" });
  const before = spatial.document();
  const eventCount = session.events.list().length;
  const commands = mechanicalCommandRuntimeFor(spatial);
  const outcome = await commands.setContinuousTarget(electrical.id, 720 * DEG, "voice");
  assert.equal(outcome.ok, false);
  assert.match(outcome.error ?? "", /rotary-shaft axial constraint/);
  assert.deepEqual(spatial.document(), before);
  assert.equal(session.events.list().length, eventCount);
  assert.equal(MECHANICAL_ROTARY_CONTINUOUS_TARGET_COMMAND, "invention.mechanical.rotary.setContinuousTarget");
});
