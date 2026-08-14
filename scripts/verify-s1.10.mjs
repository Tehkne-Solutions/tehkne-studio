import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/variant-runtime/src/index.ts",
  "packages/studio-variants/src/index.ts",
  "presets/arm-01/variants/high-torque-profile.json",
  "tests/domain/variant-runtime.test.mjs",
  "tests/domain/studio-variants.test.mjs",
  "tests/domain/studio-variants-intelligence.test.mjs"
];
for (const path of required) await access(resolve(path));

const base = JSON.parse(await readFile("presets/arm-01/failure-profile.json", "utf8"));
const candidate = JSON.parse(await readFile("presets/arm-01/variants/high-torque-profile.json", "utf8"));

if (base.variantId !== "arm-01/base") throw new Error("ARM base variant identity missing");
for (const key of ["actuatorMassKg", "estimatedActuatorCostBrl", "supplyCurrentCapacityA"]) {
  if (typeof base[key] !== "number") throw new Error(`ARM base variant comparison field missing: ${key}`);
}
if (candidate.variantId !== "arm-01/high-torque") throw new Error("High Torque variant identity missing");
if (candidate.parentVariantId !== base.variantId) throw new Error("High Torque variant parent must be ARM base");
if (candidate.projectId !== "arm-01") throw new Error("High Torque variant project identity mismatch");
if (candidate.signature !== "Tehkné Solutions") throw new Error("High Torque variant official signature missing");
if (candidate.provenance?.maturity !== "functional-model") throw new Error("High Torque profile must remain an explicit functional model");
if (candidate.actuatorEnvelope?.torqueLimitNm <= base.torqueLimitNm) throw new Error("High Torque profile must increase torque envelope");
if (candidate.actuatorMassKg <= base.actuatorMassKg) throw new Error("Variant must preserve declared mass trade-off");
if (candidate.estimatedActuatorCostBrl <= base.estimatedActuatorCostBrl) throw new Error("Variant must preserve declared cost trade-off");

const variantRuntime = await readFile("packages/variant-runtime/src/index.ts", "utf8");
for (const token of [
  "ArmVariantProfile", "VariantDesignChange", "VariantImpact", "ArmVariantComparison",
  "compareArmVariant", "validationStatus", "authored-estimate", "simulated"
]) {
  if (!variantRuntime.includes(token)) throw new Error(`Variant Runtime contract missing: ${token}`);
}

const studioVariants = await readFile("packages/studio-variants/src/index.ts", "utf8");
for (const token of [
  "ArmVariantLab", "EngineeringVariantRecord", "sourceFailureExperimentId", "parentVariantId",
  "VariantCreated", "ImpactAnalysisCompleted", "VariantValidated", "createHighTorqueVariant"
]) {
  if (!studioVariants.includes(token)) throw new Error(`Studio Variants orchestration missing: ${token}`);
}
if (!studioVariants.includes('evidence.assessment.status !== "fault"')) {
  throw new Error("Variant creation must remain fail-closed without confirmed failure evidence");
}
if (!studioVariants.includes('comparison.candidate.assessment.status !== "pass"')) {
  throw new Error("Variant validation must require a healthy candidate result");
}

const intentRuntime = await readFile("packages/intelligence-runtime/src/index.ts", "utf8");
for (const token of ["VariantTaskDraft", 'action: "variantTask"', 'intent: "createHighTorqueVariant"', "resolveVariantTask"]) {
  if (!intentRuntime.includes(token)) throw new Error(`Variant intent contract missing: ${token}`);
}

const studioIntelligence = await readFile("packages/studio-intelligence/src/index.ts", "utf8");
for (const token of ["StudioVariantTaskExecutor", "variantTaskExecutor", "createHighTorqueVariant", "variantTask"]) {
  if (!studioIntelligence.includes(token)) throw new Error(`Studio Intelligence variant routing missing: ${token}`);
}
if (studioIntelligence.includes("replaceEntity(")) throw new Error("Studio Intelligence must not mutate variant engineering state directly");

const workbench = await readFile("apps/studio-web/components/SpatialWorkbench.tsx", "utf8");
for (const token of [
  "ArmFailureLab", "ArmVariantLab", "armFailureLab", "armVariantLab", "highTorqueProfile",
  "execution.variantTask", "crie uma versão capaz de levantar esse peso"
]) {
  if (!workbench.includes(token)) throw new Error(`Workbench variant integration missing: ${token}`);
}

const panel = await readFile("apps/studio-web/components/ArmRuntimePanel.tsx", "utf8");
for (const token of [
  "VARIANT COMPARISON", "ARM-01 BASE", "HIGH TORQUE", "DECLARED CHANGES", "TRADE-OFFS", "variantLab.createHighTorqueVariant"
]) {
  if (!panel.includes(token)) throw new Error(`Variant comparison UX missing: ${token}`);
}

console.log(`S1.10 variants structure PASS · ${required.length} new surfaces · failure evidence → child variant → impact analysis → validation · Tehkné Solutions`);
