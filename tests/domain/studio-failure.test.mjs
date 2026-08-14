import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { ArmFailureLab } from "../../dist/packages/studio-failure/src/index.js";

const sourcePreset = JSON.parse(await readFile(new URL("../../presets/arm-01/project.json", import.meta.url), "utf8"));
const envelope = JSON.parse(await readFile(new URL("../../presets/arm-01/failure-profile.json", import.meta.url), "utf8"));

function freshPreset() {
  return JSON.parse(JSON.stringify(sourcePreset));
}

test("S1.9 Failure Lab records simulated torque, current, temperature and margin on the Engineering Entity", () => {
  const session = new EngineeringSession(freshPreset());
  const lab = new ArmFailureLab(session, envelope);
  const record = lab.run(1.25);
  const robot = session.getEntity("arm.root");

  assert.equal(record.assessment.status, "warning");
  assert.equal(robot.state, "degraded");
  assert.equal(session.getEntity("arm.controller").properties.motionState.value, "limited");
  assert.equal(robot.properties.requiredTorqueNm.source, "simulated");
  assert.equal(robot.properties.motorCurrentA.source, "simulated");
  assert.equal(robot.properties.motorTemperatureC.source, "simulated");
  assert.equal(session.events.list("FailureRiskObserved").length, 1);
});

test("S1.9 critical payload creates a fail-closed machine state before pickup", () => {
  const session = new EngineeringSession(freshPreset());
  const lab = new ArmFailureLab(session, envelope);
  const record = lab.run(1.6);

  assert.equal(record.assessment.status, "fault");
  assert.equal(session.getEntity("arm.root").state, "fault");
  assert.equal(session.getEntity("arm.controller").state, "fault");
  assert.equal(session.getEntity("arm.controller").properties.motionState.value, "blocked");
  assert.equal(session.getEntity("object.cube.red").state, "free");
  assert.equal(session.events.list("FailureDetected").length, 1);
  assert.equal(session.events.list("ObjectAttached").length, 0);
});

test("S1.9 Failure Lab explains the last result from recorded engineering evidence", () => {
  const session = new EngineeringSession(freshPreset());
  const lab = new ArmFailureLab(session, envelope);
  lab.run(1.6);
  const explanation = lab.explainLatest();

  assert.match(explanation.message, /falhou porque/i);
  assert.equal(explanation.trace.length, 6);
  assert.equal(explanation.trace[0].id, "payload");
  assert.equal(explanation.trace.at(-1).id, "margin");
  assert.equal(session.events.list("FailureCausalityExplained").length, 1);
});
