import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/engineering-graph/src/index.ts",
  "packages/invention-mechanical-command-runtime/src/index.ts",
  "apps/studio-web/components/RotaryJointControls.tsx",
  "tests/domain/invention-rotary-travel-limits.test.mjs",
  "tests/browser/rotary-travel-limits.spec.ts",
  "README.md"
];
for (const path of required) await access(resolve(path));

const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = assetForge.components?.find((entry) => entry.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor) throw new Error("S2.26 AF-001 motor definition missing");
if (motor.metadata?.visualAsset?.version !== "0.6.6-hero-candidate" || motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.26 must preserve AF-001 HERO_CANDIDATE identity");
if (motor.metadata?.visualAsset?.triangles !== 3292 || motor.metadata?.visualAsset?.bytes !== 243848) throw new Error("S2.26 must preserve AF-001 LOD0 budget");
if (motor.metadata?.visualAsset?.sha256 !== "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c") throw new Error("S2.26 must not change AF-001 fingerprint");

const graph = await readFile("packages/engineering-graph/src/index.ts", "utf8");
for (const token of [
  "replaceRelationship(relationship: EngineeringRelationship)",
  "Unknown relationship",
  "this.getEntity(relationship.source)",
  "this.getEntity(relationship.target)",
  "this.#relationships.set(relationship.id, relationship)"
]) {
  if (!graph.includes(token)) throw new Error(`S2.26 safe relationship replacement primitive missing: ${token}`);
}

const runtime = await readFile("packages/invention-mechanical-command-runtime/src/index.ts", "utf8");
for (const token of [
  'MECHANICAL_ROTARY_SET_TRAVEL_LIMITS_COMMAND = "invention.mechanical.rotary.setTravelLimits"',
  'MECHANICAL_ROTARY_CLEAR_TRAVEL_LIMITS_COMMAND = "invention.mechanical.rotary.clearTravelLimits"',
  "MechanicalRotaryTravelLimits",
  'mode: "continuous"',
  "minContinuousRadians",
  "maxContinuousRadians",
  "rotaryTravelLimits",
  "travelLimitsFromRelationship",
  "assertWithinTravelLimits",
  "setTravelLimits(",
  "clearTravelLimits(",
  "travelLimits(relationshipId: string)",
  "this.session.commands.register(MECHANICAL_ROTARY_SET_TRAVEL_LIMITS_COMMAND",
  "this.session.commands.register(MECHANICAL_ROTARY_CLEAR_TRAVEL_LIMITS_COMMAND",
  "this.session.graph.replaceRelationship",
  "MechanicalRotaryTravelLimitsSet",
  "MechanicalRotaryTravelLimitsCleared",
  "ROTARY_CONTINUOUS_EPSILON"
]) {
  if (!runtime.includes(token)) throw new Error(`S2.26 travel-limit runtime contract missing: ${token}`);
}
for (const forbidden of [
  "travelLimitMap",
  "travelLimitsByProject",
  "jointLimitState",
  "rotaryLimitGraph",
  "new CommandBus(",
  "clampTravel",
  "rpmSolver",
  "torqueSolver",
  "angularVelocitySolver",
  "angularAccelerationSolver"
]) {
  if (runtime.includes(forbidden)) throw new Error(`S2.26 must keep limits on authoritative relationship metadata and avoid dynamics fiction: ${forbidden}`);
}
const applyStart = runtime.indexOf("  #apply(");
const applyEnd = runtime.indexOf("  #recordEvidence(", applyStart);
if (applyStart < 0 || applyEnd < 0) throw new Error("S2.26 mechanical apply body missing");
const applyBody = runtime.slice(applyStart, applyEnd);
const limitCheck = applyBody.indexOf("assertWithinTravelLimits(relationshipId, intendedContinuousRadians, limits)");
const planner = applyBody.indexOf("planMechanicalRotaryJointStep(");
const transform = applyBody.indexOf("this.spatial.transformBatch");
if (limitCheck < 0 || planner < 0 || transform < 0 || !(limitCheck < planner && limitCheck < transform)) {
  throw new Error("S2.26 travel limits must fail closed before planner and spatial mutation");
}
const eventTypeStart = runtime.indexOf("function rotaryEventType");
const eventTypeEnd = runtime.indexOf("export class InventionMechanicalCommandRuntime", eventTypeStart);
const movementFold = runtime.slice(eventTypeStart, eventTypeEnd);
if (movementFold.includes("MechanicalRotaryTravelLimitsSet") || movementFold.includes("MechanicalRotaryTravelLimitsCleared")) {
  throw new Error("S2.26 travel-limit authoring events must not enter the kinematic fold");
}

const control = await readFile("apps/studio-web/components/RotaryJointControls.tsx", "utf8");
for (const token of [
  "commands.travelLimits(constraint.relationshipId)",
  "commands.setTravelLimits",
  "commands.clearTravelLimits",
  'aria-label="Rotary joint minimum travel degrees"',
  'aria-label="Rotary joint maximum travel degrees"',
  "SET LIMITS",
  "CLEAR LIMITS",
  "data-travel-limited",
  "data-travel-limit-mode",
  "data-travel-min-rad",
  "data-travel-max-rad",
  "data-limit-command-id",
  "CURSO ILIMITADO",
  'data-command-bus="session"',
  'data-transform-mode="atomic-batch"',
  "sem RPM/torque"
]) {
  if (!control.includes(token)) throw new Error(`S2.26 UI limit projection missing: ${token}`);
}
for (const forbidden of ["travelLimitMap", "travelLimitsByProject", "jointLimitState", "setInterval(", "requestAnimationFrame(", "rpm", "angularVelocity", "torqueTarget"]) {
  if (control.includes(forbidden)) throw new Error(`S2.26 UI must not own mechanical travel truth or dynamics: ${forbidden}`);
}

const domain = await readFile("tests/domain/invention-rotary-travel-limits.test.mjs", "utf8");
for (const token of [
  "authors continuous rotary travel limits on the authoritative connectedTo relationship",
  "limit authoring must not enter the kinematic fold",
  "enforces travel limits before any spatial mutation for continuous target principal target and incremental step",
  "blocked continuous target must not mutate inventionSpatial",
  "persists travel limits in graph snapshots restores them without replay and clears them through the same CommandBus",
  "travel authoring/clearing events must not enter kinematic evidence",
  "preserves unlimited rotary shafts when no travel envelope is authored",
  "1080 * DEG"
]) {
  if (!domain.includes(token)) throw new Error(`S2.26 domain evidence missing: ${token}`);
}

const browser = await readFile("tests/browser/rotary-travel-limits.spec.ts", "utf8");
for (const token of [
  "authors persists enforces and clears rotary travel limits without parallel state",
  'data-travel-limited", "false"',
  'data-travel-limited", "true"',
  'data-travel-min-rad", "-3.142"',
  'data-travel-max-rad", "9.425"',
  'continuous.fill("360")',
  'continuous.fill("720")',
  "travel limit exceeded",
  'principal.fill("170")',
  'principal.fill("-170")',
  'data-limit-command-action", "clear"',
  'data-command-id", "mechanical-cmd-7"',
  "Guardar 3D",
  "page.reload"
]) {
  if (!browser.includes(token)) throw new Error(`S2.26 browser evidence missing: ${token}`);
}

const readme = await readFile("README.md", "utf8");
for (const token of ["Current baseline", "S2.26", "Rotary Travel Limits", "rotaryTravelLimits", "connectedTo", "unlimited", "fail closed", "CommandBus", "HERO_CANDIDATE", "AF-001L", "Tehkné Solutions"]) {
  if (!readme.includes(token)) throw new Error(`S2.26 README baseline missing: ${token}`);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.26"] !== "node scripts/verify-s2.26.mjs") throw new Error("S2.26 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("S2.26 rotary travel limits contract")) throw new Error("S2.26 cumulative CI contract step missing");
if (!workflow.includes("npm run verify:s2.26")) throw new Error("S2.26 CI contract missing");
if (!workflow.includes("S2.26 rotary travel limits browser contract")) throw new Error("S2.26 cumulative browser step missing");
if (!workflow.includes("tests/browser/rotary-travel-limits.spec.ts")) throw new Error("S2.26 dedicated browser gate missing from CI");
if (!workflow.includes("s2-26-browser-failure")) throw new Error("S2.26 failure artifact identity missing");
if (workflow.includes("contents: write")) throw new Error("S2.26 CI must remain read-only");

console.log("S2.26 Rotary Travel Limits PASS · optional continuous envelope authored on authoritative connectedTo metadata + CommandBus set/clear + pre-planner fail-closed enforcement + persistence without replay + unlimited shafts preserved + no parallel state/no dynamics fiction + Tehkné Solutions");
