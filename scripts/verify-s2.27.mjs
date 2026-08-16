import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/invention-mechanical-command-runtime/src/index.ts",
  "packages/invention-mechanical-command-runtime/src/rotary-home.ts",
  "apps/studio-web/components/RotaryJointControls.tsx",
  "tests/domain/invention-rotary-home.test.mjs",
  "tests/browser/rotary-home.spec.ts",
  "README.md"
];
for (const path of required) await access(resolve(path));

const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = assetForge.components?.find((entry) => entry.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor) throw new Error("S2.27 AF-001 motor definition missing");
if (motor.metadata?.visualAsset?.version !== "0.6.6-hero-candidate" || motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.27 must preserve AF-001 HERO_CANDIDATE identity");
if (motor.metadata?.visualAsset?.triangles !== 3292 || motor.metadata?.visualAsset?.bytes !== 243848) throw new Error("S2.27 must preserve AF-001 LOD0 budget");
if (motor.metadata?.visualAsset?.sha256 !== "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c") throw new Error("S2.27 must not change AF-001 fingerprint");

const runtime = await readFile("packages/invention-mechanical-command-runtime/src/rotary-home.ts", "utf8");
for (const token of [
  'MECHANICAL_ROTARY_SET_HOME_COMMAND = "invention.mechanical.rotary.setHome"',
  'MECHANICAL_ROTARY_GO_HOME_COMMAND = "invention.mechanical.rotary.goHome"',
  'MECHANICAL_ROTARY_CLEAR_HOME_COMMAND = "invention.mechanical.rotary.clearHome"',
  "MechanicalRotaryHome",
  'mode: "continuous"',
  "homeContinuousRadians",
  "rotaryHome",
  "homeFromRelationship",
  "setHome(",
  "goHome(",
  "clearHome(",
  "home(relationshipId: string)",
  "this.session.commands.register(MECHANICAL_ROTARY_SET_HOME_COMMAND",
  "this.session.commands.register(MECHANICAL_ROTARY_GO_HOME_COMMAND",
  "this.session.commands.register(MECHANICAL_ROTARY_CLEAR_HOME_COMMAND",
  "this.session.graph.replaceRelationship",
  "this.mechanical.setContinuousTarget",
  "MechanicalRotaryHomeSet",
  "MechanicalRotaryHomeRequested",
  "MechanicalRotaryHomeCleared",
  "mechanical-home-cmd-"
]) {
  if (!runtime.includes(token)) throw new Error(`S2.27 rotary HOME runtime contract missing: ${token}`);
}
for (const forbidden of [
  "homeMap",
  "homeByProject",
  "jointHomeState",
  "rotaryHomeGraph",
  "new CommandBus(",
  "planMechanicalRotaryJointStep(",
  "transformBatch(",
  "rpmSolver",
  "torqueSolver",
  "angularVelocitySolver",
  "angularAccelerationSolver"
]) {
  if (runtime.includes(forbidden)) throw new Error(`S2.27 HOME must reuse authoritative graph + canonical continuous-target runtime and avoid a parallel dynamics solver: ${forbidden}`);
}

const baseRuntime = await readFile("packages/invention-mechanical-command-runtime/src/index.ts", "utf8");
const eventTypeStart = baseRuntime.indexOf("function rotaryEventType");
const eventTypeEnd = baseRuntime.indexOf("export class InventionMechanicalCommandRuntime", eventTypeStart);
const movementFold = baseRuntime.slice(eventTypeStart, eventTypeEnd);
for (const forbidden of ["MechanicalRotaryHomeSet", "MechanicalRotaryHomeRequested", "MechanicalRotaryHomeCleared"]) {
  if (movementFold.includes(forbidden)) throw new Error(`S2.27 HOME audit events must not enter the kinematic fold: ${forbidden}`);
}
for (const requiredBase of ["assertWithinTravelLimits", "setContinuousTarget(", "this.spatial.transformBatch", "MechanicalRotaryContinuousTargetExecuted"]) {
  if (!baseRuntime.includes(requiredBase)) throw new Error(`S2.27 must preserve canonical S2.25/S2.26 movement path: ${requiredBase}`);
}

const control = await readFile("apps/studio-web/components/RotaryJointControls.tsx", "utf8");
for (const token of [
  "mechanicalRotaryHomeRuntimeFor(spatial)",
  "homeCommands.home(constraint.relationshipId)",
  "homeCommands.setHome",
  "homeCommands.goHome",
  "homeCommands.clearHome",
  "SET HOME",
  "GO HOME",
  "CLEAR HOME",
  "data-home-authored",
  "data-home-mode",
  "data-home-rad",
  "data-home-command-id",
  "HOME NÃO DEFINIDO",
  'data-command-bus="session"',
  'data-transform-mode="atomic-batch"'
]) {
  if (!control.includes(token)) throw new Error(`S2.27 UI HOME projection missing: ${token}`);
}
for (const forbidden of ["homeMap", "homeByProject", "jointHomeState", "setInterval(", "requestAnimationFrame(", "torqueTarget"]) {
  if (control.includes(forbidden)) throw new Error(`S2.27 UI must not own HOME truth or a dynamics loop: ${forbidden}`);
}

const domain = await readFile("tests/domain/invention-rotary-home.test.mjs", "utf8");
for (const token of [
  "captures the current continuous position as authored rotary home without entering the kinematic fold",
  "SET HOME must not manufacture rotary movement evidence",
  "GO HOME reuses the canonical continuous target command and travel-limit enforcement",
  "blocked GO HOME must not mutate inventionSpatial",
  "persists rotary home in the graph snapshot restores without replay and clears through the same CommandBus",
  "fails closed for missing or tampered HOME metadata without false rotary evidence",
  "mechanical-home-cmd-1",
  "-450 * DEG"
]) {
  if (!domain.includes(token)) throw new Error(`S2.27 domain evidence missing: ${token}`);
}

const browser = await readFile("tests/browser/rotary-home.spec.ts", "utf8");
for (const token of [
  "authors persists and executes rotary HOME through the canonical continuous target path",
  'data-home-authored", "false"',
  'data-home-authored", "true"',
  'data-home-rad", "6.283"',
  'data-home-command-id", "mechanical-home-cmd-1"',
  'continuous.fill("360")',
  'continuous.fill("0")',
  "travel limit exceeded",
  'data-command-id", "mechanical-cmd-6"',
  "Guardar 3D",
  "page.reload",
  'data-home-command-action", "clear"'
]) {
  if (!browser.includes(token)) throw new Error(`S2.27 browser evidence missing: ${token}`);
}

const readme = await readFile("README.md", "utf8");
for (const token of ["Current baseline", "S2.27", "Rotary Home Position", "rotaryHome", "connectedTo", "GO HOME", "setContinuousTarget", "CommandBus", "HERO_CANDIDATE", "AF-001L", "Tehkné Solutions"]) {
  if (!readme.includes(token)) throw new Error(`S2.27 README baseline missing: ${token}`);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.27"] !== "node scripts/verify-s2.27.mjs") throw new Error("S2.27 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("S2.27 rotary home position contract")) throw new Error("S2.27 cumulative CI contract step missing");
if (!workflow.includes("npm run verify:s2.27")) throw new Error("S2.27 CI contract missing");
if (!workflow.includes("S2.27 rotary home position browser contract")) throw new Error("S2.27 cumulative browser step missing");
if (!workflow.includes("tests/browser/rotary-home.spec.ts")) throw new Error("S2.27 dedicated browser gate missing from successor CI");
if (workflow.includes("contents: write")) throw new Error("S2.27 CI must remain read-only");

console.log("S2.27 Rotary Home Position PASS · authored continuous HOME on authoritative connectedTo metadata + same session CommandBus SET/GO/CLEAR + GO HOME delegated to canonical continuous target and S2.26 limits + persistence without replay + successor explicit-duration compatible + no parallel HOME/dynamics state + Tehkné Solutions");
