import test from "node:test";
import assert from "node:assert/strict";
import {
  forwardKinematics,
  planPickMotion,
  solveArmIk
} from "../../dist/packages/robotics-runtime/src/index.js";

const geometry = { baseHeight: 0.35, upperArmLength: 1.15, forearmLength: 0.95 };
const limits = {
  baseYaw: { minDeg: -170, maxDeg: 170 },
  shoulder: { minDeg: -60, maxDeg: 110 },
  elbow: { minDeg: 0, maxDeg: 145 }
};

test("S1.8 IK solves a reachable 3D target and forward kinematics returns the same point", () => {
  const target = { x: 0.9, y: 0.42, z: 0.65 };
  const result = solveArmIk(geometry, limits, target);
  assert.equal(result.status, "solved");
  assert.ok(result.pose);
  const reached = forwardKinematics(geometry, result.pose);
  assert.ok(Math.abs(reached.x - target.x) < 1e-9);
  assert.ok(Math.abs(reached.y - target.y) < 1e-9);
  assert.ok(Math.abs(reached.z - target.z) < 1e-9);
});

test("S1.8 pick planner produces approach, grasp, close and lift inside joint limits", () => {
  const plan = planPickMotion(geometry, limits, { x: 0.9, y: 0.42, z: 0.65 });
  assert.equal(plan.status, "ready");
  assert.deepEqual(plan.waypoints.map((waypoint) => waypoint.id), ["approach", "grasp", "close", "lift"]);
  for (const waypoint of plan.waypoints) {
    assert.ok(waypoint.pose.baseYawDeg >= limits.baseYaw.minDeg && waypoint.pose.baseYawDeg <= limits.baseYaw.maxDeg);
    assert.ok(waypoint.pose.shoulderDeg >= limits.shoulder.minDeg && waypoint.pose.shoulderDeg <= limits.shoulder.maxDeg);
    assert.ok(waypoint.pose.elbowDeg >= limits.elbow.minDeg && waypoint.pose.elbowDeg <= limits.elbow.maxDeg);
  }
  assert.equal(plan.waypoints[2].gripperOpeningMm, 28);
  assert.ok(plan.waypoints[3].target.y > plan.waypoints[2].target.y);
});

test("S1.8 unreachable targets remain fail closed", () => {
  const result = solveArmIk(geometry, limits, { x: 4, y: 2, z: 4 });
  assert.equal(result.status, "unreachable");
  const plan = planPickMotion(geometry, limits, { x: 4, y: 2, z: 4 });
  assert.equal(plan.status, "blocked");
  assert.match(plan.reason, /outside arm reach/);
});
