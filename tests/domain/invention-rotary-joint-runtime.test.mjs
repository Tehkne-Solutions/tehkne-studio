import test from "node:test";
import assert from "node:assert/strict";
import {
  mechanicalAxesAreAligned,
  mechanicalWorldAxis,
  planMechanicalAssemblyRotation,
  planMechanicalRotaryJointStep
} from "../../dist/packages/invention-assembly-runtime/src/index.js";

const STEP = Math.PI / 12;

function assertClose(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

function assertVectorClose(actual, expected, epsilon = 1e-9) {
  assertClose(actual.x, expected.x, epsilon);
  assertClose(actual.y, expected.y, epsilon);
  assertClose(actual.z, expected.z, epsilon);
}

test("S2.19 rotary joint step spins only the follower around the aligned shaft while preserving the physical endpoint", () => {
  const driverEndpoint = { x: 0.1, y: 0.02, z: 0.07185 };
  const driver = {
    entityId: "motor-1",
    position: { x: 0.1, y: 0.02, z: 0.04 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  };
  const followerEndpointLocal = { x: 0.01, y: 0, z: 0 };
  const follower = {
    entityId: "wheel-1",
    position: { x: 0.09, y: 0.02, z: 0.07185 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  };
  const driverBefore = structuredClone(driver);
  const followerBefore = structuredClone(follower);

  const plan = planMechanicalRotaryJointStep(
    driverEndpoint,
    followerEndpointLocal,
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: 1 },
    driver,
    follower,
    STEP
  );

  assert.equal(plan.entityId, "wheel-1");
  assertClose(plan.toRotation.z, STEP, 1e-8);
  assertVectorClose(plan.axisWorld, { x: 0, y: 0, z: 1 });
  assertVectorClose(plan.toPosition, {
    x: driverEndpoint.x - Math.cos(STEP) * 0.01,
    y: driverEndpoint.y - Math.sin(STEP) * 0.01,
    z: driverEndpoint.z
  }, 1e-8);
  const endpointAfter = {
    x: plan.toPosition.x + Math.cos(STEP) * 0.01,
    y: plan.toPosition.y + Math.sin(STEP) * 0.01,
    z: plan.toPosition.z
  };
  assertVectorClose(endpointAfter, driverEndpoint, 1e-8);
  assert.deepEqual(driver, driverBefore, "rotary planner must never mutate the driver");
  assert.deepEqual(follower, followerBefore, "rotary planner must never mutate the follower input");
});

test("S2.19 rotary joint remains fail closed until coincidence and axial alignment are already established", () => {
  const driver = { entityId: "motor-1", position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
  const separated = { entityId: "wheel-1", position: { x: 0.1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
  assert.throws(() => planMechanicalRotaryJointStep(
    { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 },
    driver, separated, STEP
  ), /requires coincident endpoints/);

  const misaligned = { entityId: "wheel-1", position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: Math.PI / 2, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
  assert.throws(() => planMechanicalRotaryJointStep(
    { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 },
    driver, misaligned, STEP
  ), /requires aligned shaft axes/);
});

test("S2.19 rotary joint plan is bounded and rejects non-finite steps before spatial mutation", () => {
  const driver = { entityId: "motor-1", position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
  const follower = { entityId: "wheel-1", position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
  assert.throws(() => planMechanicalRotaryJointStep(
    { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 },
    driver, follower, Number.NaN
  ), /radians must be finite/);
  assert.throws(() => planMechanicalRotaryJointStep(
    { x: 99, y: 0, z: 0 }, { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 1 },
    driver, { ...follower, position: { x: 99, y: 0, z: 0 } }, STEP
  ), /outside invention workspace bounds/);
});

test("S2.19 relative follower spin survives S2.17 rigid assembly rotation without losing S2.18 axial alignment", () => {
  const motor = { entityId: "motor-1", position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
  const wheel = { entityId: "wheel-1", position: { x: 0, y: 0, z: 0.03185 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
  const joint = planMechanicalRotaryJointStep(
    wheel.position,
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: 1 },
    motor,
    wheel,
    STEP
  );
  const spunWheel = { ...wheel, position: joint.toPosition, rotation: joint.toRotation };
  const rigid = planMechanicalAssemblyRotation([motor, spunWheel], ["motor-1", "wheel-1"], "motor-1", "y", STEP);
  const rigidMotor = rigid.find((entry) => entry.entityId === "motor-1");
  const rigidWheel = rigid.find((entry) => entry.entityId === "wheel-1");
  assert.ok(rigidMotor && rigidWheel);
  const motorAxis = mechanicalWorldAxis({ x: 0, y: 0, z: 1 }, rigidMotor.toRotation);
  const wheelAxis = mechanicalWorldAxis({ x: 0, y: 0, z: 1 }, rigidWheel.toRotation);
  assert.equal(mechanicalAxesAreAligned(motorAxis, wheelAxis), true);
  assertClose(rigidMotor.toRotation.y, STEP, 1e-8);
  assertClose(rigidMotor.toRotation.z, 0, 1e-8);
  assertClose(rigidWheel.toRotation.y, STEP, 1e-8);
  assertClose(rigidWheel.toRotation.z, STEP, 1e-8);
});
