import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceRotaryRevolutionCount,
  rotaryJointUnwrappedAngle
} from "../../dist/packages/invention-assembly-runtime/src/rotary-multiturn.js";
import { normalizePrincipalAngle } from "../../dist/packages/invention-assembly-runtime/src/rotary-relative-angle.js";

const STEP = Math.PI / 12;

function assertClose(actual, expected, epsilon = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

test("S2.22 increments and decrements explicit revolution memory across principal wrap", () => {
  assert.equal(advanceRotaryRevolutionCount(0, Math.PI, -Math.PI + STEP, STEP), 1);
  assert.equal(advanceRotaryRevolutionCount(0, -Math.PI, Math.PI - STEP, -STEP), -1);
  assert.equal(advanceRotaryRevolutionCount(2, 0, STEP, STEP), 2);
  assert.equal(advanceRotaryRevolutionCount(-2, 0, -STEP, -STEP), -2);
});

test("S2.22 composes S2.20 principal evidence with signed revolutions into an unwrapped angle", () => {
  assertClose(rotaryJointUnwrappedAngle(0, 1), Math.PI * 2);
  assertClose(rotaryJointUnwrappedAngle(STEP * 2, 1), Math.PI * 2 + STEP * 2);
  assertClose(rotaryJointUnwrappedAngle(-STEP, 1), Math.PI * 2 - STEP);
  assertClose(rotaryJointUnwrappedAngle(STEP, -1), -Math.PI * 2 + STEP);
});

test("S2.22 follows complete positive and negative revolutions without losing historical turns", () => {
  let positivePrincipal = 0;
  let positiveTurns = 0;
  for (let index = 0; index < 24; index += 1) {
    const next = normalizePrincipalAngle(positivePrincipal + STEP);
    positiveTurns = advanceRotaryRevolutionCount(positiveTurns, positivePrincipal, next, STEP);
    positivePrincipal = next;
  }
  assert.equal(positiveTurns, 1);
  assertClose(rotaryJointUnwrappedAngle(positivePrincipal, positiveTurns), Math.PI * 2);

  let negativePrincipal = 0;
  let negativeTurns = 0;
  for (let index = 0; index < 24; index += 1) {
    const next = normalizePrincipalAngle(negativePrincipal - STEP);
    negativeTurns = advanceRotaryRevolutionCount(negativeTurns, negativePrincipal, next, -STEP);
    negativePrincipal = next;
  }
  assert.equal(negativeTurns, -1);
  assertClose(rotaryJointUnwrappedAngle(negativePrincipal, negativeTurns), -Math.PI * 2);
});

test("S2.22 composes S2.21 principal-shortest target deltas with historical revolutions including pi", () => {
  let principal = 0;
  let turns = 1;
  const halfTurn = Math.PI;
  const at180 = normalizePrincipalAngle(principal + halfTurn);
  turns = advanceRotaryRevolutionCount(turns, principal, at180, halfTurn);
  principal = at180;
  assert.equal(turns, 1);
  assertClose(rotaryJointUnwrappedAngle(principal, turns), Math.PI * 3);

  const tenDegrees = Math.PI / 18;
  const atMinus170 = normalizePrincipalAngle(principal + tenDegrees);
  turns = advanceRotaryRevolutionCount(turns, principal, atMinus170, tenDegrees);
  principal = atMinus170;
  assert.equal(turns, 2);
  assertClose(rotaryJointUnwrappedAngle(principal, turns), Math.PI * 3 + tenDegrees);
});

test("S2.22 remains fail closed for non-segmented motion larger than pi and invalid revolution evidence", () => {
  assert.throws(() => advanceRotaryRevolutionCount(0, 0, 0, Math.PI + 0.01), /segmented commands/);
  assert.throws(() => advanceRotaryRevolutionCount(0.5, 0, STEP, STEP), /safe integer/);
  assert.throws(() => rotaryJointUnwrappedAngle(Math.PI * 2, 0), /principal angle/);
  assert.throws(() => advanceRotaryRevolutionCount(0, 0, STEP * 2, STEP), /cannot resolve|does not match/);
});
