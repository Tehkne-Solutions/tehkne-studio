import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assessArmLoad, buildFailureTrace } from "../../dist/packages/failure-simulation/src/index.js";

const envelope = JSON.parse(await readFile(new URL("../../presets/arm-01/failure-profile.json", import.meta.url), "utf8"));
const reach = Math.hypot(0.9, 0.65);

test("S1.9 functional load model separates healthy, warning and fault envelopes", () => {
  const baseline = assessArmLoad({ payloadKg: 0.35, horizontalReachM: reach, envelope });
  const stressed = assessArmLoad({ payloadKg: 1.25, horizontalReachM: reach, envelope });
  const critical = assessArmLoad({ payloadKg: 1.6, horizontalReachM: reach, envelope });

  assert.equal(baseline.status, "pass");
  assert.equal(stressed.status, "warning");
  assert.equal(critical.status, "fault");
  assert.ok(stressed.requiredTorqueNm > baseline.requiredTorqueNm);
  assert.ok(stressed.currentA > baseline.currentA);
  assert.ok(stressed.temperatureC > baseline.temperatureC);
  assert.ok(critical.requiredTorqueNm > envelope.torqueLimitNm);
  assert.ok(critical.currentA > envelope.currentLimitA);
  assert.ok(critical.temperatureC > envelope.maxTemperatureC);
});

test("S1.9 causal trace preserves payload → lever arm → torque → current → thermal → margin", () => {
  const assessment = assessArmLoad({ payloadKg: 1.6, horizontalReachM: reach, envelope });
  const trace = buildFailureTrace(assessment, envelope);
  assert.deepEqual(trace.map((step) => step.id), [
    "payload",
    "lever-arm",
    "required-torque",
    "motor-current",
    "thermal",
    "margin"
  ]);
  assert.match(trace.at(-1).detail, /limites foram excedidos/i);
});
