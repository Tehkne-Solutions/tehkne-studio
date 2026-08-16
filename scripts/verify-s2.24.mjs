import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/invention-assembly-runtime/src/rotary-continuous-angle.ts",
  "packages/invention-mechanical-command-runtime/src/index.ts",
  "apps/studio-web/components/RotaryJointControls.tsx",
  "tests/domain/invention-rotary-multiturn.test.mjs",
  "tests/browser/rotary-multiturn-kinematics.spec.ts",
  "README.md"
];
for (const path of required) await access(resolve(path));

const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = assetForge.components?.find((entry) => entry.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor) throw new Error("S2.24 AF-001 motor definition missing");
if (motor.metadata?.visualAsset?.version !== "0.6.6-hero-candidate" || motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.24 must preserve AF-001 HERO_CANDIDATE identity");
if (motor.metadata?.visualAsset?.triangles !== 3292 || motor.metadata?.visualAsset?.bytes !== 243848) throw new Error("S2.24 must preserve AF-001 LOD0 budget");
if (motor.metadata?.visualAsset?.sha256 !== "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c") throw new Error("S2.24 must not change AF-001 fingerprint");

const math = await readFile("packages/invention-assembly-runtime/src/rotary-continuous-angle.ts", "utf8");
for (const token of [
  "ROTARY_TAU",
  "RotaryContinuousState",
  "rotaryContinuousState",
  "advanceRotaryContinuousState",
  "normalizePrincipalAngle",
  "Math.round(turnsFloat)",
  "inconsistent with principal evidence"
]) {
  if (!math.includes(token)) throw new Error(`S2.24 continuous-angle math missing: ${token}`);
}
for (const forbidden of ["Map<", "WeakMap<", "projectId", "localStorage", "rpm", "torque", "angularVelocity", "timestamp"]) {
  if (math.includes(forbidden)) throw new Error(`S2.24 pure kinematics math must remain stateless/time-free: ${forbidden}`);
}

const runtime = await readFile("packages/invention-mechanical-command-runtime/src/index.ts", "utf8");
for (const token of [
  "MechanicalRotaryKinematics extends RotaryContinuousState",
  "beforeContinuousRadians",
  "afterContinuousRadians",
  "beforeRevolutions",
  "afterRevolutions",
  "kinematics(relationshipId: string)",
  'derivedFrom: "session-events+spatial"',
  "this.#rotaryEvidence(relationshipId)",
  "firstPayload.beforeContinuousRadians",
  "firstPayload.beforeRadians",
  "entry.payload.deltaRadians",
  "afterContinuousRadians",
  "rotaryContinuousState(principalRadians, continuousRadians)",
  "advanceRotaryContinuousState(",
  "beforeKinematics.continuousRadians",
  "this.#recordEvidence(command, result)"
]) {
  if (!runtime.includes(token)) throw new Error(`S2.24 command-backed kinematics missing: ${token}`);
}
for (const forbidden of [
  "latestStateByProject",
  "stagedDocumentByProject",
  "stateByProject",
  "kinematicsByProject",
  "new Map<string, Rotary",
  "inventionRotaryKinematics",
  "revolutionGraph",
  "rpmSolver",
  "torqueSolver",
  "angularVelocitySolver"
]) {
  if (runtime.includes(forbidden)) throw new Error(`S2.24 must derive multi-turn state from existing evidence without global/project state: ${forbidden}`);
}

const control = await readFile("apps/studio-web/components/RotaryJointControls.tsx", "utf8");
for (const token of [
  "commands.kinematics(constraint.relationshipId)",
  "data-continuous-angle-rad",
  "data-revolutions",
  'data-kinematics-source={kinematics?.derivedFrom ?? ""}',
  "data-kinematics-evidence",
  "CONTÍNUO",
  "VOLTAS",
  'data-command-bus="session"',
  'data-transform-mode="atomic-batch"',
  "sem RPM/torque"
]) {
  if (!control.includes(token)) throw new Error(`S2.24 UI kinematics projection missing: ${token}`);
}
for (const forbidden of ["useState<number>(0)", "revolutionState", "turnCounter", "localStorage.setItem", "rpm", "angularVelocity"]) {
  if (control.includes(forbidden)) throw new Error(`S2.24 UI must not own multi-turn/dynamic state: ${forbidden}`);
}

const domain = await readFile("tests/domain/invention-rotary-multiturn.test.mjs", "utf8");
for (const token of [
  "pure continuous state reconciles principal angle with integer revolutions",
  "twenty-four 15-degree CommandBus steps produce exactly one continuous revolution",
  "principal target commands preserve shortest-path semantics while advancing continuous turns",
  "restore reconstructs multi-turn state from persisted session events plus spatial evidence without command replay",
  "rejects tampered continuous event evidence"
]) {
  if (!domain.includes(token)) throw new Error(`S2.24 domain evidence missing: ${token}`);
}

const browser = await readFile("tests/browser/rotary-multiturn-kinematics.spec.ts", "utf8");
for (const token of [
  "derives continuous multi-turn angle across repeated steps targets and restore",
  'data-continuous-angle-rad", "6.283"',
  'data-revolutions", "1"',
  'data-continuous-angle-rad", "9.425"',
  'data-continuous-angle-rad", "9.599"',
  'data-revolutions", "2"',
  'data-kinematics-evidence", "26"',
  'data-command-id", "mechanical-cmd-27"',
  "Guardar 3D",
  "page.reload"
]) {
  if (!browser.includes(token)) throw new Error(`S2.24 browser evidence missing: ${token}`);
}

const readme = await readFile("README.md", "utf8");
for (const token of ["Current baseline", "S2.24", "Multi-turn Rotary Kinematics", "session.events", "continuous", "revolutions", "HERO_CANDIDATE", "AF-001L", "Tehkné Solutions"]) {
  if (!readme.includes(token)) throw new Error(`S2.24 README baseline missing: ${token}`);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.24"] !== "node scripts/verify-s2.24.mjs") throw new Error("S2.24 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("npm run verify:s2.24")) throw new Error("S2.24 CI contract missing");
if (!workflow.includes("tests/browser/rotary-multiturn-kinematics.spec.ts")) throw new Error("S2.24 browser gate missing from CI");
if (workflow.includes("contents: write")) throw new Error("S2.24 CI must remain read-only");

console.log("S2.24 Multi-turn Rotary Kinematics PASS · continuous angle + integer revolutions derived from persisted session.events and spatial principal evidence + CommandBus/atomic lineage + no global state/no dynamics fiction + Tehkné Solutions");
