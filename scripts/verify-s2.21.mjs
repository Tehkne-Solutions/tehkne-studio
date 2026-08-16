import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/invention-assembly-runtime/src/rotary-relative-angle.ts",
  "packages/invention-assembly-runtime/src/index.ts",
  "apps/studio-web/components/RotaryJointControls.tsx",
  "apps/studio-web/components/GoldenMotorPbrReviewGateV065ContractAligned.tsx",
  "tests/domain/invention-rotary-target-angle.test.mjs",
  "tests/browser/rotary-joint-target-angle.spec.ts",
  "tests/browser/asset-forge-af001i.spec.ts",
  "README.md"
];
for (const path of required) await access(resolve(path));

const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = assetForge.components?.find((entry) => entry.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor) throw new Error("S2.21 AF-001 motor definition missing");
if (motor.metadata?.visualAsset?.version !== "0.6.6-hero-candidate" || motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.21 must preserve AF-001 HERO_CANDIDATE identity");
if (motor.metadata?.visualAsset?.triangles !== 3292 || motor.metadata?.visualAsset?.bytes !== 243848) throw new Error("S2.21 must preserve AF-001 LOD0 budget");
if (motor.metadata?.visualAsset?.sha256 !== "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c") throw new Error("S2.21 must not change AF-001 fingerprint");

const angleRuntime = await readFile("packages/invention-assembly-runtime/src/rotary-relative-angle.ts", "utf8");
for (const token of [
  "RotaryJointTargetDelta",
  "rotaryJointRelativeAngle",
  "rotaryJointTargetDelta",
  "normalizePrincipalAngle(targetRadiansInput)",
  "normalizePrincipalAngle(targetRadians - currentRadians)",
  'mode: "principal-shortest"',
  "Rotary target angle must be finite"
]) {
  if (!angleRuntime.includes(token)) throw new Error(`S2.21 target-angle runtime missing: ${token}`);
}
for (const forbidden of [
  "jointAngleState",
  "jointAngleMap",
  "targetAngleState",
  "rotaryState",
  "rotationGraph",
  "jointGraph",
  "rpm",
  "torque",
  "angularVelocity",
  "revolutionCounter"
]) {
  if (angleRuntime.includes(forbidden)) throw new Error(`S2.21 must not create duplicate angle/dynamics state: ${forbidden}`);
}

const assembly = await readFile("packages/invention-assembly-runtime/src/index.ts", "utf8");
for (const token of [
  "planMechanicalRotaryJointStep",
  "planMechanicalAxialAlignment",
  "planMechanicalAssemblyRotation",
  'derivedFrom: "engineering-graph" as const'
]) {
  if (!assembly.includes(token)) throw new Error(`S2.21 physical planner lineage missing: ${token}`);
}
for (const forbidden of ["assemblyGraph", "mechanicalGraph", "rotationGraph", "axialGraph", "jointGraph", "parallelGraph", "rpmSolver", "torqueSolver", "angularVelocitySolver"]) {
  if (assembly.includes(forbidden)) throw new Error(`S2.21 must preserve single topology/no dynamics: ${forbidden}`);
}

const control = await readFile("apps/studio-web/components/RotaryJointControls.tsx", "utf8");
for (const token of [
  "rotaryJointTargetDelta",
  "applyTargetAngle",
  'aria-label="Rotary joint target angle degrees"',
  'data-target-mode="principal-shortest"',
  "target.deltaRadians",
  "SET ANGLE",
  "JOINT −",
  "JOINT +",
  "sem RPM/torque"
]) {
  if (!control.includes(token)) throw new Error(`S2.21 target control contract missing: ${token}`);
}
for (const forbidden of ["jointAngleState", "jointAngleMap", "targetAngleState", "rpmSolver", "torqueSolver", "angularVelocitySolver"]) {
  if (control.includes(forbidden)) throw new Error(`S2.21 control must not persist duplicate/dynamic state: ${forbidden}`);
}

const af001iSurface = await readFile("apps/studio-web/components/GoldenMotorPbrReviewGateV065ContractAligned.tsx", "utf8");
for (const token of [
  'frameloop="demand"',
  "const { camera, invalidate } = useThree()",
  "camera.updateProjectionMatrix()",
  "invalidate()",
  "MAX_AVERAGE_FRAME_MS = 100",
  "MAX_P95_FRAME_MS = 150",
  "WARMUP_MS = 1_500",
  "BENCHMARK_WINDOW_MS = 8_000",
  'data-render-policy="static-pbr-key-fill-no-realtime-shadow-map"'
]) {
  if (!af001iSurface.includes(token)) throw new Error(`S2.21 AF-001I static runtime stabilization missing: ${token}`);
}
if (af001iSurface.includes("MAX_AVERAGE_FRAME_MS = 105") || af001iSurface.includes("MAX_P95_FRAME_MS = 155")) throw new Error("S2.21 must not relax AF-001I performance thresholds");

const af001iBrowser = await readFile("tests/browser/asset-forge-af001i.spec.ts", "utf8");
for (const token of ["toBeLessThan(100)", "toBeLessThan(150)", "MIN_BENCHMARK_SAMPLES", "AF001I_METRICS"]) {
  if (!af001iBrowser.includes(token)) throw new Error(`S2.21 AF-001I browser threshold evidence missing: ${token}`);
}

const domain = await readFile("tests/domain/invention-rotary-target-angle.test.mjs", "utf8");
for (const token of [
  "absolute principal angle without storing joint state",
  "shortest signed path across the principal wrap",
  "existing S2.19 follower-only planner",
  "driver immutable",
  "survives rigid assembly rotation",
  "remains fail closed"
]) {
  if (!domain.includes(token)) throw new Error(`S2.21 domain evidence missing: ${token}`);
}

const browser = await readFile("tests/browser/rotary-joint-target-angle.spec.ts", "utf8");
for (const token of [
  "S2.21 positions a rotary follower at an absolute principal target",
  'data-target-mode", "principal-shortest"',
  'data-angle-rad", "1.571"',
  'data-angle-rad", "-0.785"',
  "Rotary joint target angle degrees",
  'name: "SET ANGLE", exact: true',
  'name: "RY +", exact: true',
  "Guardar 3D",
  "page.reload",
  "pageErrors",
  "consoleErrors"
]) {
  if (!browser.includes(token)) throw new Error(`S2.21 browser evidence missing: ${token}`);
}

const readme = await readFile("README.md", "utf8");
for (const token of [
  "Current baseline",
  "S2.21",
  "Rotary Joint Target Angle",
  "principal-shortest",
  "HERO_CANDIDATE",
  "AF-001L",
  "Tehkné Solutions"
]) {
  if (!readme.includes(token)) throw new Error(`S2.21 README baseline missing: ${token}`);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.21"] !== "node scripts/verify-s2.21.mjs") throw new Error("S2.21 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("npm run verify:s2.21")) throw new Error("S2.21 CI contract missing");
if (!workflow.includes("tests/browser/rotary-joint-target-angle.spec.ts")) throw new Error("S2.21 browser gate missing from CI");
if (workflow.includes("contents: write")) throw new Error("S2.21 CI must remain read-only");

console.log("S2.21 Rotary Joint Target Angle PASS · absolute principal target + shortest transform-derived delta + follower-only physical planner + demand-driven AF-001I runtime stability + no duplicate state/no dynamics fiction + Tehkné Solutions");
