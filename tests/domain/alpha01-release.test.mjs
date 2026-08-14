import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { StudioBehaviorController } from "../../dist/packages/studio-behavior/src/index.js";
import { ArmFailureLab } from "../../dist/packages/studio-failure/src/index.js";
import { Arm01Controller } from "../../dist/packages/studio-robotics/src/index.js";
import { ArmVariantLab } from "../../dist/packages/studio-variants/src/index.js";
import { ArmPrototypeFactory } from "../../dist/packages/studio-factory/src/index.js";
import { StudioIntelligence } from "../../dist/packages/studio-intelligence/src/index.js";
import { evaluateAlphaRelease } from "../../dist/packages/release-runtime/src/index.js";

const desktopPreset = JSON.parse(await readFile(new URL("../../presets/desktop-pc/project.json", import.meta.url), "utf8"));
const armPreset = JSON.parse(await readFile(new URL("../../presets/arm-01/project.json", import.meta.url), "utf8"));
const baseProfile = JSON.parse(await readFile(new URL("../../presets/arm-01/failure-profile.json", import.meta.url), "utf8"));
const variantProfile = JSON.parse(await readFile(new URL("../../presets/arm-01/variants/high-torque-profile.json", import.meta.url), "utf8"));
const manufacturingProfile = JSON.parse(await readFile(new URL("../../presets/arm-01/manufacturing-profile.json", import.meta.url), "utf8"));
const releaseManifest = JSON.parse(await readFile(new URL("../../releases/alpha-01/manifest.json", import.meta.url), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));

async function desktopEvidence() {
  const session = new EngineeringSession(clone(desktopPreset));
  const behavior = new StudioBehaviorController(session);
  const intelligence = new StudioIntelligence(session, behavior);

  assert.equal((await intelligence.executeUtterance("Abra o computador")).executed, true);
  assert.equal((await intelligence.executeUtterance("Tire a RAM")).executed, true);
  const failedBoot = await intelligence.executeUtterance("Ligue o computador");
  assert.equal(failedBoot.executed, true);
  assert.equal(session.getEntity("pc.boot").state, "fault");
  assert.equal(session.getEntity("pc.boot").properties.stage.value, "MEMORY_CHECK");
  const why = await intelligence.executeUtterance("Por que não iniciou?");
  assert.equal(why.executed, true);
  assert.ok(why.result.causalTrace.length >= 3);
  assert.equal((await intelligence.executeUtterance("Reinstale a RAM")).executed, true);
  assert.equal((await intelligence.executeUtterance("Ligue novamente")).executed, true);
  assert.equal(session.getEntity("pc.boot").state, "running");

  const automation = await intelligence.executeUtterance(
    "Quando a CPU passar de 70 graus, coloque a ventoinha no máximo"
  );
  assert.equal(automation.executed, true);
  assert.ok(automation.behavior);
  const triggered = await behavior.ingestTelemetry("pc.cpu", "temperatureC", 76, "simulation");
  assert.equal(triggered.executions.length, 1);
  assert.equal(session.getEntity("pc.cooling").properties.fanPercent.value, 100);
  const beforeCooling = session.getEntity("pc.cpu").properties.temperatureC.value;
  const thermal = await behavior.simulateCpuThermalStep();
  assert.ok(thermal.nextTemperatureC < beforeCooling);

  return [
    {
      id: "desktop.causal-repair",
      status: "pass",
      source: "domain-test",
      summary: "RAM removal caused MEMORY_CHECK fault, causal trace explained it, reinstall restored RUNNING.",
      details: { finalBootState: session.getEntity("pc.boot").state }
    },
    {
      id: "desktop.automation",
      status: "pass",
      source: "simulation",
      summary: "Natural-language Behavior IR triggered fan 100% above threshold and thermal model cooled CPU.",
      details: { fanPercent: session.getEntity("pc.cooling").properties.fanPercent.value }
    }
  ];
}

