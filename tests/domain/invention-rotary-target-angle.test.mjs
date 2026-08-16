import test from "node:test";
import assert from "node:assert/strict";
import { rotaryJointRelativeAngle, rotaryJointTargetDelta } from "../../dist/packages/invention-assembly-runtime/src/rotary-relative-angle.js";
import { planMechanicalAssemblyRotation, planMechanicalRotaryJointStep } from "../../dist/packages/invention-assembly-runtime/src/index.js";

const Z = { x: 0, y: 0, z: 1 };
const ORIGIN = { x: 0, y: 0, z: 0 };
const SCALE = { x: 1, y: 1, z: 1 };
const DEG = Math.PI / 180;

function assertClose(actual, expected, epsilon = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

test("S2.21 target delta resolves an absolute principal angle without storing joint state", () => {
  const target = rotaryJointTargetDelta(Z, Z, ORIGIN, ORIGIN, 90 * DEG);
  assertClose(target.currentRadians, 0);
  assertClose(target.targetRadians, 90 * DEG);
  assertClose(target.deltaRadians, 90 * DEG);
  assert.equal(target.mode, "principal-shortest");
});

test("S2.21 target delta takes the shortest signed path across the principal wrap", () => {
  const target = rotaryJointTargetDelta(Z, Z, ORIGIN, { x: 0, y: 0, z: 170 * DEG }, -170 * DEG);
  assertClose(target.currentRadians, 170 * DEG);
  assertClose(target.targetRadians, -170 * DEG);
  assertClose(target.deltaRadians, 20 * DEG);

  const reverse = rotaryJointTargetDelta(Z, Z, ORIGIN, { x: 0, y: 0, z: -170 * DEG }, 170 * DEG);
  assertClose(reverse.deltaRadians, -20 * DEG);
});

test("S2.21 target delta composes through the existing S2.19 follower-only planner and keeps the driver immutable", () => {
  const driver = { entityId: "motor-1", position: ORIGIN, rotation: ORIGIN, scale: SCALE };
  const follower = { entityId: "wheel-1", position: ORIGIN, rotation: ORIGIN, scale: SCALE };
  const target = rotaryJointTargetDelta(Z, Z, driver.rotation, follower.rotation, -45 * DEG);
  const plan = planMechanicalRotaryJointStep(ORIGIN, ORIGIN, Z, Z, driver, follower, target.deltaRadians);

  assert.deepEqual(driver.rotation, ORIGIN, "target planning must never mutate the driver");
  assertClose(rotaryJointRelativeAngle(Z, Z, driver.rotation, plan.toRotation), -45 * DEG);
});

test("S2.21 absolute target survives rigid assembly rotation because the angle remains transform-derived", () => {
  const driver = { entityId: "motor-1", position: ORIGIN, rotation: ORIGIN, scale: SCALE };
  const follower = { entityId: "wheel-1", position: ORIGIN, rotation: ORIGIN, scale: SCALE };
  const target = rotaryJointTargetDelta(Z, Z, driver.rotation, follower.rotation, 60 * DEG);
  const spin = planMechanicalRotaryJointStep(ORIGIN, ORIGIN, Z, Z, driver, follower, target.deltaRadians);
  const spunFollower = { ...follower, position: spin.toPosition, rotation: spin.toRotation };
  const rigid = planMechanicalAssemblyRotation([driver, spunFollower], ["motor-1", "wheel-1"], "motor-1", "y", 15 * DEG);
  const rigidDriver = rigid.find((entry) => entry.entityId === "motor-1");
  const rigidFollower = rigid.find((entry) => entry.entityId === "wheel-1");
  assert.ok(rigidDriver && rigidFollower);
  assertClose(rotaryJointRelativeAngle(Z, Z, rigidDriver.toRotation, rigidFollower.toRotation), 60 * DEG);
});

test("S2.21 target delta remains fail closed for invalid targets and non-aligned shafts", () => {
  assert.throws(() => rotaryJointTargetDelta(Z, Z, ORIGIN, ORIGIN, Number.NaN), /target angle must be finite/);
  assert.throws(() => rotaryJointTargetDelta(Z, Z, ORIGIN, { x: 0, y: Math.PI / 2, z: 0 }, 0), /requires aligned shaft axes/);
});
