import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { Arm01Controller } from "../../dist/packages/studio-robotics/src/index.js";

const sourcePreset = JSON.parse(await readFile(new URL("../../presets/arm-01/project.json", import.meta.url), "utf8"));

function freshPreset() {
  return JSON.parse(JSON.stringify(sourcePreset));
}

test("S1.8 ARM-01 executes a deterministic pick and attaches the workpiece to the gripper", () => {
  const session = new EngineeringSession(freshPreset());
  const arm = new Arm01Controller(session);
  const summary = arm.executePick("object.cube.red");

  assert.equal(summary.waypointCount, 4);
  assert.equal(summary.attachedTo, "arm.gripper");
  assert.equal(session.getEntity("object.cube.red").state, "held");
  assert.equal(session.getEntity("object.cube.red").properties.attachedTo.value, "arm.gripper");
  assert.equal(session.getEntity("arm.gripper").properties.holdingEntityId.value, "object.cube.red");
  assert.equal(session.getEntity("arm.root").properties.taskState.value, "holding");
  assert.equal(session.getEntity("arm.controller").properties.motionState.value, "completed");

  const attachment = session.graph.snapshot().relationships.find(
    (relationship) => relationship.source === "object.cube.red" && relationship.type === "attachedTo"
  );
  assert.equal(attachment?.target, "arm.gripper");
  assert.equal(session.events.list("MotionPlanCreated").length, 1);
  assert.equal(session.events.list("MotionWaypointReached").length, 4);
  assert.equal(session.events.list("JointTargetChanged").length, 12);
  assert.equal(session.events.list("ObjectAttached").length, 1);
  assert.equal(session.events.list("PickTaskCompleted").length, 1);
});

test("S1.8 ARM-01 final object position follows forward kinematics after lift", () => {
  const session = new EngineeringSession(freshPreset());
  const arm = new Arm01Controller(session);
  const summary = arm.executePick("object.cube.red");
  const cube = session.getEntity("object.cube.red");

  assert.ok(Math.abs(cube.properties.xM.value - summary.finalPosition.x) < 1e-9);
  assert.ok(Math.abs(cube.properties.yM.value - summary.finalPosition.y) < 1e-9);
  assert.ok(Math.abs(cube.properties.zM.value - summary.finalPosition.z) < 1e-9);
  assert.ok(cube.properties.yM.value > 0.42);
});

test("S1.8 payload validation blocks pickup before any attachment is created", () => {
  const preset = freshPreset();
  const cube = preset.entities.find((entity) => entity.id === "object.cube.red");
  cube.properties.massKg.value = 3;
  const session = new EngineeringSession(preset);
  const arm = new Arm01Controller(session);

  assert.throws(() => arm.executePick("object.cube.red"), /exceeds ARM-01 payload/);
  assert.equal(session.getEntity("object.cube.red").state, "free");
  assert.equal(session.events.list("ObjectAttached").length, 0);
});
