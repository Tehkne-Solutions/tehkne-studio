import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/invention-assembly-runtime/src/rotary-relative-angle.ts",
  "packages/invention-assembly-runtime/src/index.ts",
  "apps/studio-web/components/RotaryJointControls.tsx",
  "apps/studio-web/components/Invention3DWorkbench.tsx",
  "tests/domain/invention-rotary-relative-angle.test.mjs",
  "tests/browser/rotary-joint-relative-angle.spec.ts",
  "README.md"
];
for (const path of required) await access(resolve(path));

const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = assetForge.components?.find((entry) => entry.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor) throw new Error("S2.20 AF-001 motor definition missing");
if (motor.metadata?.visualAsset?.version !== "0.6.6-hero-candidate" || motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.20 must preserve AF-001 HERO_CANDIDATE identity");
if (motor.metadata?.visualAsset?.triangles !== 3292 || motor.metadata?.visualAsset?.bytes !== 243848) throw new Error("S2.20 must preserve AF-001 LOD0 budget");
if (motor.metadata?.visualAsset?.sha256 !== "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c") throw new Error("S2.20 must not change AF-001 fingerprint");

const angleRuntime = await readFile("packages/invention-assembly-runtime/src/rotary-relative-angle.ts", "utf8");
for (const token of [
  "ROTARY_RELATIVE_ANGLE_EPSILON",
  "localReferenceTangent",
  "worldReferenceTangent",
  "normalizePrincipalAngle",
  "rotaryJointRelativeAngle",
  "Math.atan2(sine, cosine)",
  "requires aligned shaft axes"
]) {
  if (!angleRuntime.includes(token)) throw new Error(`S2.20 derived-angle runtime missing: ${token}`);
}
for (const forbidden of [
  "jointAngleState",
  "jointAngleMap",
  "rotaryState",
  "rotationGraph",
  "jointGraph",
  "rpm",
  "torque",
  "angularVelocity"
]) {
  if (angleRuntime.includes(forbidden)) throw new Error(`S2.20 derived-angle runtime must not create mutable/dynamic state: ${forbidden}`);
}

const assembly = await readFile("packages/invention-assembly-runtime/src/index.ts", "utf8");
for (const token of [
  "planMechanicalRotaryJointStep",
  "planMechanicalAxialAlignment",
  "planMechanicalAssemblyRotation",
  'derivedFrom: "engineering-graph" as const'
]) {
  if (!assembly.includes(token)) throw new Error(`S2.20 S2.17–S2.19 lineage missing: ${token}`);
}
for (const forbidden of ["assemblyGraph", "mechanicalGraph", "rotationGraph", "axialGraph", "jointGraph", "parallelGraph", "rpmSolver", "torqueSolver", "angularVelocitySolver"]) {
  if (assembly.includes(forbidden)) throw new Error(`S2.20 must preserve single topology/no dynamics: ${forbidden}`);
}

const control = await readFile("apps/studio-web/components/RotaryJointControls.tsx", "utf8");
for (const token of [
  "mechanicalCommandRuntimeFor",
  "commands.kinematics(constraint.relationshipId)",
  "kinematics.principalRadians",
  'data-angle-rad={kinematics === null ? "" : kinematics.principalRadians.toFixed(3)}',
  'data-angle-mode="principal-derived"',
  "formatAngle(kinematics.principalRadians)",
  "JOINT −",
  "JOINT +"
]) {
  if (!control.includes(token)) throw new Error(`S2.20 observable principal-angle projection missing: ${token}`);
}

const workbench = await readFile("apps/studio-web/components/Invention3DWorkbench.tsx", "utf8");
for (const token of [
  "Rotary Joint DOF",
  "Axial Joint Alignment",
  "Rigid Assembly Rotation",
  "RotaryJointControls",
  "runtime.builder.connect",
  "inventionSpatial: runtime.spatial.document()"
]) {
  if (!workbench.includes(token)) throw new Error(`S2.20 Workbench lineage missing: ${token}`);
}
for (const forbidden of ["jointAngleState", "jointAngleMap", "rpmSolver", "torqueSolver", "angularVelocitySolver", 'status: "GOLDEN_ASSET"']) {
  if (workbench.includes(forbidden) || control.includes(forbidden)) throw new Error(`S2.20 forbidden premature/parallel behavior: ${forbidden}`);
}

const domain = await readFile("tests/domain/invention-rotary-relative-angle.test.mjs", "utf8");
for (const token of [
  "S2.20 derives zero and signed principal rotary angle",
  "without joint state",
  "S2.17 rigid rotation",
  "S2.19 follower-only spin",
  "accumulates geometrically",
  "remains fail closed"
]) {
  if (!domain.includes(token)) throw new Error(`S2.20 domain evidence missing: ${token}`);
}

const browser = await readFile("tests/browser/rotary-joint-relative-angle.spec.ts", "utf8");
for (const token of [
  "S2.20 derives the principal rotary joint angle",
  'data-angle-mode", "principal-derived"',
  'data-angle-rad", "0.000"',
  'data-angle-rad", "0.262"',
  'data-angle-rad", "0.524"',
  "30.0°",
  'name: "RY +", exact: true',
  "Guardar 3D",
  "page.reload",
  "pageErrors",
  "consoleErrors"
]) {
  if (!browser.includes(token)) throw new Error(`S2.20 browser evidence missing: ${token}`);
}

const readme = await readFile("README.md", "utf8");
for (const token of [
  "Current baseline",
  "Rotary Joint Relative Angle",
  "principal angle",
  "derived from",
  "HERO_CANDIDATE",
  "AF-001L",
  "Tehkné Solutions"
]) {
  if (!readme.includes(token)) throw new Error(`S2.20 README semantic baseline missing: ${token}`);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.20"] !== "node scripts/verify-s2.20.mjs") throw new Error("S2.20 package verification script missing");
const tsconfig = await readFile("tsconfig.core.json", "utf8");
if (!tsconfig.includes('"packages/invention-assembly-runtime/src/**/*.ts"')) throw new Error("S2.20 relative-angle runtime missing from core typecheck");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("npm run verify:s2.20")) throw new Error("S2.20 CI contract missing");
if (!workflow.includes("tests/browser/rotary-joint-relative-angle.spec.ts")) throw new Error("S2.20 browser gate missing from CI");
if (workflow.includes("contents: write")) throw new Error("S2.20 CI must remain read-only");

console.log("S2.20 Rotary Joint Relative Angle PASS · signed principal angle derived from persisted transforms and projected through current CommandBus kinematics + rigid-invariant + semantic README contract + no joint state/no dynamics solver + successor explicit segment-rate evidence compatible + Tehkné Solutions");
