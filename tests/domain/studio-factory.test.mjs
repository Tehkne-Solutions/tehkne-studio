import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { ArmFailureLab } from "../../dist/packages/studio-failure/src/index.js";
import { ArmVariantLab } from "../../dist/packages/studio-variants/src/index.js";
import { ArmPrototypeFactory } from "../../dist/packages/studio-factory/src/index.js";

const project = JSON.parse(await readFile(new URL("../../presets/arm-01/project.json", import.meta.url), "utf8"));
const base = JSON.parse(await readFile(new URL("../../presets/arm-01/failure-profile.json", import.meta.url), "utf8"));
const candidate = JSON.parse(await readFile(new URL("../../presets/arm-01/variants/high-torque-profile.json", import.meta.url), "utf8"));
const manufacturing = JSON.parse(await readFile(new URL("../../presets/arm-01/manufacturing-profile.json", import.meta.url), "utf8"));
const freshProject = () => JSON.parse(JSON.stringify(project));

test("S1.11 factory fails closed until a validated variant exists", () => {
  const session = new EngineeringSession(freshProject());
  const failureLab = new ArmFailureLab(session, base);
  const variants = new ArmVariantLab(failureLab, base, candidate);
  const factory = new ArmPrototypeFactory(session, variants, manufacturing);

  assert.throws(() => factory.generate(), /validated engineering variant/);
  failureLab.run(1.6);
  variants.createHighTorqueVariant();
  const manifest = factory.generate();
  assert.equal(manifest.variantId, "arm-01/high-torque");
  assert.equal(manifest.fabricationReady, false);
  assert.equal(factory.latest().packageId, manifest.packageId);
  assert.equal(session.events.list("PrototypePackageGenerated").length, 1);
});

test("S1.11 generated package keeps simulation and physical acceptance evidence separate", () => {
  const session = new EngineeringSession(freshProject());
  const failureLab = new ArmFailureLab(session, base);
  const variants = new ArmVariantLab(failureLab, base, candidate);
  failureLab.run(1.6);
  variants.createHighTorqueVariant();
  const factory = new ArmPrototypeFactory(session, variants, manufacturing);
  const manifest = factory.generate();

  const payloadTest = manifest.acceptanceTests.find((item) => item.id === "T03");
  assert.equal(payloadTest.evidence, "simulation-pass / physical-pending");
  assert.ok(manifest.assemblySteps.some((step) => step.label.includes("payload acceptance")));
  const event = session.events.list("PrototypePackageGenerated")[0];
  assert.equal(event.payload.variantId, "arm-01/high-torque");
  assert.equal(event.payload.fabricationReady, false);
  assert.ok(event.payload.sourceFailureExperimentId);
});
