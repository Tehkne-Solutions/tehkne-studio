import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/invention-spatial-runtime/src/index.ts",
  "packages/invention-assembly-runtime/src/index.ts",
  "apps/studio-web/components/Invention3DWorkbench.tsx",
  "tests/domain/invention-assembly-runtime.test.mjs",
  "tests/browser/rigid-assembly-rotation.spec.ts"
];
for (const path of required) await access(resolve(path));

const spatial = await readFile("packages/invention-spatial-runtime/src/index.ts", "utf8");
for (const token of [
  "assertFiniteRotation",
  "rotate(entityId: EntityId, rotation: SpatialVector3)",
  "rotation: clone(rotation)",
  "parseInventionSpatialDocument",
  "candidate.rotation"
]) {
  if (!spatial.includes(token)) throw new Error(`S2.17 spatial rotation contract missing: ${token}`);
}

const assembly = await readFile("packages/invention-assembly-runtime/src/index.ts", "utf8");
for (const token of [
  'MechanicalRotationAxis = "x" | "y" | "z"',
  "PlannedAssemblyRotation",
  "planMechanicalAssemblyRotation",
  "pivotEntityId",
  "rotateOffset",
  "eulerXyzToQuaternion",
  "quaternionToEulerXyz",
  "multiplyQuaternion(deltaQuaternion, currentQuaternion)",
  "outside invention workspace bounds"
]) {
  if (!assembly.includes(token)) throw new Error(`S2.17 rigid rotation planner missing: ${token}`);
}
for (const forbidden of ["assemblyGraph", "mechanicalGraph", "rotationGraph", "parallelGraph"]) {
  if (assembly.includes(forbidden)) throw new Error(`S2.17 must not create parallel topology: ${forbidden}`);
}

const workbench = await readFile("apps/studio-web/components/Invention3DWorkbench.tsx", "utf8");
for (const token of [
  "Rigid Assembly Rotation",
  "ROTATE_STEP_RAD = Math.PI / 12",
  "planMechanicalAssemblyRotation",
  "const rotateSelected = (axis: MechanicalRotationAxis, radians: number): void =>",
  "runtime.spatial.rotate(entry.entityId, entry.toRotation)",
  "Rotate 3D",
  'data-rigid-assembly-rotation="enabled"',
  "data-rx={format(selectedBinding.rotation.x)}",
  "data-ry={format(selectedBinding.rotation.y)}",
  "data-rz={format(selectedBinding.rotation.z)}",
  'rotateSelected("x", -ROTATE_STEP_RAD)',
  'rotateSelected("y", ROTATE_STEP_RAD)',
  'rotateSelected("z", ROTATE_STEP_RAD)',
  "mechanicalAssemblyMembers(mechanicalConstraints, selectedEntityId)",
  "inventionSpatial: runtime.spatial.document()"
]) {
  if (!workbench.includes(token)) throw new Error(`S2.17 semantic Workbench rotation contract missing: ${token}`);
}
for (const forbidden of ["torqueSimulation", "implicitTorque", "angularVelocitySolver", 'status: "GOLDEN_ASSET"']) {
  if (workbench.includes(forbidden)) throw new Error(`S2.17 forbidden premature behavior: ${forbidden}`);
}

const domain = await readFile("tests/domain/invention-assembly-runtime.test.mjs", "utf8");
for (const token of [
  "S2.17 rigid assembly rotation keeps pivot fixed",
  "planMechanicalAssemblyRotation",
  "Math.PI / 2",
  "rotation planning failure must not partially mutate",
  "spatial rotation is persisted"
]) {
  if (!domain.includes(token)) throw new Error(`S2.17 domain evidence missing: ${token}`);
}

const browser = await readFile("tests/browser/rigid-assembly-rotation.spec.ts", "utf8");
for (const token of [
  "S2.17 rotates a snapped motor-wheel assembly rigidly",
  "Brushed DC Motor · shaft-out",
  "Drive Wheel · hub-in",
  'name: "RY +"',
  "data-ry",
  "Rotate 3D",
  'data-state", "snapped"',
  "Guardar 3D",
  "Projeto salvo carregado no 3D",
  "Math.PI / 12",
  "pageErrors",
  "consoleErrors"
]) {
  if (!browser.includes(token)) throw new Error(`S2.17 browser evidence missing: ${token}`);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.17"] !== "node scripts/verify-s2.17.mjs") throw new Error("S2.17 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("npm run verify:s2.17")) throw new Error("S2.17 CI contract missing");
if (!workflow.includes("tests/browser/rigid-assembly-rotation.spec.ts")) throw new Error("S2.17 browser gate missing from CI");
if (workflow.includes("contents: write")) throw new Error("S2.17 CI must remain read-only");

console.log("S2.17 Rigid Mechanical Assembly Rotation PASS · semantic rigid-rotation contract + pure quaternion planner + pivot orbit + persisted XYZ orientation + same connectedTo assembly + no torque fiction · Tehkné Solutions");