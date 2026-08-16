import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/invention-assembly-runtime/src/index.ts",
  "apps/studio-web/components/Invention3DWorkbench.tsx",
  "apps/studio-web/components/RotaryJointControls.tsx",
  "tests/domain/invention-rotary-joint-runtime.test.mjs",
  "tests/browser/rotary-joint-dof.spec.ts",
  "README.md"
];
for (const path of required) await access(resolve(path));

const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = assetForge.components?.find((entry) => entry.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor) throw new Error("S2.19 AF-001 motor definition missing");
if (motor.metadata?.visualAsset?.version !== "0.6.6-hero-candidate" || motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.19 must preserve AF-001 HERO_CANDIDATE identity");
if (motor.metadata?.visualAsset?.sha256 !== "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c") throw new Error("S2.19 must not change AF-001 fingerprint");
if (motor.metadata?.mechanicalPortAxisMap?.["shaft-out"]?.join(",") !== "0,0,1") throw new Error("S2.19 must preserve S2.18 shaft axis evidence");

const assembly = await readFile("packages/invention-assembly-runtime/src/index.ts", "utf8");
for (const token of [
  "PlannedRotaryJointStep",
  "quaternionAroundUnitAxis",
  "endpointFromBinding",
  "planMechanicalRotaryJointStep",
  "requires coincident endpoints before rotation",
  "requires aligned shaft axes before rotation",
  "Mechanical rotary joint would place",
  "lost axial alignment",
  "planMechanicalAxialAlignment",
  "planMechanicalAssemblyRotation",
  'derivedFrom: "engineering-graph" as const'
]) {
  if (!assembly.includes(token)) throw new Error(`S2.19 rotary planner contract missing: ${token}`);
}
for (const forbidden of ["assemblyGraph", "mechanicalGraph", "rotationGraph", "axialGraph", "jointGraph", "parallelGraph", "rpmSolver", "torqueSolver", "angularVelocitySolver"]) {
  if (assembly.includes(forbidden)) throw new Error(`S2.19 must not create parallel topology or premature dynamics: ${forbidden}`);
}

const control = await readFile("apps/studio-web/components/RotaryJointControls.tsx", "utf8");
for (const token of [
  "RotaryJointControls",
  "planMechanicalRotaryJointStep",
  "rotary-follower",
  "JOINT −",
  "JOINT +",
  "disabled={!ready}",
  "spatial.rotate(plan.entityId, plan.toRotation)",
  "spatial.move(plan.entityId, plan.toPosition)",
  "sem RPM/torque"
]) {
  if (!control.includes(token)) throw new Error(`S2.19 control contract missing: ${token}`);
}

const workbench = await readFile("apps/studio-web/components/Invention3DWorkbench.tsx", "utf8");
for (const token of [
  "Rotary Joint DOF",
  "Axial Joint Alignment",
  "Rigid Assembly Rotation",
  'data-rotary-joint-dof={axialConstraints.length}',
  'data-rotary-dof={axialConstraint ? "enabled" : "none"}',
  "RotaryJointControls",
  "Joint Rotate 3D",
  "driver ${sourceEntity.name} imóvel",
  "inventionSpatial: runtime.spatial.document()"
]) {
  if (!workbench.includes(token)) throw new Error(`S2.19 semantic Workbench contract missing: ${token}`);
}

const domain = await readFile("tests/domain/invention-rotary-joint-runtime.test.mjs", "utf8");
for (const token of [
  "S2.19 rotary joint step spins only the follower",
  "rotary planner must never mutate the driver",
  "requires coincident endpoints",
  "requires aligned shaft axes",
  "S2.17 rigid assembly rotation",
  "S2.18 axial alignment"
]) {
  if (!domain.includes(token)) throw new Error(`S2.19 domain evidence missing: ${token}`);
}

const browser = await readFile("tests/browser/rotary-joint-dof.spec.ts", "utf8");
for (const token of [
  "S2.19 rotates only the rotary follower",
  'name: "JOINT +", exact: true',
  'data-rotary-dof", "enabled"',
  'data-rotary-joint-dof", "1"',
  'data-rz", "0.262"',
  'name: "RY +", exact: true',
  "Guardar 3D",
  "page.reload",
  "pageErrors",
  "consoleErrors"
]) {
  if (!browser.includes(token)) throw new Error(`S2.19 browser evidence missing: ${token}`);
}

const readme = await readFile("README.md", "utf8");
for (const token of ["Current baseline", "Rotary Joint DOF", "HERO_CANDIDATE", "AF-001L", "Tehkné Solutions"]) {
  if (!readme.includes(token)) throw new Error(`S2.19 README semantic baseline missing: ${token}`);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.19"] !== "node scripts/verify-s2.19.mjs") throw new Error("S2.19 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("npm run verify:s2.19")) throw new Error("S2.19 CI contract missing");
if (!workflow.includes("tests/browser/rotary-joint-dof.spec.ts")) throw new Error("S2.19 browser gate missing from CI");
if (workflow.includes("contents: write")) throw new Error("S2.19 CI must remain read-only");

const sourceWorkflow = await readFile(".github/workflows/asset-forge-af001i-v065-contract.yml", "utf8");
if (!sourceWorkflow.includes("actions/setup-node@v6") || !sourceWorkflow.includes('node-version: "24"')) throw new Error("S2.19 workflow housekeeping must align AF-001I source contract to Node 24/actions v6");

console.log("S2.19 Rotary Joint DOF PASS · semantic follower-only shaft rotation + coincident endpoint preservation + axial/rigid composition + no dynamics fiction · Tehkné Solutions");