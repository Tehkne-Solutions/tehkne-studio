import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceRotaryRevolutionCount,
  rotaryJointUnwrappedAngle
} from "../../dist/packages/invention-assembly-runtime/src/rotary-multiturn.js";

const STEP = Math.PI / 12;

function assertClose(actual, expected, epsilon = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

test("S2.21 increments and decrements explicit revolution count only when principal angle wraps", () => {
  assert.equal(advanceRotaryRevolutionCount(0, Math.PI, -Math.PI + STEP, STEP), 1);
  assert.equal(advanceRotaryRevolutionCount(0, -Math.PI, Math.PI - STEP, -STEP), -1);
  assert.equal(advanceRotaryRevolutionCount(2, 0, STEP, STEP), 2);
  assert.equal(advanceRotaryRevolutionCount(-2, 0, -STEP, -STEP), -2);
});

test("S2.21 composes principal S2.20 evidence with explicit revolutions into an unwrapped angle", () => {
  assertClose(rotaryJointUnwrappedAngle(0, 1), Math.PI * 2);
  assertClose(rotaryJointUnwrappedAngle(STEP * 2, 1), Math.PI * 2 + STEP * 2);
  assertClose(rotaryJointUnwrappedAngle(-STEP, 1), Math.PI * 2 - STEP);
  assertClose(rotaryJointUnwrappedAngle(STEP, -1), -Math.PI * 2 + STEP);
});

test("S2.21 follows a complete positive and negative revolution without losing historical turns", () => {
  let positivePrincipal = 0;
  let positiveTurns = 0;
  for (let index = 0; index < 24; index += 1) {
    const next = Math.atan2(Math.sin(positivePrincipal + STEP), Math.cos(positivePrincipal + STEP));
    positiveTurns = advanceRotaryRevolutionCount(positiveTurns, positivePrincipal, next, STEP);
    positivePrincipal = next;
  }
  assert.equal(positiveTurns, 1);
  assertClose(rotaryJointUnwrappedAngle(positivePrincipal, positiveTurns), Math.PI * 2);

  let negativePrincipal = 0;
  let negativeTurns = 0;
  for (let index = 0; index < 24; index += 1) {
    const next = Math.atan2(Math.sin(negativePrincipal - STEP), Math.cos(negativePrincipal - STEP));
    negativeTurns = advanceRotaryRevolutionCount(negativeTurns, negativePrincipal, next, -STEP);
    negativePrincipal = next;
  }
  assert.equal(negativeTurns, -1);
  assertClose(rotaryJointUnwrappedAngle(negativePrincipal, negativeTurns), -Math.PI * 2);
});

test("S2.21 remains fail closed for ambiguous steps, invalid counts and inconsistent transitions", () => {
  assert.throws(() => advanceRotaryRevolutionCount(0, 0, 0, Math.PI), /below pi/);
  assert.throws(() => advanceRotaryRevolutionCount(0.5, 0, STEP, STEP), /safe integer/);
  assert.throws(() => rotaryJointUnwrappedAngle(Math.PI * 2, 0), /principal angle/);
  assert.throws(() => advanceRotaryRevolutionCount(0, 0, STEP * 2, STEP), /does not match/);
});
