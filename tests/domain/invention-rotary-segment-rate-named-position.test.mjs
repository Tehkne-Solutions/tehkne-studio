import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { applyComponentCatalogExtension } from "../../dist/packages/component-library/src/extension.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { mechanicalCommandRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/index.js";
import { mechanicalRotaryNamedPositionsRuntimeFor } from "../../dist/packages/invention-mechanical-command-runtime/src/rotary-named-positions.js";
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

test("S2.29 GO POSITION with explicit duration derives rate from canonical continuous movement and preserves limit precedence", async () => {
  const { session, spatial, connection } = await rotaryRuntime("segment-rate-named-position");
  const commands = mechanicalCommandRuntimeFor(spatial);
  const positions = mechanicalRotaryNamedPositionsRuntimeFor(spatial);

  assert.equal((await commands.setContinuousTarget(connection.id, 360 * DEG, "ui")).ok, true);
  assert.equal((await positions.savePosition(connection.id, "Inspect", "ui")).ok, true);
  assert.equal(commands.rate(connection.id).mode, "unresolved-no-duration");
  assert.equal((await commands.setContinuousTarget(connection.id, 180 * DEG, "ui")).ok, true);

  const eventsBefore = session.events.list().length;
  const returned = await positions.goToPosition(connection.id, "Inspect", "automation", 6);
  assert.equal(returned.ok, true, returned.error);
  assert.ok(returned.result);
  close(returned.result.deltaRadians, 180 * DEG);
  close(returned.result.averageAngularVelocityRadPerSec, Math.PI / 6);
  close(returned.result.averageRpm, 5);
  assert.equal(returned.result.durationSeconds, 6);
  assert.equal(returned.result.rateMode, "segment-average");

  const rate = commands.rate(connection.id);
  assert.equal(rate.mode, "segment-average");
  assert.equal(rate.commandId, returned.result.commandId, "GO POSITION rate must come from canonical movement command");
  close(rate.averageRpm, 5);
  assert.equal(session.events.list().length, eventsBefore + 2, "GO POSITION adds one movement event and one request audit event");
  const request = session.events.list().at(-1);
  assert.equal(request?.type, "MechanicalRotaryNamedPositionRequested");
  assert.equal(request?.payload?.movementCommandId, rate.commandId);
  assert.equal(request?.payload?.durationSeconds, 6);
  assert.equal(request?.payload?.rateMode, "segment-average");

  assert.equal((await positions.savePosition(connection.id, "Park", "ui")).ok, true);
  assert.equal(commands.rate(connection.id).commandId, rate.commandId, "bookmark authoring must not replace movement rate");
  assert.equal((await positions.deletePosition(connection.id, "Park", "ui")).ok, true);
  assert.equal(commands.rate(connection.id).commandId, rate.commandId, "bookmark deletion must not replace movement rate");

  assert.equal((await commands.setContinuousTarget(connection.id, 180 * DEG, "ui")).ok, true);
  assert.equal((await commands.setTravelLimits(connection.id, -90 * DEG, 270 * DEG, "ui")).ok, true);
  const rateBeforeBlocked = commands.rate(connection.id);
  const spatialBeforeBlocked = spatial.document();
  const eventCountBeforeBlocked = session.events.list().length;
  const blocked = await positions.goToPosition(connection.id, "Inspect", "voice", 1);
  assert.equal(blocked.ok, false);
  assert.match(blocked.error ?? "", /travel limit exceeded/);
  assert.deepEqual(spatial.document(), spatialBeforeBlocked, "blocked timed GO POSITION must not mutate inventionSpatial");
  assert.equal(session.events.list().length, eventCountBeforeBlocked, "blocked timed GO POSITION must not publish movement or request evidence");
  assert.deepEqual(commands.rate(connection.id), rateBeforeBlocked, "blocked timed GO POSITION must not replace latest valid movement rate");
});
