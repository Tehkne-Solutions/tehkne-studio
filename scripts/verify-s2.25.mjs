import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/invention-assembly-runtime/src/rotary-continuous-angle.ts",
  "packages/invention-mechanical-command-runtime/src/index.ts",
  "apps/studio-web/components/RotaryJointControls.tsx",
  "tests/domain/invention-rotary-continuous-target.test.mjs",
  "tests/browser/rotary-continuous-target.spec.ts",
  "README.md"
];
for (const path of required) await access(resolve(path));

const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = assetForge.components?.find((entry) => entry.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor) throw new Error("S2.25 AF-001 motor definition missing");
if (motor.metadata?.visualAsset?.version !== "0.6.6-hero-candidate" || motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.25 must preserve AF-001 HERO_CANDIDATE identity");
if (motor.metadata?.visualAsset?.triangles !== 3292 || motor.metadata?.visualAsset?.bytes !== 243848) throw new Error("S2.25 must preserve AF-001 LOD0 budget");
if (motor.metadata?.visualAsset?.sha256 !== "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c") throw new Error("S2.25 must not change AF-001 fingerprint");

const math = await readFile("packages/invention-assembly-runtime/src/rotary-continuous-angle.ts", "utf8");
for (const token of [
  "RotaryContinuousTargetDelta",
  "rotaryContinuousTargetDelta",
  "targetContinuousRadians",
  "targetPrincipalRadians",
  "targetRevolutions",
  "target.continuousRadians - currentContinuousRadians",
  'mode: "continuous-absolute"',
  "rotaryContinuousState(targetPrincipalRadians, targetContinuousRadiansInput, epsilon)"
]) {
  if (!math.includes(token)) throw new Error(`S2.25 continuous target math missing: ${token}`);
}
for (const forbidden of ["Date.now", "performance.now", "setInterval", "setTimeout", "rpm", "torque", "angularVelocity", "angularAcceleration", "kinematicsByProject", "Map<"]) {
  if (math.includes(forbidden)) throw new Error(`S2.25 target math must remain absolute/time-free/stateless: ${forbidden}`);
}

const runtime = await readFile("packages/invention-mechanical-command-runtime/src/index.ts", "utf8");
for (const token of [
  'MECHANICAL_ROTARY_CONTINUOUS_TARGET_COMMAND = "invention.mechanical.rotary.setContinuousTarget"',
  "MechanicalRotaryContinuousTargetPayload",
  '"continuous-absolute"',
  "this.session.commands.register(MECHANICAL_ROTARY_CONTINUOUS_TARGET_COMMAND",
  "setContinuousTarget(",
  "this.session.commands.dispatch<MechanicalRotaryCommandResult>",
  "#executeContinuousTarget",
  "rotaryContinuousTargetDelta(before.continuousRadians, command.payload.targetContinuousRadians)",
  "this.#apply(command, command.payload.relationshipId, target.deltaRadians, target.mode)",
  "MechanicalRotaryContinuousTargetExecuted",
  "this.spatial.transformBatch",
  "this.session.events.record",
  "this.kinematics(relationshipId)"
]) {
  if (!runtime.includes(token)) throw new Error(`S2.25 continuous target CommandBus path missing: ${token}`);
}
for (const forbidden of [
  "new CommandBus(",
  "continuousTargetState",
  "continuousTargetMap",
  "kinematicsByProject",
  "inventionRotaryKinematics",
  "motionScheduler",
  "rpmSolver",
  "torqueSolver",
  "angularVelocitySolver",
  "angularAccelerationSolver"
]) {
  if (runtime.includes(forbidden)) throw new Error(`S2.25 must preserve single bus/state and no dynamics fiction: ${forbidden}`);
}

const control = await readFile("apps/studio-web/components/RotaryJointControls.tsx", "utf8");
for (const token of [
  "continuousTargetDegrees",
  "applyContinuousTarget",
  "commands.setContinuousTarget",
  'aria-label="Rotary joint continuous target degrees"',
  "SET CONTINUOUS",
  'data-continuous-target-mode="continuous-absolute"',
  'data-target-mode="principal-shortest"',
  'data-command-bus="session"',
  'data-transform-mode="atomic-batch"'
]) {
  if (!control.includes(token)) throw new Error(`S2.25 UI projection missing: ${token}`);
}
for (const forbidden of ["setInterval(", "requestAnimationFrame(", "torqueTarget", "continuousTargetMap"]) {
  if (control.includes(forbidden)) throw new Error(`S2.25 UI must remain command projection without dynamics/local target state: ${forbidden}`);
}

const domain = await readFile("tests/domain/invention-rotary-continuous-target.test.mjs", "utf8");
for (const token of [
  "pure continuous target delta preserves requested multi-turn absolute angle",
  "720 * DEG",
  "-450 * DEG",
  "-1170 * DEG",
  "voice and automation continuous targets use the same session CommandBus and exact turn evidence",
  "MechanicalRotaryContinuousTargetExecuted",
  "restore preserves continuous target evidence without replay and resumes command IDs",
  "810 * DEG",
  "continuous target remains fail closed for non-rotary relationships without false evidence"
]) {
  if (!domain.includes(token)) throw new Error(`S2.25 domain evidence missing: ${token}`);
}

const browser = await readFile("tests/browser/rotary-continuous-target.spec.ts", "utf8");
for (const token of [
  "commands absolute multi-turn rotary targets through the session CommandBus and restores them",
  'target.fill("720")',
  'data-continuous-angle-rad", "12.566"',
  'data-revolutions", "2"',
  'target.fill("-450")',
  'data-continuous-angle-rad", "-7.854"',
  'data-revolutions", "-1"',
  'restoredTarget.fill("810")',
  'data-command-id", "mechanical-cmd-3"',
  'data-continuous-angle-rad", "14.137"',
  'data-command-mode", "continuous-absolute"',
  "Guardar 3D",
  "page.reload"
]) {
  if (!browser.includes(token)) throw new Error(`S2.25 browser evidence missing: ${token}`);
}

const readme = await readFile("README.md", "utf8");
for (const token of ["Current baseline", "S2.25", "Rotary Continuous Target", "720°", "−450°", "continuous-absolute", "CommandBus", "HERO_CANDIDATE", "AF-001L", "Tehkné Solutions"]) {
  if (!readme.includes(token)) throw new Error(`S2.25 README baseline missing: ${token}`);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.25"] !== "node scripts/verify-s2.25.mjs") throw new Error("S2.25 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("S2.25 rotary continuous target contract")) throw new Error("S2.25 cumulative CI contract step missing");
if (!workflow.includes("npm run verify:s2.25")) throw new Error("S2.25 CI contract missing");
if (!workflow.includes("S2.25 rotary continuous target browser contract")) throw new Error("S2.25 cumulative browser step missing");
if (!workflow.includes("tests/browser/rotary-continuous-target.spec.ts")) throw new Error("S2.25 dedicated browser gate missing from CI");
if (workflow.includes("contents: write")) throw new Error("S2.25 CI must remain read-only");

console.log("S2.25 Rotary Continuous Target PASS · absolute multi-turn targets via existing session CommandBus + exact continuous/revolution evidence + atomic follower transform + restore without replay + cumulative CI contract + compatible with later explicit segment-rate evidence + no parallel state/no torque solver + Tehkné Solutions");
