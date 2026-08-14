import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { StudioBehaviorController } from "../../dist/packages/studio-behavior/src/index.js";
import { StudioIntelligence } from "../../dist/packages/studio-intelligence/src/index.js";

const preset = JSON.parse(await readFile(new URL("../../presets/desktop-pc/project.json", import.meta.url), "utf8"));

function createSystem() {
  const session = new EngineeringSession(preset);
  const behavior = new StudioBehaviorController(session);
  const intelligence = new StudioIntelligence(session, behavior);
  return { session, behavior, intelligence };
}

test("S1.7 Studio Intelligence materializes a natural-language threshold rule as Behavior IR", async () => {
  const { session, behavior, intelligence } = createSystem();
  const result = await intelligence.executeUtterance(
    "Quando a CPU passar de 70 graus, coloque a ventoinha no máximo"
  );

  assert.equal(result.executed, true);
  assert.equal(result.resolution.status, "resolved");
  assert.equal(result.resolution.action, "behavior");
  assert.equal(result.behavior.name, "CPU > 70°C → Fan 100%");
  assert.equal(behavior.behaviors().length, 1);
  assert.equal(behavior.behaviors()[0].condition.threshold, 70);
  assert.equal(behavior.behaviors()[0].action.targetEntityId, "pc.cooling");
  assert.equal(session.events.list("BehaviorRegistered").length, 1);
});

test("S1.7 telemetry crosses threshold, triggers fan actuation, then thermal model cools the CPU", async () => {
  const { session, behavior, intelligence } = createSystem();
  await intelligence.executeUtterance(
    "Quando a CPU passar de 70 graus, coloque a ventoinha no máximo"
  );

  const below = await behavior.ingestTelemetry("pc.cpu", "temperatureC", 68);
  assert.equal(below.evaluations[0].status, "not_triggered");
  assert.equal(session.getEntity("pc.cooling").properties.fanPercent.value, 35);

  const hot = await behavior.ingestTelemetry("pc.cpu", "temperatureC", 76);
  assert.equal(hot.evaluations[0].status, "triggered");
  assert.equal(hot.executions.length, 1);
  assert.equal(session.getEntity("pc.cooling").properties.fanPercent.value, 100);
  assert.equal(session.events.list("BehaviorTriggered").length, 1);
  assert.equal(session.events.list("FanSpeedChanged").length, 1);

  const thermal = await behavior.simulateCpuThermalStep();
  assert.ok(thermal.nextTemperatureC < thermal.previousTemperatureC);
  assert.equal(session.getEntity("pc.cpu").properties.temperatureC.value, thermal.nextTemperatureC);
});

test("S1.7 malformed behavior requests remain fail closed and do not register automation", async () => {
  const { behavior, intelligence } = createSystem();
  const result = await intelligence.executeUtterance(
    "Quando a CPU esquentar, coloque a ventoinha no máximo"
  );
  assert.equal(result.executed, false);
  assert.equal(result.resolution.status, "unresolved");
  assert.equal(behavior.behaviors().length, 0);
});
