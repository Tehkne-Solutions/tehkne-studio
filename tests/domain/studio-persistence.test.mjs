import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import {
  createSessionSnapshot,
  parseSessionSnapshot,
  restoreSessionSnapshot,
  serializeSessionSnapshot
} from "../../dist/packages/persistence-runtime/src/index.js";
import { ArmFailureLab } from "../../dist/packages/studio-failure/src/index.js";
import { Arm01Controller } from "../../dist/packages/studio-robotics/src/index.js";
import { ArmVariantLab } from "../../dist/packages/studio-variants/src/index.js";
import { ArmPrototypeFactory } from "../../dist/packages/studio-factory/src/index.js";

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

test("S2.2 restores ARM failure, variant and Prototype Package evidence without replay", async () => {
  const [project, failureProfile, highTorqueProfile, manufacturingProfile] = await Promise.all([
    json("presets/arm-01/project.json"),
    json("presets/arm-01/failure-profile.json"),
    json("presets/arm-01/variants/high-torque-profile.json"),
    json("presets/arm-01/manufacturing-profile.json")
  ]);

  const sourceSession = new EngineeringSession(project);
  const sourceController = new Arm01Controller(sourceSession);
  const sourceFailure = new ArmFailureLab(sourceSession, failureProfile);
  const sourceVariant = new ArmVariantLab(sourceFailure, failureProfile, highTorqueProfile);
  const sourceFactory = new ArmPrototypeFactory(sourceSession, sourceVariant, manufacturingProfile);

  const failure = sourceFailure.run(1.6);
  const variant = sourceVariant.createHighTorqueVariant();
  const prototypePackage = sourceFactory.generate();
  const sourceEventCount = sourceSession.events.list().length;

  assert.equal(failure.assessment.status, "fault");
  assert.equal(variant.validationStatus, "pass");
  assert.equal(prototypePackage.fabricationReady, false);

  const snapshot = createSessionSnapshot(sourceSession, {
    extensions: {
      armRuntime: {
        motionRecords: sourceController.records(),
        failureRecords: sourceFailure.records(),
        variantRecords: sourceVariant.records(),
        prototypePackage: sourceFactory.latest()
      }
    },
    savedAt: "2026-08-14T20:30:00.000Z"
  });
  const parsed = parseSessionSnapshot(serializeSessionSnapshot(snapshot));
  const restoredSession = restoreSessionSnapshot(parsed);
  const restoredExtension = parsed.extensions.armRuntime;

  assert.ok(restoredExtension && typeof restoredExtension === "object");
  const restoredController = new Arm01Controller(restoredSession, { records: restoredExtension.motionRecords });
  const restoredFailure = new ArmFailureLab(
    restoredSession,
    failureProfile,
    "object.cube.red",
    { records: restoredExtension.failureRecords }
  );
  const restoredVariant = new ArmVariantLab(
    restoredFailure,
    failureProfile,
    highTorqueProfile,
    "arm.root",
    { records: restoredExtension.variantRecords }
  );
  const restoredFactory = new ArmPrototypeFactory(
    restoredSession,
    restoredVariant,
    manufacturingProfile,
    { latest: restoredExtension.prototypePackage }
  );

  assert.equal(restoredSession.events.list().length, sourceEventCount, "rehydration must not manufacture new evidence");
  assert.deepEqual(restoredController.records(), sourceController.records());
  assert.equal(restoredFailure.latest().id, failure.id);
  assert.equal(restoredFailure.latest().assessment.status, "fault");
  assert.equal(restoredVariant.latest().id, highTorqueProfile.variantId);
  assert.equal(restoredVariant.latest().sourceFailureExperimentId, failure.id);
  assert.equal(restoredVariant.latest().comparison.candidate.assessment.status, "pass");
  assert.equal(restoredFactory.latest().packageId, prototypePackage.packageId);
  assert.equal(restoredFactory.latest().fabricationReady, false);
  assert.equal(restoredSession.events.list().length, sourceEventCount, "inspection after rehydration must still be side-effect free");
});

test("S2.2 blocks ARM runtime restoration when provenance chain is incomplete", async () => {
  const [project, failureProfile, highTorqueProfile, manufacturingProfile] = await Promise.all([
    json("presets/arm-01/project.json"),
    json("presets/arm-01/failure-profile.json"),
    json("presets/arm-01/variants/high-torque-profile.json"),
    json("presets/arm-01/manufacturing-profile.json")
  ]);
  const session = new EngineeringSession(project);
  const failureLab = new ArmFailureLab(session, failureProfile);
  failureLab.run(1.6);
  const variantLab = new ArmVariantLab(failureLab, failureProfile, highTorqueProfile);
  variantLab.createHighTorqueVariant();
  const factory = new ArmPrototypeFactory(session, variantLab, manufacturingProfile);
  const manifest = factory.generate();
  const variantRecord = variantLab.latest();

  const emptyFailureLab = new ArmFailureLab(new EngineeringSession(project), failureProfile);
  assert.throws(
    () => new ArmVariantLab(emptyFailureLab, failureProfile, highTorqueProfile, "arm.root", { records: [variantRecord] }),
    /source failure evidence is missing/
  );

  const sessionWithoutVariant = new EngineeringSession(project);
  const failureWithoutVariant = new ArmFailureLab(sessionWithoutVariant, failureProfile);
  assert.throws(
    () => new ArmPrototypeFactory(
      sessionWithoutVariant,
      new ArmVariantLab(failureWithoutVariant, failureProfile, highTorqueProfile),
      manufacturingProfile,
      { latest: manifest }
    ),
    /requires its validated engineering variant/
  );
});
