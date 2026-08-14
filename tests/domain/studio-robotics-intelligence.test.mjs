import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { StudioIntelligence } from "../../dist/packages/studio-intelligence/src/index.js";
import { Arm01Controller } from "../../dist/packages/studio-robotics/src/index.js";

const sourcePreset = JSON.parse(await readFile(new URL("../../presets/arm-01/project.json", import.meta.url), "utf8"));

function freshPreset() {
  return JSON.parse(JSON.stringify(sourcePreset));
}

test("S1.8 Studio Intelligence resolves 'pegue o cubo vermelho' into the real ARM-01 task executor", async () => {
  const session = new EngineeringSession(freshPreset());
  const arm = new Arm01Controller(session);
  const intelligence = new StudioIntelligence(session, undefined, arm);

  const result = await intelligence.executeUtterance("Pegue o cubo vermelho", { source: "voice" });
  assert.equal(result.executed, true);
  assert.equal(result.resolution.status, "resolved");
  assert.equal(result.resolution.action, "robotTask");
  assert.equal(result.resolution.robotTaskDraft.kind, "pick");
  assert.equal(result.resolution.robotTaskDraft.targetEntityId, "object.cube.red");
  assert.equal(result.robotTask.targetEntityId, "object.cube.red");
  assert.equal(session.getEntity("object.cube.red").state, "held");
  assert.equal(session.events.list("IntentResolved")[0].source, "voice");
  assert.equal(session.events.list("PickTaskCompleted").length, 1);
});

test("S1.8 generic pick remains fail closed when more than one workpiece matches", async () => {
  const preset = freshPreset();
  const red = preset.entities.find((entity) => entity.id === "object.cube.red");
  preset.entities.push({
    ...JSON.parse(JSON.stringify(red)),
    id: "object.cube.blue",
    name: "Blue Cube",
    state: "free",
    properties: {
      ...JSON.parse(JSON.stringify(red.properties)),
      xM: { ...red.properties.xM, value: -0.75 },
      attachedTo: { ...red.properties.attachedTo, value: null }
    },
    metadata: { ...red.metadata, voiceAliases: ["cubo azul", "blue cube"] }
  });

  const session = new EngineeringSession(preset);
  const arm = new Arm01Controller(session);
  const intelligence = new StudioIntelligence(session, undefined, arm);
  const result = await intelligence.executeUtterance("Pegue o cubo");

  assert.equal(result.executed, false);
  assert.equal(result.resolution.status, "ambiguous");
  assert.equal(session.events.list("PickTaskCompleted").length, 0);
});
