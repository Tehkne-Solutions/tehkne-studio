import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generatePrototypePackage, validateManufacturingProfile } from "../../dist/packages/factory-runtime/src/index.js";

const profile = JSON.parse(await readFile(new URL("../../presets/arm-01/manufacturing-profile.json", import.meta.url), "utf8"));

test("S1.11 manufacturing profile covers MAKE BUY WIRE ASSEMBLE PROGRAM TEST without claiming fabrication readiness", () => {
  validateManufacturingProfile(profile);
  const manifest = generatePrototypePackage(profile, "2026-08-14T00:00:00.000Z");

  assert.equal(manifest.variantId, "arm-01/high-torque");
  assert.equal(manifest.readiness, "prototype-plan");
  assert.equal(manifest.fabricationReady, false);
  for (const strategy of ["make", "buy", "wire", "assemble", "program", "test"]) {
    assert.ok(manifest.strategyCounts[strategy] >= 1);
  }
  assert.ok(manifest.knownLimitations.some((item) => item.includes("No manufacturing-grade CAD")));
  assert.ok(manifest.knownLimitations.some((item) => item.includes("Simulation evidence does not count as physical")));
});

test("S1.11 BOM rollup preserves provenance and cost estimates", () => {
  const manifest = generatePrototypePackage(profile, "2026-08-14T00:00:00.000Z");
  assert.equal(manifest.estimatedBomCostBrl, 578);
  const actuator = manifest.bom.find((item) => item.id === "buy-high-torque-actuator");
  assert.equal(actuator.estimatedLineCostBrl, 460);
  assert.equal(actuator.provenance, "variant-profile");
  assert.equal(manifest.signature, "Tehkné Solutions");
});
