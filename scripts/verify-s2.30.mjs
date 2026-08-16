import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/invention-mechanical-command-runtime/src/rotary-waypoint-sequence.ts",
  "packages/invention-mechanical-command-runtime/src/rotary-named-positions.ts",
  "packages/invention-mechanical-command-runtime/src/index.ts",
  "apps/studio-web/components/RotaryJointControls.tsx",
  "apps/studio-web/components/RotaryWaypointSequenceControls.tsx",
  "tests/domain/invention-rotary-waypoint-sequence.test.mjs",
  "tests/browser/rotary-waypoint-sequence.spec.ts",
  "README.md"
];
for (const path of required) await access(resolve(path));

const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = assetForge.components?.find((entry) => entry.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor) throw new Error("S2.30 AF-001 motor definition missing");
if (motor.metadata?.visualAsset?.version !== "0.6.6-hero-candidate" || motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.30 must preserve AF-001 HERO_CANDIDATE identity");
if (motor.metadata?.visualAsset?.triangles !== 3292 || motor.metadata?.visualAsset?.bytes !== 243848) throw new Error("S2.30 must preserve AF-001 LOD0 budget");
if (motor.metadata?.visualAsset?.sha256 !== "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c") throw new Error("S2.30 must not change AF-001 fingerprint");

const runtime = await readFile("packages/invention-mechanical-command-runtime/src/rotary-waypoint-sequence.ts", "utf8");
for (const token of [
  'MECHANICAL_ROTARY_SAVE_WAYPOINT_SEQUENCE_COMMAND = "invention.mechanical.rotary.saveWaypointSequence"',
  'MECHANICAL_ROTARY_RUN_WAYPOINT_SEQUENCE_COMMAND = "invention.mechanical.rotary.runWaypointSequence"',
  'MECHANICAL_ROTARY_DELETE_WAYPOINT_SEQUENCE_COMMAND = "invention.mechanical.rotary.deleteWaypointSequence"',
  "MechanicalRotaryWaypointSequencesDocument",
  "rotaryWaypointSequences",
  "MAX_WAYPOINTS = 32",
  "positionKey",
  "positionName",
  "durationSeconds",
  "saveSequence(",
  "runSequence(",
  "deleteSequence(",
  "sequences(relationshipId: string)",
  "sequence(relationshipId: string, name: string)",
  "this.namedPositions.position",
  "#preflightTravel",
  "this.mechanical.travelLimits(relationshipId)",
  "ROTARY_CONTINUOUS_EPSILON",
  "this.mechanical.setContinuousTarget(",
  "movementCommandIds",
  "finalMovementCommandId",
  "finalRateMode",
  "MechanicalRotaryWaypointSequenceSaved",
  "MechanicalRotaryWaypointSequenceRequested",
  "MechanicalRotaryWaypointSequenceDeleted",
  "mechanical-sequence-cmd-",
  'signature: MECHANICAL_COMMAND_SIGNATURE'
]) {
  if (!runtime.includes(token)) throw new Error(`S2.30 waypoint sequence runtime contract missing: ${token}`);
}
for (const forbidden of [
  "new CommandBus(", "sequenceMap", "sequencesByProject", "waypointGraph", "motionTimeline", "timelineState",
  "planMechanicalRotaryJointStep(", "transformBatch(", "Date.now", "performance.now", "setTimeout(", "setInterval(", "requestAnimationFrame(",
  "rpmSolver", "torqueSolver", "angularVelocitySolver", "angularAccelerationSolver", "timeIntegrator", "sleep("
]) {
  if (runtime.includes(forbidden)) throw new Error(`S2.30 sequence runtime must remain orchestration without parallel state/time/dynamics: ${forbidden}`);
}
const preflight = runtime.indexOf("this.#preflightTravel(command.payload.relationshipId, resolved)");
const loop = runtime.indexOf("for (const waypoint of resolved)", preflight);
const movement = runtime.indexOf("this.mechanical.setContinuousTarget(", loop);
if (preflight < 0 || loop < 0 || movement < 0 || !(preflight < loop && loop < movement)) {
  throw new Error("S2.30 must preflight all waypoints before the first canonical movement command");
}

const baseRuntime = await readFile("packages/invention-mechanical-command-runtime/src/index.ts", "utf8");
const eventTypeStart = baseRuntime.indexOf("function rotaryEventType");
const eventTypeEnd = baseRuntime.indexOf("function rateMatches", eventTypeStart);
const movementFold = baseRuntime.slice(eventTypeStart, eventTypeEnd);
for (const forbidden of ["MechanicalRotaryWaypointSequenceSaved", "MechanicalRotaryWaypointSequenceRequested", "MechanicalRotaryWaypointSequenceDeleted"]) {
  if (movementFold.includes(forbidden)) throw new Error(`S2.30 sequence audit event must not enter kinematic/rate movement fold: ${forbidden}`);
}
for (const token of ["rate(relationshipId: string)", "setContinuousTarget(", "assertWithinTravelLimits", "this.spatial.transformBatch"]) {
  if (!baseRuntime.includes(token)) throw new Error(`S2.30 must preserve S2.29 canonical movement/rate path: ${token}`);
}

const namedRuntime = await readFile("packages/invention-mechanical-command-runtime/src/rotary-named-positions.ts", "utf8");
for (const token of ["rotaryNamedPositions", "position(relationshipId: string, name: string)", "this.mechanical.setContinuousTarget("]) {
  if (!namedRuntime.includes(token)) throw new Error(`S2.30 must preserve live S2.28 Named Position authority: ${token}`);
}

const control = await readFile("apps/studio-web/components/RotaryWaypointSequenceControls.tsx", "utf8");
for (const token of [
  "mechanicalRotaryWaypointSequenceRuntimeFor(spatial)",
  "mechanicalRotaryNamedPositionsRuntimeFor(spatial)",
  "DraftWaypoint",
  "draft.length >= 32",
  "Rotary waypoint sequence name",
  "Rotary waypoint position",
  "Rotary waypoint duration seconds",
  "Rotary waypoint draft",
  "ADD WAYPOINT",
  "UNDO WAYPOINT",
  "CLEAR DRAFT",
  "SAVE SEQUENCE",
  "RUN SEQUENCE",
  "DELETE SEQUENCE",
  "data-waypoint-sequence-count",
  "data-waypoint-draft-count",
  "data-sequence-run-steps",
  "data-sequence-final-movement-id",
  "data-sequence-final-rate-mode",
  'data-command-bus="session"',
  'data-sequence-execution="canonical-continuous-targets"',
  'data-sequence-preflight="travel-limits-all-waypoints"',
  "sem relógio contínuo/dinâmica"
]) {
  if (!control.includes(token)) throw new Error(`S2.30 waypoint sequence UI contract missing: ${token}`);
}
for (const forbidden of ["localStorage", "setInterval(", "setTimeout(", "requestAnimationFrame(", "Date.now", "performance.now", "rpmSolver", "timelineState"]) {
  if (control.includes(forbidden)) throw new Error(`S2.30 UI draft must not become persisted/time/dynamics truth: ${forbidden}`);
}
const parentControl = await readFile("apps/studio-web/components/RotaryJointControls.tsx", "utf8");
for (const token of ["RotaryWaypointSequenceControls", "relationshipId={constraint.relationshipId}", "spatial={spatial}", "ready={ready}", "onChanged={onChanged}", "onBlocked={onBlocked}"]) {
  if (!parentControl.includes(token)) throw new Error(`S2.30 rotary control composition missing: ${token}`);
}

const domain = await readFile("tests/domain/invention-rotary-waypoint-sequence.test.mjs", "utf8");
for (const token of [
  "authors normalized ordered waypoint sequences on connectedTo metadata without manufacturing movement evidence",
  "sequence authoring must remain outside movement fold",
  "RUN SEQUENCE executes canonical continuous targets in order and leaves rate authority on the final movement segment",
  "two canonical movement events plus one sequence request event expected",
  "preflights every waypoint against travel limits before the first sequence movement",
  "preflight failure must preserve inventionSpatial before waypoint 1",
  "persists sequences without replay resolves bookmarks live and fails closed for missing or tampered references",
  "updating bookmark should not require rewriting sequence",
  "signature mismatch",
  "averageRpm, 5"
]) {
  if (!domain.includes(token)) throw new Error(`S2.30 domain evidence missing: ${token}`);
}

const browser = await readFile("tests/browser/rotary-waypoint-sequence.spec.ts", "utf8");
for (const token of [
  "authors persists and runs ordered Named Position waypoints with travel preflight",
  'data-waypoint-sequence-count", "0"',
  'data-waypoint-draft-count", "2"',
  "Inspection Cycle",
  "Inspect · 3.000 s",
  "Load · 9.000 s",
  "SAVE SEQUENCE",
  "RUN SEQUENCE",
  'data-sequence-run-steps", "2"',
  'data-sequence-final-movement-id", "mechanical-cmd-5"',
  'data-rpm", "5.000"',
  "Guardar 3D",
  "page.reload",
  "waypoint sequence travel limit exceeded",
  "DELETE SEQUENCE"
]) {
  if (!browser.includes(token)) throw new Error(`S2.30 browser evidence missing: ${token}`);
}

const readme = await readFile("README.md", "utf8");
for (const token of [
  "`0.1.0-alpha.1 · S1.12 + S2.30`",
  "Rotary Waypoint Sequence (S2.30)",
  "rotaryWaypointSequences",
  "SAVE SEQUENCE",
  "RUN SEQUENCE",
  "DELETE SEQUENCE",
  "preflight",
  "Named Positions",
  "segment-average",
  "does not wait",
  "HERO_CANDIDATE",
  "AF-001L",
  "Tehkné Solutions"
]) {
  if (!readme.includes(token)) throw new Error(`S2.30 README baseline missing: ${token}`);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.30"] !== "node scripts/verify-s2.30.mjs") throw new Error("S2.30 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
for (const token of [
  "S2.30 Rotary Waypoint Sequence Gate",
  "S2.29 rotary segment rate evidence contract", "npm run verify:s2.29",
  "S2.30 rotary waypoint sequence contract", "npm run verify:s2.30",
  "S2.29 rotary segment rate evidence browser contract", "tests/browser/rotary-segment-rate.spec.ts",
  "S2.30 rotary waypoint sequence browser contract", "tests/browser/rotary-waypoint-sequence.spec.ts",
  "s2-30-browser-failure"
]) {
  if (!workflow.includes(token)) throw new Error(`S2.30 CI promotion contract missing: ${token}`);
}
if (workflow.includes("contents: write")) throw new Error("S2.30 CI must remain read-only");

console.log("S2.30 Rotary Waypoint Sequence PASS · ordered live Named Position references + optional explicit segment durations + all-waypoint travel preflight + canonical continuous-target execution + final-segment rate authority + persistence without replay + metadata-only authoring + no hidden clock/no dynamics solver + Tehkné Solutions");
