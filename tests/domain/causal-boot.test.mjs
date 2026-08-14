import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";

const preset = JSON.parse(await readFile(new URL("../../presets/desktop-pc/project.json", import.meta.url), "utf8"));

test("S1.5 removing RAM causes power-on to fail at memory check", async () => {
  const session = new EngineeringSession(preset);
  const removed = await session.executeCapability("pc.ram.01", "remove");
  assert.equal(removed.ok, true);

  const power = await session.executeCapability("pc.root", "powerOn");
  assert.equal(power.ok, true);
  assert.equal(power.result.bootRun.status, "failure");
  assert.equal(power.result.bootRun.fault.entityId, "pc.ram.01");
  assert.equal(power.result.bootRun.fault.stage, "MEMORY_CHECK");
  assert.equal(session.getEntity("pc.root").properties.powerState.value, "fault");
  assert.equal(session.getEntity("pc.boot").state, "fault");
  assert.equal(session.getEntity("pc.boot").properties.faultCode.value, "MEMORY_UNAVAILABLE");
  assert.equal(session.events.list("BootFailed").length, 1);
});

test("S1.5 why traces the boot failure through the Engineering Graph", async () => {
  const session = new EngineeringSession(preset);
  await session.executeCapability("pc.ram.01", "remove");
  await session.executeCapability("pc.root", "powerOn");

  const why = await session.executeCapability("pc.boot", "why");
  assert.equal(why.ok, true);
  assert.equal(why.result.changed, false);
  assert.match(why.result.explanation, /RAM Module A/);
  assert.match(why.result.explanation, /memory initialization/);
  assert.equal(why.result.causalTrace.length, 3);
  assert.equal(why.result.causalTrace[1].entityId, "pc.ram.01");
  assert.equal(session.events.list("CausalityExplained").length, 1);
});

test("S1.5 reinstalling RAM restores the same system and boot reaches RUNNING", async () => {
  const session = new EngineeringSession(preset);
  await session.executeCapability("pc.ram.01", "remove");
  await session.executeCapability("pc.root", "powerOn");

  const inserted = await session.executeCapability("pc.ram.01", "insert");
  assert.equal(inserted.ok, true);
  assert.equal(session.getEntity("pc.ram.01").state, "connected");
  assert.equal(session.getEntity("pc.ram.01").properties.connected.value, true);
  assert.equal(session.getEntity("pc.ram.01").ports["memory-bus"].state, "connected");

  const secondPower = await session.executeCapability("pc.root", "powerOn");
  assert.equal(secondPower.ok, true);
  assert.equal(secondPower.result.bootRun.status, "success");
  assert.equal(secondPower.result.bootRun.finalStage, "RUNNING");
  assert.equal(session.getEntity("pc.root").properties.powerState.value, "on");
  assert.equal(session.getEntity("pc.boot").state, "running");
  assert.equal(session.getEntity("pc.boot").properties.faultEntityId.value, null);
  assert.equal(session.events.list("BootSucceeded").length, 1);
  assert.equal(session.events.list("EntityInserted").length, 1);
});
