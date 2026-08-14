import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/release-runtime/src/index.ts",
  "releases/alpha-01/manifest.json",
  "tests/domain/alpha01-release.test.mjs"
];
for (const path of required) await access(resolve(path));

const manifest = JSON.parse(await readFile("releases/alpha-01/manifest.json", "utf8"));
if (manifest.releaseId !== "tehkne-studio-alpha-01") throw new Error("Alpha 01 release identity missing");
if (manifest.version !== "0.1.0-alpha.1") throw new Error("Alpha 01 version mismatch");
if (manifest.channel !== "alpha") throw new Error("Alpha 01 channel must remain alpha");
if (manifest.signature !== "Tehkné Solutions") throw new Error("Alpha 01 official signature missing");
const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
const webPackage = JSON.parse(await readFile("apps/studio-web/package.json", "utf8"));
if (rootPackage.version !== manifest.version) throw new Error(`Root package ${rootPackage.version} does not match Alpha manifest ${manifest.version}`);
if (webPackage.version !== manifest.version) throw new Error(`Studio web ${webPackage.version} does not match Alpha manifest ${manifest.version}`);
const requiredEvidence = [
  "desktop.causal-repair",
  "desktop.automation",
  "arm.pick",
  "arm.failure-causality",
  "arm.variant",
  "arm.prototype-package"
];
if (JSON.stringify(manifest.requiredEvidenceIds) !== JSON.stringify(requiredEvidence)) {
  throw new Error("Alpha 01 golden evidence contract changed unexpectedly");
}
for (const policy of ["productionReady", "physicalPrototypeReady", "mockEvidenceAccepted", "simulationCountsAsPhysicalEvidence"]) {
  if (manifest.releasePolicy?.[policy] !== false) throw new Error(`Alpha 01 release policy must remain false: ${policy}`);
}

const releaseRuntime = await readFile("packages/release-runtime/src/index.ts", "utf8");
for (const token of [
  "AlphaReleaseManifest", "ReleaseEvidenceRecord", "AlphaReleaseEvaluation", "evaluateAlphaRelease",
  '"alpha-ready"', '"blocked"', "missingEvidenceIds", "failedEvidenceIds", "productionReady: false"
]) {
  if (!releaseRuntime.includes(token)) throw new Error(`Release Runtime contract missing: ${token}`);
}

const golden = await readFile("tests/domain/alpha01-release.test.mjs", "utf8");
for (const token of [
  "EngineeringSession", "StudioBehaviorController", "StudioIntelligence", "Arm01Controller",
  "ArmFailureLab", "ArmVariantLab", "ArmPrototypeFactory", "evaluateAlphaRelease",
  "Abra o computador", "Tire a RAM", "Por que não iniciou?", "Reinstale a RAM",
  "Quando a CPU passar de 70 graus", "Pegue o cubo vermelho", "failureLab.run(1.6)",
  "createHighTorqueVariant", "factory.generate"
]) {
  if (!golden.includes(token)) throw new Error(`Alpha 01 golden flow missing: ${token}`);
}
if (!golden.includes('assert.equal(evaluation.status, "alpha-ready")')) throw new Error("Alpha 01 ready assertion missing");
if (!golden.includes('assert.equal(missing.status, "blocked")')) throw new Error("Alpha 01 missing-evidence fail-closed assertion missing");
if (!golden.includes('assert.equal(failed.status, "blocked")')) throw new Error("Alpha 01 failed-evidence fail-closed assertion missing");

const page = await readFile("apps/studio-web/app/page.tsx", "utf8");
if (!page.includes("ALPHA 01")) throw new Error("Alpha 01 Studio release marker missing");

console.log(`S1.12 Alpha 01 structure PASS · ${required.length} release surfaces · 6 golden evidence gates · version ${manifest.version} coherent · Tehkné Solutions`);
