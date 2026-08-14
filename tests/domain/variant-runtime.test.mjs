import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compareArmVariant } from "../../dist/packages/variant-runtime/src/index.js";

const base = JSON.parse(await readFile(new URL("../../presets/arm-01/failure-profile.json", import.meta.url), "utf8"));
const candidate = JSON.parse(await readFile(new URL("../../presets/arm-01/variants/high-torque-profile.json", import.meta.url), "utf8"));

test("S1.10 variant comparison preserves BASE failure and validates HIGH-TORQUE independently", () => {
  const comparison = compareArmVariant(
    1.6,
    Math.hypot(0.9, 0.65),
    base.variantId,
    base,
    base.actuatorMassKg,
    base.estimatedActuatorCostBrl,
    base.supplyCurrentCapacityA,
    candidate
  );

  assert.equal(comparison.base.variantId, "arm-01/base");
  assert.equal(comparison.base.assessment.status, "fault");
  assert.equal(comparison.candidate.variantId, "arm-01/high-torque");
  assert.equal(comparison.candidate.assessment.status, "pass");
  assert.ok(comparison.candidate.assessment.limitingMarginPercent > 20);
});

test("S1.10 variant comparison exposes declared trade-offs instead of only increasing limits", () => {
  const comparison = compareArmVariant(
    1.6,
    Math.hypot(0.9, 0.65),
    base.variantId,
    base,
    base.actuatorMassKg,
    base.estimatedActuatorCostBrl,
    base.supplyCurrentCapacityA,
    candidate
  );

  const mass = comparison.impacts.find((impact) => impact.id === "mass-impact");
  const cost = comparison.impacts.find((impact) => impact.id === "cost-impact");
  const current = comparison.impacts.find((impact) => impact.id === "current-impact");
  assert.equal(mass.direction, "increase");
  assert.equal(cost.direction, "increase");
  assert.equal(current.direction, "decrease");
  assert.equal(mass.provenance, "authored-estimate");
  assert.equal(current.provenance, "simulated");
  assert.ok(comparison.changes.some((change) => change.property === "torqueLimitNm"));
  assert.ok(comparison.changes.some((change) => change.property === "supplyCurrentCapacityA"));
});
