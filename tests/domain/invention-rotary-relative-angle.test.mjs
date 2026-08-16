import test from "node:test";
import assert from "node:assert/strict";
import { rotaryJointRelativeAngle, normalizePrincipalAngle } from "../../dist/packages/invention-assembly-runtime/src/rotary-relative-angle.js";
import { planMechanicalAssemblyRotation, planMechanicalRotaryJointStep } from "../../dist/packages/invention-assembly-runtime/src/index.js";

const STEP = Math.PI / 12;
const Z = { x: 0, y: 0, z: 1 };

function assertClose(actual, expected, epsilon = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

test("S2.20 derives zero and signed principal rotary angle from aligned driver/follower transforms without joint state", () => {
  assertClose(rotaryJointRelativeAngle(Z, Z, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), 0);
  assertClose(rotaryJointRelativeAngle(Z, Z, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: STEP }), STEP);
  assertClose(rotaryJointRelativeAngle(Z, Z, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -STEP }), -STEP);
  assertClose(normalizePrincipalAngle(Math.PI * 1.5), -Math.PI / 2);
});

test("S2.20 relative angle remains invariant when S2.17 rigid rotation is composed after S2.19 follower-only spin", () => {
  const motor = { entityId: "motor-1", position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
  const wheel = { entityId: "wheel-1", position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
  const first = planMechanicalRotaryJointStep(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    Z,
    Z,
    motor,
    wheel,
    STEP
  );
  const spunWheel = { ...wheel, position: first.toPosition, rotation: first.toRotation };
  assertClose(rotaryJointRelativeAngle(Z, Z, motor.rotation, spunWheel.rotation), STEP);

  const rigid = planMechanicalAssemblyRotation([motor, spunWheel], ["motor-1", "wheel-1"], "motor-1", "y", STEP);
  const rigidMotor = rigid.find((entry) => entry.entityId === "motor-1");
  const rigidWheel = rigid.find((entry) => entry.entityId === "wheel-1");
  assert.ok(rigidMotor && rigidWheel);
  assertClose(rotaryJointRelativeAngle(Z, Z, rigidMotor.toRotation, rigidWheel.toRotation), STEP);
});

test("S2.20 relative angle accumulates geometrically across S2.19 manual steps inside the principal interval", () => {
  const driver = { entityId: "motor-1", position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
  let follower = { entityId: "wheel-1", position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
  for (let index = 0; index < 2; index += 1) {
    const plan = planMechanicalRotaryJointStep({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, Z, Z, driver, follower, STEP);
    follower = { ...follower, position: plan.toPosition, rotation: plan.toRotation };
  }
  assertClose(rotaryJointRelativeAngle(Z, Z, driver.rotation, follower.rotation), STEP * 2);
});

test("S2.20 relative angle remains fail closed for non-aligned axes and invalid input instead of inventing an angle", () => {
  assert.throws(() => rotaryJointRelativeAngle(Z, Z, { x: 0, y: 0, z: 0 }, { x: 0, y: Math.PI / 2, z: 0 }), /requires aligned shaft axes/);
  assert.throws(() => normalizePrincipalAngle(Number.NaN), /must be finite/);
  assert.throws(() => rotaryJointRelativeAngle({ x: 0, y: 0, z: 0 }, Z, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), /must be non-zero/);
});
