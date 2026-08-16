import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/invention-assembly-runtime/src/rotary-relative-angle.ts",
  "packages/invention-assembly-runtime/src/rotary-multiturn.ts",
  "apps/studio-web/components/RotaryJointControls.tsx",
  "apps/studio-web/lib/projectPersistence.ts",
  "tests/domain/invention-rotary-multiturn.test.mjs",
  "tests/browser/rotary-joint-multiturn.spec.ts",
  "tests/browser/rotary-joint-target-angle.spec.ts",
  "README.md"
];
for (const path of required) await access(resolve(path));

const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = assetForge.components?.find((entry) => entry.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor) throw new Error("S2.22 AF-001 motor definition missing");
if (motor.metadata?.visualAsset?.version !== "0.6.6-hero-candidate" || motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.22 must preserve AF-001 HERO_CANDIDATE identity");
if (motor.metadata?.visualAsset?.triangles !== 3292 || motor.metadata?.visualAsset?.bytes !== 243848) throw new Error("S2.22 must preserve AF-001 LOD0 budget");
if (motor.metadata?.visualAsset?.sha256 !== "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c") throw new Error("S2.22 must not change AF-001 fingerprint");

const principalRuntime = await readFile("packages/invention-assembly-runtime/src/rotary-relative-angle.ts", "utf8");
for (const token of [
  "normalizePrincipalAngle",
  "rotaryJointRelativeAngle",
  "rotaryJointTargetDelta",
  'mode: "principal-shortest"',
  "normalizePrincipalAngle(targetRadians - currentRadians)",
  "ROTARY_RELATIVE_ANGLE_EPSILON"
]) {
  if (!principalRuntime.includes(token)) throw new Error(`S2.22 must preserve S2.20/S2.21 principal target lineage: ${token}`);
}

const multiTurn = await readFile("packages/invention-assembly-runtime/src/rotary-multiturn.ts", "utf8");
for (const token of [
  'ROTARY_MULTITURN_VERSION = "1"',
  'ROTARY_MULTITURN_SIGNATURE = "Tehkné Solutions"',
  "advanceRotaryRevolutionCount",
  "rotaryJointUnwrappedAngle",
  "RotaryKinematicsState",
  "RotaryKinematicsDocument",
  "stageRotaryKinematicsDocument",
  "rotaryKinematicsStateForSession",
  "rotaryKinematicsDocumentForProject",
  "mechanical.rotary-shaft",
  "segmented commands",
  "revolutions"
]) {
  if (!multiTurn.includes(token)) throw new Error(`S2.22 multi-turn runtime missing: ${token}`);
}
for (const forbidden of ["kinematicsGraph", "jointGraph", "rotationGraph", "rpmSolver", "torqueSolver", "angularVelocitySolver", "angularAccelerationSolver"]) {
  if (multiTurn.includes(forbidden)) throw new Error(`S2.22 must not create parallel topology/dynamics: ${forbidden}`);
}

const persistence = await readFile("apps/studio-web/lib/projectPersistence.ts", "utf8");
for (const token of [
  "inventionRotaryKinematics",
  "rotaryKinematicsDocumentForProject",
  "stageRotaryKinematicsDocument",
  'product === "invention"',
  "mechanical.rotary-shaft"
]) {
  if (!persistence.includes(token)) throw new Error(`S2.22 snapshot persistence missing: ${token}`);
}

const control = await readFile("apps/studio-web/components/RotaryJointControls.tsx", "utf8");
for (const token of [
  "rotaryJointRelativeAngle",
  "rotaryJointTargetDelta",
  "applyTargetAngle",
  'data-target-mode="principal-shortest"',
  "target.deltaRadians",
  "SET ANGLE",
  "advanceRotaryRevolutionCount",
  "rotaryJointUnwrappedAngle",
  "rotaryKinematicsStateForSession",
  'data-angle-mode="principal-derived"',
  'data-multiturn-mode="explicit-revolution-count"',
  "data-revolutions={revolutions}",
  "data-angle-unwrapped-rad",
  "JOINT −",
  "JOINT +",
  "sem RPM/torque"
]) {
  if (!control.includes(token)) throw new Error(`S2.22 observable control contract missing: ${token}`);
}
for (const forbidden of ["kinematicsGraph", "jointGraph", "rpmSolver", "torqueSolver", "angularVelocitySolver", "angularAccelerationSolver"]) {
  if (control.includes(forbidden) || persistence.includes(forbidden)) throw new Error(`S2.22 UI/persistence must remain topology/dynamics clean: ${forbidden}`);
}

const domain = await readFile("tests/domain/invention-rotary-multiturn.test.mjs", "utf8");
for (const token of [
  "S2.22 increments and decrements explicit revolution memory",
  "signed revolutions into an unwrapped angle",
  "complete positive and negative revolutions",
  "S2.21 principal-shortest target deltas",
  "remains fail closed"
]) {
  if (!domain.includes(token)) throw new Error(`S2.22 domain evidence missing: ${token}`);
}

const browser = await readFile("tests/browser/rotary-joint-multiturn.spec.ts", "utf8");
for (const token of [
  "S2.22 preserves multi-turn rotary history",
  'data-target-mode", "principal-shortest"',
  'data-multiturn-mode", "explicit-revolution-count"',
  'data-revolutions", "1"',
  'data-revolutions", "2"',
  'data-angle-unwrapped-rad", "6.283"',
  'data-angle-unwrapped-rad", "9.599"',
  "+2 REV",
  "inventionRotaryKinematics",
  '"revolutions":2',
  "SET ANGLE",
  "Guardar 3D",
  "page.reload",
  "pageErrors",
  "consoleErrors"
]) {
  if (!browser.includes(token)) throw new Error(`S2.22 browser evidence missing: ${token}`);
}

const targetBrowser = await readFile("tests/browser/rotary-joint-target-angle.spec.ts", "utf8");
for (const token of ["S2.21 positions a rotary follower at an absolute principal target", 'name: "SET ANGLE", exact: true', 'data-target-mode", "principal-shortest"']) {
  if (!targetBrowser.includes(token)) throw new Error(`S2.22 must preserve S2.21 target-angle browser proof: ${token}`);
}

const readme = await readFile("README.md", "utf8");
for (const token of [
  "Current baseline",
  "S2.22",
  "Multi-turn Rotary Kinematics",
  "Rotary Joint Target Angle",
  "principal-shortest",
  "inventionRotaryKinematics",
  "HERO_CANDIDATE",
  "AF-001L",
  "Tehkné Solutions"
]) {
  if (!readme.includes(token)) throw new Error(`S2.22 README baseline missing: ${token}`);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.21"] !== "node scripts/verify-s2.21.mjs") throw new Error("S2.22 must preserve S2.21 package verifier");
if (pkg.scripts?.["verify:s2.22"] !== "node scripts/verify-s2.22.mjs") throw new Error("S2.22 package verification script missing");
const tsconfig = await readFile("tsconfig.core.json", "utf8");
if (!tsconfig.includes('"packages/invention-assembly-runtime/src/**/*.ts"')) throw new Error("S2.22 multi-turn runtime missing from core typecheck");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("npm run verify:s2.21") || !workflow.includes("npm run verify:s2.22")) throw new Error("S2.22 cumulative CI contract missing");
if (!workflow.includes("tests/browser/rotary-joint-target-angle.spec.ts") || !workflow.includes("tests/browser/rotary-joint-multiturn.spec.ts")) throw new Error("S2.22 cumulative browser lineage missing from CI");
if (workflow.includes("contents: write")) throw new Error("S2.22 CI must remain read-only");

console.log("S2.22 Multi-turn Rotary Kinematics PASS · S2.21 principal-shortest target preserved + explicit signed revolution memory + snapshot restore + no parallel graph/no dynamics fiction + Tehkné Solutions");
