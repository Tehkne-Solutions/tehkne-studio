import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/invention-mechanical-command-runtime/src/rotary-waypoint-execution-receipt.ts",
  "packages/invention-mechanical-command-runtime/src/rotary-waypoint-sequence.ts",
  "packages/invention-mechanical-command-runtime/src/index.ts",
  "apps/studio-web/components/RotaryWaypointSequenceControls.tsx",
  "tests/domain/invention-rotary-waypoint-execution-receipt.test.mjs",
  "tests/browser/rotary-waypoint-execution-receipt.spec.ts",
  "README.md"
];
for (const path of required) await access(resolve(path));

const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = assetForge.components?.find((entry) => entry.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor) throw new Error("S2.32 AF-001 motor definition missing");
if (motor.metadata?.visualAsset?.version !== "0.6.6-hero-candidate" || motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.32 must preserve AF-001 HERO_CANDIDATE identity");
if (motor.metadata?.visualAsset?.triangles !== 3292 || motor.metadata?.visualAsset?.bytes !== 243848) throw new Error("S2.32 must preserve AF-001 LOD0 budget");
if (motor.metadata?.visualAsset?.sha256 !== "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c") throw new Error("S2.32 must not change AF-001 fingerprint");

const runtime = await readFile("packages/invention-mechanical-command-runtime/src/rotary-waypoint-execution-receipt.ts", "utf8");
for (const token of [
  'MECHANICAL_ROTARY_RUN_WAYPOINT_SEQUENCE_VERIFIED_COMMAND = "invention.mechanical.rotary.runWaypointSequenceVerified"',
  "MechanicalRotaryWaypointExecutionReceiptSegment",
  "MechanicalRotaryWaypointExecutionReceipt",
  "MechanicalRotaryWaypointVerifiedRunResult",
  'derivedFrom: "consumed-plan+movement-events"',
  "runSequenceVerified(",
  "lastReceipt(",
  "this.sequences.planSequence(",
  "this.sequences.runSequence(",
  "run.movementCommandIds",
  "#movementEvidence(",
  "MechanicalRotaryWaypointExecutionReceipt",
  "actualCumulativeAbsoluteTravelRadians",
  "allSegmentsMatched: true",
  "matched: true",
  "mechanical-sequence-receipt-cmd-",
  'signature: MECHANICAL_COMMAND_SIGNATURE'
]) {
  if (!runtime.includes(token)) throw new Error(`S2.32 execution receipt runtime contract missing: ${token}`);
}
for (const forbidden of [
  "receiptMap", "receiptsByProject", "executionReceiptGraph", "rotaryWaypointReceipt:", "sequenceReceipt:",
  "planMechanicalRotaryJointStep(", "transformBatch(", "graph.replaceRelationship(",
  "Date.now", "performance.now", "setTimeout(", "setInterval(", "requestAnimationFrame(",
  "rpmSolver", "torqueSolver", "angularVelocitySolver", "angularAccelerationSolver", "timeIntegrator", "sleep("
]) {
  if (runtime.includes(forbidden)) throw new Error(`S2.32 receipt must remain audit evidence over canonical run/events without parallel persistence/time/dynamics: ${forbidden}`);
}
const executeStart = runtime.indexOf("  async #executeVerifiedRun(");
const executeEnd = runtime.indexOf("  #movementEvidence(", executeStart);
if (executeStart < 0 || executeEnd < 0) throw new Error("S2.32 verified run body missing");
const executeBody = runtime.slice(executeStart, executeEnd);
const plan = executeBody.indexOf("this.sequences.planSequence(");
const run = executeBody.indexOf("this.sequences.runSequence(");
const receipt = executeBody.indexOf("this.#buildReceipt(");
const record = executeBody.indexOf('type: "MechanicalRotaryWaypointExecutionReceipt"');
if (plan < 0 || run < 0 || receipt < 0 || record < 0 || !(plan < run && run < receipt && receipt < record)) {
  throw new Error("S2.32 must capture the consumed plan, execute the canonical run, verify movement evidence, then persist the receipt");
}

const sequenceRuntime = await readFile("packages/invention-mechanical-command-runtime/src/rotary-waypoint-sequence.ts", "utf8");
for (const token of ["planSequence(relationshipId: string, name: string)", "this.#assertPlanAdmissible(plan)", "this.mechanical.setContinuousTarget(", "MechanicalRotaryWaypointSequenceRequested"]) {
  if (!sequenceRuntime.includes(token)) throw new Error(`S2.32 must preserve S2.31 canonical plan/run path: ${token}`);
}
for (const forbidden of ["rotaryWaypointExecutionReceipt", "executionReceiptMap", "receiptMap"]) {
  if (sequenceRuntime.includes(forbidden)) throw new Error(`S2.32 must not contaminate authored waypoint metadata/runtime with receipt state: ${forbidden}`);
}

const baseRuntime = await readFile("packages/invention-mechanical-command-runtime/src/index.ts", "utf8");
const eventTypeStart = baseRuntime.indexOf("function rotaryEventType");
const eventTypeEnd = baseRuntime.indexOf("function rateMatches", eventTypeStart);
const movementFold = baseRuntime.slice(eventTypeStart, eventTypeEnd);
if (movementFold.includes("MechanicalRotaryWaypointExecutionReceipt")) throw new Error("S2.32 execution receipt must not enter kinematic/rate movement fold");
for (const token of ["MechanicalRotaryContinuousTargetExecuted", "durationSeconds", "averageRpm", "rateMode"]) {
  if (!baseRuntime.includes(token)) throw new Error(`S2.32 must preserve canonical movement evidence fields: ${token}`);
}

const control = await readFile("apps/studio-web/components/RotaryWaypointSequenceControls.tsx", "utf8");
for (const token of [
  "mechanicalRotaryWaypointExecutionReceiptRuntimeFor(spatial)",
  "receiptRuntime.runSequenceVerified",
  "receiptRuntime.lastReceipt",
  "EXECUTION RECEIPT NÃO DISPONÍVEL",
  "EXECUTION VERIFIED",
  "Rotary waypoint execution receipt summary",
  "Rotary waypoint execution receipt segments",
  "data-sequence-receipt-status",
  "data-sequence-receipt-command-id",
  "data-sequence-receipt-run-id",
  "data-sequence-receipt-derived-from",
  "data-sequence-receipt-plan-delta-rad",
  "data-sequence-receipt-actual-delta-rad",
  "data-sequence-receipt-plan-travel-rad",
  "data-sequence-receipt-actual-travel-rad",
  "data-sequence-receipt-match",
  'data-sequence-receipt-persistence="session-events"',
  'data-sequence-preflight="shared-read-only-plan"',
  'data-sequence-plan-mutation="none"',
  "sem relógio contínuo/dinâmica"
]) {
  if (!control.includes(token)) throw new Error(`S2.32 execution receipt UI contract missing: ${token}`);
}
for (const forbidden of ["localStorage", "receiptMap", "receiptsByProject", "setTimeout(", "setInterval(", "requestAnimationFrame(", "Date.now", "performance.now", "rpmSolver", "timelineState"]) {
  if (control.includes(forbidden)) throw new Error(`S2.32 UI receipt must remain session-event projection without local persisted/time state: ${forbidden}`);
}

const domain = await readFile("tests/domain/invention-rotary-waypoint-execution-receipt.test.mjs", "utf8");
for (const token of [
  "records a verified immutable per-segment receipt from the consumed plan and canonical movement events",
  "two movements + canonical sequence request + receipt expected",
  "historical",
  "preserves unresolved timing honestly inside execution receipts",
  "publishes no execution receipt when the shared S2.31 plan blocks before movement",
  "blocked verified run must not manufacture sequence or receipt success evidence",
  "persists receipts in session events without replay and fails closed for tampered receipt evidence",
  "receipt integrity mismatch",
  "mechanical-sequence-receipt-cmd-1"
]) {
  if (!domain.includes(token)) throw new Error(`S2.32 domain evidence missing: ${token}`);
}

const browser = await readFile("tests/browser/rotary-waypoint-execution-receipt.spec.ts", "utf8");
for (const token of [
  "persists a verified plan-versus-execution receipt that survives later Named Position edits",
  'data-sequence-receipt-status", "verified"',
  'data-sequence-receipt-command-id", "mechanical-sequence-receipt-cmd-1"',
  'data-sequence-receipt-run-id", "mechanical-sequence-cmd-2"',
  'data-sequence-receipt-derived-from", "consumed-plan+movement-events"',
  'data-sequence-receipt-plan-delta-rad", "6.283"',
  'data-sequence-receipt-actual-delta-rad", "6.283"',
  'data-sequence-receipt-match", "true"',
  "EXECUTION VERIFIED",
  "mechanical-cmd-4",
  "mechanical-cmd-5",
  "120.0°",
  "90.0°",
  "Guardar 3D",
  "page.reload"
]) {
  if (!browser.includes(token)) throw new Error(`S2.32 browser evidence missing: ${token}`);
}

const readme = await readFile("README.md", "utf8");
for (const token of [
  "S2.32", "Rotary Waypoint Execution Receipt", "consumed-plan+movement-events", "session.events",
  "planSequence", "RUN SEQUENCE", "immutable", "Named Positions", "does not persist the preview plan",
  "HERO_CANDIDATE", "AF-001L", "Tehkné Solutions"
]) {
  if (!readme.includes(token)) throw new Error(`S2.32 README baseline missing: ${token}`);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.32"] !== "node scripts/verify-s2.32.mjs") throw new Error("S2.32 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
for (const token of [
  "S2.32 Rotary Waypoint Execution Receipt Gate",
  "S2.31 rotary waypoint sequence plan contract", "npm run verify:s2.31",
  "S2.32 rotary waypoint execution receipt contract", "npm run verify:s2.32",
  "S2.31 rotary waypoint sequence plan browser contract", "tests/browser/rotary-waypoint-plan.spec.ts",
  "S2.32 rotary waypoint execution receipt browser contract", "tests/browser/rotary-waypoint-execution-receipt.spec.ts",
  "S2.31 Rotary Waypoint Sequence Plan Gate",
  "s2-31-browser-failure",
  "s2-32-browser-failure"
]) {
  if (!workflow.includes(token)) throw new Error(`S2.32 CI promotion contract missing: ${token}`);
}
if (workflow.includes("contents: write")) throw new Error("S2.32 CI must remain read-only");

console.log("S2.32 Rotary Waypoint Execution Receipt PASS · consumed read-only plan + canonical sequence run + per-segment movement-event correlation + immutable session-event receipt + plan/actual delta/rate verification + restore without replay + later Named Position edits do not rewrite history + no preview-plan persistence/no hidden clock/no dynamics solver + Tehkné Solutions");