async function armEvidence() {
  const pickSession = new EngineeringSession(clone(armPreset));
  const pickController = new Arm01Controller(pickSession);
  const pickIntelligence = new StudioIntelligence(pickSession, undefined, pickController);
  const pick = await pickIntelligence.executeUtterance("Pegue o cubo vermelho");
  assert.equal(pick.executed, true);
  assert.equal(pickSession.getEntity("object.cube.red").state, "held");
  assert.equal(pickSession.getEntity("object.cube.red").properties.attachedTo.value, "arm.gripper");

  const redesignSession = new EngineeringSession(clone(armPreset));
  const failureLab = new ArmFailureLab(redesignSession, baseProfile);
  const variants = new ArmVariantLab(failureLab, baseProfile, variantProfile);
  const factory = new ArmPrototypeFactory(redesignSession, variants, manufacturingProfile);
  const failure = failureLab.run(1.6);
  assert.equal(failure.assessment.status, "fault");
  const explanation = failureLab.explainLatest();
  assert.ok(explanation.trace.length >= 6);
  const variant = variants.createHighTorqueVariant();
  assert.equal(variant.validationStatus, "pass");
  assert.equal(variants.latest().comparison.base.assessment.status, "fault");
  assert.equal(variants.latest().comparison.candidate.assessment.status, "pass");
  const prototypePackage = factory.generate();
  assert.equal(prototypePackage.readiness, "prototype-plan");
  assert.equal(prototypePackage.fabricationReady, false);
  assert.equal(prototypePackage.variantId, "arm-01/high-torque");

  return [
    {
      id: "arm.pick",
      status: "pass",
      source: "simulation",
      summary: "Natural-language pick produced deterministic IK motion and Engineering Graph attachment.",
      details: { objectState: pickSession.getEntity("object.cube.red").state }
    },
    {
      id: "arm.failure-causality",
      status: "pass",
      source: "simulation",
      summary: "1.60 kg generated a fail-closed load fault with causal engineering trace.",
      details: { failureMode: failure.assessment.failureMode, traceSteps: explanation.trace.length }
    },
    {
      id: "arm.variant",
      status: "pass",
      source: "simulation",
      summary: "High Torque child variant preserved BASE fault and independently passed the same payload case.",
      details: { variantId: variant.variantId, parentVariantId: variant.parentVariantId }
    },
    {
      id: "arm.prototype-package",
      status: "pass",
      source: "domain-test",
      summary: "Validated variant generated a traceable Prototype Plan package without claiming fabrication readiness.",
      details: { packageId: prototypePackage.packageId, fabricationReady: prototypePackage.fabricationReady }
    }
  ];
}

test("S1.12 Alpha 01 release gate passes only when both golden product flows pass end-to-end", async () => {
  const evidence = [...await desktopEvidence(), ...await armEvidence()];
  const evaluation = evaluateAlphaRelease(releaseManifest, evidence);

  assert.equal(evaluation.status, "alpha-ready");
  assert.equal(evaluation.productionReady, false);
  assert.equal(evaluation.physicalPrototypeReady, false);
  assert.deepEqual(evaluation.missingEvidenceIds, []);
  assert.deepEqual(evaluation.failedEvidenceIds, []);
  assert.equal(evaluation.passedEvidenceIds.length, 6);
  assert.equal(evaluation.signature, "Tehkné Solutions");
});

test("S1.12 release gate remains fail-closed when any golden evidence is absent or failed", () => {
  const partial = releaseManifest.requiredEvidenceIds.slice(0, 5).map((id) => ({
    id,
    status: "pass",
    source: "domain-test",
    summary: "fixture"
  }));
  const missing = evaluateAlphaRelease(releaseManifest, partial);
  assert.equal(missing.status, "blocked");
  assert.deepEqual(missing.missingEvidenceIds, ["arm.prototype-package"]);

  const completeWithFailure = releaseManifest.requiredEvidenceIds.map((id) => ({
    id,
    status: id === "arm.variant" ? "fail" : "pass",
    source: "domain-test",
    summary: "fixture"
  }));
  const failed = evaluateAlphaRelease(releaseManifest, completeWithFailure);
  assert.equal(failed.status, "blocked");
  assert.deepEqual(failed.failedEvidenceIds, ["arm.variant"]);
});
