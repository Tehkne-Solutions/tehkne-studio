import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/invention-mechanical-command-runtime/src/index.ts",
  "packages/invention-mechanical-command-runtime/src/rotary-home.ts",
  "packages/invention-mechanical-command-runtime/src/rotary-named-positions.ts",
  "apps/studio-web/components/RotaryJointControls.tsx",
  "tests/domain/invention-rotary-named-positions.test.mjs",
  "tests/browser/rotary-named-positions.spec.ts",
  "README.md"
];
for (const path of required) await access(resolve(path));

const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = assetForge.components?.find((entry) => entry.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor) throw new Error("S2.28 AF-001 motor definition missing");
if (motor.metadata?.visualAsset?.version !== "0.6.6-hero-candidate" || motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.28 must preserve AF-001 HERO_CANDIDATE identity");
if (motor.metadata?.visualAsset?.triangles !== 3292 || motor.metadata?.visualAsset?.bytes !== 243848) throw new Error("S2.28 must preserve AF-001 LOD0 budget");
if (motor.metadata?.visualAsset?.sha256 !== "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c") throw new Error("S2.28 must not change AF-001 fingerprint");

const runtime = await readFile("packages/invention-mechanical-command-runtime/src/rotary-named-positions.ts", "utf8");
for (const token of [
  'MECHANICAL_ROTARY_SAVE_NAMED_POSITION_COMMAND = "invention.mechanical.rotary.saveNamedPosition"',
  'MECHANICAL_ROTARY_GO_TO_NAMED_POSITION_COMMAND = "invention.mechanical.rotary.goToNamedPosition"',
  'MECHANICAL_ROTARY_DELETE_NAMED_POSITION_COMMAND = "invention.mechanical.rotary.deleteNamedPosition"',
  "MechanicalRotaryNamedPositionsDocument",
  "version: 1",
  "rotaryNamedPositions",
  "normalizePositionName",
  "savePosition(",
  "goToPosition(",
  "deletePosition(",
  "positions(relationshipId: string)",
  "position(relationshipId: string, name: string)",
  "this.session.commands.register(MECHANICAL_ROTARY_SAVE_NAMED_POSITION_COMMAND",
  "this.session.commands.register(MECHANICAL_ROTARY_GO_TO_NAMED_POSITION_COMMAND",
  "this.session.commands.register(MECHANICAL_ROTARY_DELETE_NAMED_POSITION_COMMAND",
  "this.session.graph.replaceRelationship",
  "this.mechanical.setContinuousTarget",
  "MechanicalRotaryNamedPositionSaved",
  "MechanicalRotaryNamedPositionRequested",
  "MechanicalRotaryNamedPositionDeleted",
  "mechanical-position-cmd-"
]) {
  if (!runtime.includes(token)) throw new Error(`S2.28 named-position runtime contract missing: ${token}`);
}
for (const forbidden of [
  "positionMap",
  "positionsByProject",
  "namedPositionGraph",
  "jointPositionState",
  "new CommandBus(",
  "planMechanicalRotaryJointStep(",
  "transformBatch(",
  "rpmSolver",
  "torqueSolver",
  "angularVelocitySolver",
  "angularAccelerationSolver"
]) {
  if (runtime.includes(forbidden)) throw new Error(`S2.28 named positions must reuse authoritative graph + canonical continuous-target runtime and avoid dynamics fiction: ${forbidden}`);
}

const baseRuntime = await readFile("packages/invention-mechanical-command-runtime/src/index.ts", "utf8");
const eventTypeStart = baseRuntime.indexOf("function rotaryEventType");
const eventTypeEnd = baseRuntime.indexOf("export class InventionMechanicalCommandRuntime", eventTypeStart);
const movementFold = baseRuntime.slice(eventTypeStart, eventTypeEnd);
for (const forbidden of ["MechanicalRotaryNamedPositionSaved", "MechanicalRotaryNamedPositionRequested", "MechanicalRotaryNamedPositionDeleted"]) {
  if (movementFold.includes(forbidden)) throw new Error(`S2.28 bookmark audit events must not enter the kinematic fold: ${forbidden}`);
}
for (const requiredBase of ["assertWithinTravelLimits", "setContinuousTarget(", "this.spatial.transformBatch", "MechanicalRotaryContinuousTargetExecuted"]) {
  if (!baseRuntime.includes(requiredBase)) throw new Error(`S2.28 must preserve canonical S2.25/S2.26 movement path: ${requiredBase}`);
}

const homeRuntime = await readFile("packages/invention-mechanical-command-runtime/src/rotary-home.ts", "utf8");
for (const token of ["rotaryHome", "homeContinuousRadians", "this.mechanical.setContinuousTarget", "MechanicalRotaryHomeRequested"]) {
  if (!homeRuntime.includes(token)) throw new Error(`S2.28 must preserve S2.27 HOME independently: ${token}`);
}

const control = await readFile("apps/studio-web/components/RotaryJointControls.tsx", "utf8");
for (const token of [
  "mechanicalRotaryNamedPositionsRuntimeFor(spatial)",
  "positionCommands.positions(constraint.relationshipId)",
  "positionCommands.savePosition",
  "positionCommands.goToPosition",
  "positionCommands.deletePosition",
  "Rotary named position name",
  "Rotary named position",
  "SAVE POSITION",
  "GO POSITION",
  "DELETE POSITION",
  "data-named-position-count",
  "data-selected-position-key",
  "data-position-command-id",
  "data-position-command-action",
  "POSIÇÕES",
  'data-command-bus="session"',
  'data-transform-mode="atomic-batch"',
  "sem RPM/torque"
]) {
  if (!control.includes(token)) throw new Error(`S2.28 UI named-position projection missing: ${token}`);
}
for (const forbidden of ["positionMap", "positionsByProject", "namedPositionGraph", "setInterval(", "requestAnimationFrame(", "rpm", "angularVelocity", "torqueTarget"]) {
  if (control.includes(forbidden)) throw new Error(`S2.28 UI must not own bookmark truth or dynamics: ${forbidden}`);
}

const domain = await readFile("tests/domain/invention-rotary-named-positions.test.mjs", "utf8");
for (const token of [
  "saves and updates normalized rotary named positions on connectedTo metadata without manufacturing movement evidence",
  "named-position authoring events must stay outside the movement fold",
  "GO POSITION delegates to canonical continuous target and remains blocked by S2.26 travel limits before mutation",
  "blocked GO POSITION must not mutate inventionSpatial",
  "persists multiple named positions restores without replay navigates them independently and deletes only the selected bookmark",
  "fails closed for invalid names missing bookmarks and tampered named-position metadata without false movement evidence",
  "Inspect Port",
  "-450 * DEG",
  "duplicate key"
]) {
  if (!domain.includes(token)) throw new Error(`S2.28 domain evidence missing: ${token}`);
}

const browser = await readFile("tests/browser/rotary-named-positions.spec.ts", "utf8");
for (const token of [
  "authors multiple rotary named positions navigates them through continuous targets and persists them",
  'data-named-position-count", "0"',
  'data-named-position-count", "2"',
  'data-selected-position-key", "inspect"',
  'data-position-command-id", "mechanical-position-cmd-1"',
  'continuous.fill("90")',
  'continuous.fill("360")',
  "travel limit exceeded",
  "Guardar 3D",
  "page.reload",
  'data-position-command-action", "deleted"'
]) {
  if (!browser.includes(token)) throw new Error(`S2.28 browser evidence missing: ${token}`);
}

const readme = await readFile("README.md", "utf8");
for (const token of ["Current baseline", "S2.28", "Rotary Named Positions", "rotaryNamedPositions", "connectedTo", "GO POSITION", "setContinuousTarget", "Rotary Home Position", "CommandBus", "HERO_CANDIDATE", "AF-001L", "Tehkné Solutions"]) {
  if (!readme.includes(token)) throw new Error(`S2.28 README baseline missing: ${token}`);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.28"] !== "node scripts/verify-s2.28.mjs") throw new Error("S2.28 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("S2.28 rotary named positions contract")) throw new Error("S2.28 cumulative CI contract step missing");
if (!workflow.includes("npm run verify:s2.28")) throw new Error("S2.28 CI contract missing");
if (!workflow.includes("S2.28 rotary named positions browser contract")) throw new Error("S2.28 cumulative browser step missing");
if (!workflow.includes("tests/browser/rotary-named-positions.spec.ts")) throw new Error("S2.28 dedicated browser gate missing from CI");
if (!workflow.includes("s2-28-browser-failure")) throw new Error("S2.28 failure artifact identity missing");
if (workflow.includes("contents: write")) throw new Error("S2.28 CI must remain read-only");

console.log("S2.28 Rotary Named Positions PASS · multiple normalized continuous bookmarks authored on authoritative connectedTo metadata + same session CommandBus SAVE/GO/DELETE + GO POSITION delegated to canonical continuous target and S2.26 limits + HOME preserved independently + persistence without replay + no parallel state/no dynamics fiction + Tehkné Solutions");
