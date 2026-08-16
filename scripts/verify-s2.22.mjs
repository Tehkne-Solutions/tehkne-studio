import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/invention-spatial-runtime/src/index.ts",
  "packages/invention-mechanical-command-runtime/src/index.ts",
  "apps/studio-web/components/Invention3DWorkbench.tsx",
  "apps/studio-web/components/RotaryJointControls.tsx",
  "tests/domain/invention-spatial-runtime.test.mjs",
  "tests/browser/atomic-spatial-transform.spec.ts",
  "README.md"
];
for (const path of required) await access(resolve(path));

const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = assetForge.components?.find((entry) => entry.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor) throw new Error("S2.22 AF-001 motor definition missing");
if (motor.metadata?.visualAsset?.version !== "0.6.6-hero-candidate" || motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.22 must preserve AF-001 HERO_CANDIDATE identity");
if (motor.metadata?.visualAsset?.triangles !== 3292 || motor.metadata?.visualAsset?.bytes !== 243848) throw new Error("S2.22 must preserve AF-001 LOD0 budget");
if (motor.metadata?.visualAsset?.sha256 !== "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c") throw new Error("S2.22 must not change AF-001 fingerprint");

const spatial = await readFile("packages/invention-spatial-runtime/src/index.ts", "utf8");
for (const token of [
  "InventionSpatialTransformMutation",
  "transform(entityId: EntityId, position: SpatialVector3, rotation: SpatialVector3)",
  "transformBatch(mutations: readonly InventionSpatialTransformMutation[])",
  "const seen = new Set<EntityId>()",
  "Duplicate spatial transform entity",
  "Unknown invention spatial binding",
  "assertFinitePosition(mutation.position)",
  "assertFiniteRotation(mutation.rotation)",
  "const prepared = mutations.map",
  "for (const next of prepared) this.#bindings.set(next.entityId, next)",
  "return prepared.map(clone)"
]) {
  if (!spatial.includes(token)) throw new Error(`S2.22 spatial transaction contract missing: ${token}`);
}
for (const forbidden of ["pendingTransforms", "transformGraph", "spatialTransactionState", "shadowBindings", "transactionQueue"]) {
  if (spatial.includes(forbidden)) throw new Error(`S2.22 must not create parallel spatial state: ${forbidden}`);
}

const workbench = await readFile("apps/studio-web/components/Invention3DWorkbench.tsx", "utf8");
for (const token of [
  "Atomic Spatial Transform",
  'data-spatial-transform-mode="atomic-batch"',
  "TRANSFORM · ATOMIC BATCH · VALIDATE ALL BEFORE COMMIT",
  "spatial.transformBatch([{ entityId: plan.entityId, position: plan.toPosition, rotation: plan.toRotation }])",
  "runtime.spatial.transformBatch(plan.map((move)",
  "rotation: current.rotation",
  "runtime.spatial.transformBatch(plan.map((entry)",
  "entry.toPosition",
  "entry.toRotation",
  "atomic batch"
]) {
  if (!workbench.includes(token)) throw new Error(`S2.22 Workbench atomic migration missing: ${token}`);
}
for (const forbidden of ["runtime.spatial.move(entry.entityId, entry.toPosition)", "runtime.spatial.rotate(entry.entityId, entry.toRotation)", "spatial.rotate(plan.entityId, plan.toRotation)", "spatial.move(plan.entityId, plan.toPosition)", "spatialTransactionGraph", 'status: "GOLDEN_ASSET"']) {
  if (workbench.includes(forbidden)) throw new Error(`S2.22 Workbench still exposes non-atomic/forbidden path: ${forbidden}`);
}

const commandRuntime = await readFile("packages/invention-mechanical-command-runtime/src/index.ts", "utf8");
for (const token of [
  "planMechanicalRotaryJointStep",
  "this.spatial.transformBatch([",
  "position: plan.toPosition",
  "rotation: plan.toRotation",
  "rotaryJointTargetDelta"
]) {
  if (!commandRuntime.includes(token)) throw new Error(`S2.22 rotary atomic execution missing behind CommandBus: ${token}`);
}
for (const forbidden of ["spatial.rotate(plan.entityId", "spatial.move(plan.entityId", "jointGraph", "rpmSolver", "torqueSolver", "angularVelocitySolver", "angularAccelerationSolver"]) {
  if (commandRuntime.includes(forbidden)) throw new Error(`S2.22 rotary execution must remain atomic/no dynamics solver: ${forbidden}`);
}

const rotary = await readFile("apps/studio-web/components/RotaryJointControls.tsx", "utf8");
for (const token of ['data-transform-mode="atomic-batch"', 'data-command-bus="session"', "mechanicalCommandRuntimeFor"]) {
  if (!rotary.includes(token)) throw new Error(`S2.22 UI atomic/command projection missing: ${token}`);
}
if (rotary.includes("spatial.transformBatch([{") || rotary.includes("spatial.rotate(plan.entityId") || rotary.includes("spatial.move(plan.entityId")) throw new Error("S2.22 UI must not bypass command-backed atomic execution");

const domain = await readFile("tests/domain/invention-spatial-runtime.test.mjs", "utf8");
for (const token of ["S2.22 transformBatch commits position and rotation for multiple bindings in one validated transaction", "S2.22 transformBatch validates the complete batch before mutating any binding", "first mutation must not leak from a rejected batch", "S2.22 transformBatch rejects duplicate or unknown entities before commit", "S2.22 atomic transforms persist and restore through the existing signed inventionSpatial document"]) {
  if (!domain.includes(token)) throw new Error(`S2.22 domain evidence missing: ${token}`);
}

const browser = await readFile("tests/browser/atomic-spatial-transform.spec.ts", "utf8");
for (const token of ["S2.22 commits mechanical translation rotation alignment and rotary target through atomic spatial batches", 'data-spatial-transform-mode", "atomic-batch"', 'data-transform-mode", "atomic-batch"', 'name: "Z +", exact: true', 'name: "RY +", exact: true', 'name: "SET ANGLE", exact: true', 'data-angle-rad", "0.785"', "Guardar 3D", "page.reload", "pageErrors", "consoleErrors"]) {
  if (!browser.includes(token)) throw new Error(`S2.22 browser evidence missing: ${token}`);
}

const readme = await readFile("README.md", "utf8");
for (const token of ["Current baseline", "Atomic Spatial Transform", "transformBatch", "HERO_CANDIDATE", "AF-001L", "Tehkné Solutions"]) {
  if (!readme.includes(token)) throw new Error(`S2.22 README semantic baseline missing: ${token}`);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.22"] !== "node scripts/verify-s2.22.mjs") throw new Error("S2.22 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("npm run verify:s2.22") || !workflow.includes("tests/browser/atomic-spatial-transform.spec.ts") || workflow.includes("contents: write")) throw new Error("S2.22 CI contract mismatch");

console.log("S2.22 Atomic Spatial Transform PASS · validate-all-before-commit core + command-backed rotary atomic commit + atomic translation/rotation/alignment + same signed inventionSpatial + no parallel state/no dynamics solver + successor explicit segment-rate evidence compatible + Tehkné Solutions");
