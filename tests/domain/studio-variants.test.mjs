import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { ArmFailureLab } from "../../dist/packages/studio-failure/src/index.js";
import { ArmVariantLab } from "../../dist/packages/studio-variants/src/index.js";

const project = JSON.parse(await readFile(new URL("../../presets/arm-01/project.json", import.meta.url), "utf8"));
const base = JSON.parse(await readFile(new URL("../../presets/arm-01/failure-profile.json", import.meta.url), "utf8"));
const candidate = JSON.parse(await readFile(new URL("../../presets/arm-01/variants/high-torque-profile.json", import.meta.url), "utf8"));
const freshProject = () => JSON.parse(JSON.stringify(project));

test("S1.10 creates a child variant only from confirmed fault evidence", () => {
  const session = new EngineeringSession(freshProject());
  const failureLab = new ArmFailureLab(session, base);
  const variants = new ArmVariantLab(failureLab, base, candidate);

  assert.throws(() => variants.createHighTorqueVariant(), /experimento de falha anterior/);
  failureLab.run(1.25);
  assert.throws(() => variants.createHighTorqueVariant(), /condição de falha confirmada/);
  failureLab.run(1.6);
  const summary = variants.createHighTorqueVariant();

  assert.equal(summary.variantId, "arm-01/high-torque");
  assert.equal(summary.parentVariantId, "arm-01/base");
  assert.equal(summary.validationStatus, "pass");
  assert.equal(base.torqueLimitNm, 15.5);
  assert.equal(variants.latest().comparison.base.assessment.status, "fault");
  assert.equal(variants.latest().comparison.candidate.assessment.status, "pass");
});

test("S1.10 preserves source evidence, decision, impacts and validation events", () => {
  const session = new EngineeringSession(freshProject());
  const failureLab = new ArmFailureLab(session, base);
  const variants = new ArmVariantLab(failureLab, base, candidate);
  const failure = failureLab.run(1.6);
  variants.createHighTorqueVariant();
  const record = variants.latest();

  assert.equal(record.sourceFailureExperimentId, failure.id);
  assert.match(record.decision, /envelope do atuador/);
  assert.ok(record.comparison.changes.length >= 3);
  assert.ok(record.comparison.impacts.some((impact) => impact.category === "cost"));
  assert.equal(session.events.list("VariantCreated").length, 1);
  assert.equal(session.events.list("ImpactAnalysisCompleted").length, 1);
  assert.equal(session.events.list("VariantValidated").length, 1);
});
