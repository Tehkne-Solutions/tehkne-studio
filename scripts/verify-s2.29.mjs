import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/invention-mechanical-command-runtime/src/rotary-segment-rate.ts",
  "packages/invention-mechanical-command-runtime/src/index.ts",
  "packages/invention-mechanical-command-runtime/src/rotary-home.ts",
  "packages/invention-mechanical-command-runtime/src/rotary-named-positions.ts",
  "apps/studio-web/components/RotaryJointControls.tsx",
  "tests/domain/invention-rotary-segment-rate.test.mjs",
  "tests/domain/invention-rotary-segment-rate-named-position.test.mjs",
  "tests/browser/rotary-segment-rate.spec.ts",
  "tests/browser/rotary-segment-rate-named-position.spec.ts",
  "README.md"
];
for (const path of required) await access(resolve(path));

const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = assetForge.components?.find((entry) => entry.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor) throw new Error("S2.29 AF-001 motor definition missing");
if (motor.metadata?.visualAsset?.version !== "0.6.6-hero-candidate" || motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.29 must preserve AF-001 HERO_CANDIDATE identity");
if (motor.metadata?.visualAsset?.triangles !== 3292 || motor.metadata?.visualAsset?.bytes !== 243848) throw new Error("S2.29 must preserve AF-001 LOD0 budget");
if (motor.metadata?.visualAsset?.sha256 !== "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c") throw new Error("S2.29 must not change AF-001 fingerprint");

const rateMath = await readFile("packages/invention-mechanical-command-runtime/src/rotary-segment-rate.ts", "utf8");
for (const token of [
  "RotarySegmentRateEvidence",
  "validateRotaryDurationSeconds",
  "deriveRotarySegmentRate",
  "deltaRadians / durationSeconds",
  "averageAngularVelocityRadPerSec",
  "averageRpm",
  'mode: "segment-average"',
  'ROTARY_SEGMENT_RATE_SIGNATURE = "Tehkné Solutions"'
]) {
  if (!rateMath.includes(token)) throw new Error(`S2.29 pure segment-rate math missing: ${token}`);
}
for (const forbidden of ["Date", "performance", "issuedAt", "occurredAt", "timestamp", "setTimeout", "requestAnimationFrame", "torque", "acceleration", "inertia"]) {
  if (rateMath.includes(forbidden)) throw new Error(`S2.29 segment-rate math must not infer time/dynamics: ${forbidden}`);
}

const runtime = await readFile("packages/invention-mechanical-command-runtime/src/index.ts", "utf8");
for (const token of [
  "durationSeconds?: number",
  "MechanicalRotaryRateEvidence",
  "rate(relationshipId: string)",
  'mode: "segment-average" | "unresolved-no-duration"',
  'derivedFrom: "session-events-explicit-duration"',
  "deriveRotarySegmentRate(deltaRadians, durationSeconds)",
  "validateRotaryDurationSeconds",
  "averageAngularVelocityRadPerSec",
  "averageRpm",
  "rateMode",
  "MechanicalRotaryContinuousTargetPayload",
  "setContinuousTarget(",
  "assertWithinTravelLimits(relationshipId, intendedContinuousRadians, limits)",
  "durationSeconds: result.durationSeconds",
  "averageRpm: result.averageRpm"
]) {
  if (!runtime.includes(token)) throw new Error(`S2.29 command duration/rate evidence missing: ${token}`);
}
for (const forbidden of [
  "Date.parse(", "performance.now(", "getTime()", "issuedAt -", "occurredAt -", "setInterval(", "requestAnimationFrame(",
  "torqueSolver", "angularAccelerationSolver", "momentOfInertia", "rpmState", "rateByProject", "new Map<string, MechanicalRotaryRate"
]) {
  if (runtime.includes(forbidden)) throw new Error(`S2.29 must avoid wall-clock inference/parallel dynamics state: ${forbidden}`);
}
const applyStart = runtime.indexOf("  #apply(");
const applyEnd = runtime.indexOf("  #recordEvidence(", applyStart);
if (applyStart < 0 || applyEnd < 0) throw new Error("S2.29 mechanical apply body missing");
const applyBody = runtime.slice(applyStart, applyEnd);
const limitCheck = applyBody.indexOf("assertWithinTravelLimits(relationshipId, intendedContinuousRadians, limits)");
const rateDerivation = applyBody.indexOf("deriveRotarySegmentRate(deltaRadians, durationSeconds)");
const planner = applyBody.indexOf("planMechanicalRotaryJointStep(");
const transform = applyBody.indexOf("this.spatial.transformBatch");
if (limitCheck < 0 || rateDerivation < 0 || planner < 0 || transform < 0 || !(limitCheck < rateDerivation && rateDerivation < planner && planner < transform)) {
  throw new Error("S2.29 must validate travel before rate evidence, planner and spatial mutation");
}
const eventTypeStart = runtime.indexOf("function rotaryEventType");
const eventTypeEnd = runtime.indexOf("function rateMatches", eventTypeStart);
const movementFold = runtime.slice(eventTypeStart, eventTypeEnd);
if (!movementFold.includes("MechanicalRotaryContinuousTargetExecuted")) throw new Error("S2.29 rate fold must include continuous-target motion evidence");
for (const forbidden of [
  "MechanicalRotaryTravelLimitsSet", "MechanicalRotaryTravelLimitsCleared",
  "MechanicalRotaryHomeSet", "MechanicalRotaryHomeRequested", "MechanicalRotaryHomeCleared",
  "MechanicalRotaryNamedPositionSaved", "MechanicalRotaryNamedPositionRequested", "MechanicalRotaryNamedPositionDeleted"
]) {
  if (movementFold.includes(forbidden)) throw new Error(`S2.29 non-motion audit event must not become rate evidence: ${forbidden}`);
}

const homeRuntime = await readFile("packages/invention-mechanical-command-runtime/src/rotary-home.ts", "utf8");
for (const token of [
  "MechanicalRotaryGoHomePayload extends MechanicalRotaryHomePayload",
  "readonly durationSeconds?: number",
  "validateRotaryDurationSeconds",
  "goHome(",
  "this.mechanical.setContinuousTarget(",
  "durationSeconds: movement.result.durationSeconds",
  "rateMode: movement.result.rateMode",
  "MechanicalRotaryHomeRequested"
]) {
  if (!homeRuntime.includes(token)) throw new Error(`S2.29 GO HOME duration composition missing: ${token}`);
}

const namedRuntime = await readFile("packages/invention-mechanical-command-runtime/src/rotary-named-positions.ts", "utf8");
for (const token of [
  "readonly durationSeconds?: number",
  "validateRotaryDurationSeconds",
  "goToPosition(",
  "durationSeconds?: number",
  "this.mechanical.setContinuousTarget(",
  "durationSeconds: movement.result.durationSeconds",
  "rateMode: movement.result.rateMode",
  "MechanicalRotaryNamedPositionRequested"
]) {
  if (!namedRuntime.includes(token)) throw new Error(`S2.29 GO POSITION duration composition missing: ${token}`);
}
for (const forbidden of ["Date.parse(", "performance.now(", "rpmSolver", "rateByProject", "positionRateMap"]) {
  if (namedRuntime.includes(forbidden)) throw new Error(`S2.29 Named Position orchestration must not infer/store rate independently: ${forbidden}`);
}

const control = await readFile("apps/studio-web/components/RotaryJointControls.tsx", "utf8");
for (const token of [
  'aria-label="Rotary joint command duration seconds"',
  "commands.rate(constraint.relationshipId)",
  "data-rate-mode", "data-rate-source", "data-rate-command-id", "data-duration-seconds", "data-angular-velocity-rad-s", "data-rpm",
  "RATE UNRESOLVED", "TAXA MÉDIA",
  "commands.step(constraint.relationshipId, radians, \"ui\", commandDurationSeconds())",
  "commands.setTarget(", "commands.setContinuousTarget(",
  "homeCommands.goHome(constraint.relationshipId, \"ui\", commandDurationSeconds())",
  "positionCommands.goToPosition(", "selectedPosition.name", "commandDurationSeconds()",
  "SAVE POSITION", "GO POSITION", "DELETE POSITION",
  "sem torque/aceleração", "sem inferência por wall-clock"
]) {
  if (!control.includes(token)) throw new Error(`S2.29 UI rate composition missing: ${token}`);
}
for (const forbidden of ["Date.now", "performance.now", "setInterval(", "requestAnimationFrame(", "torqueNm", "accelerationRad", "rateByProject"]) {
  if (control.includes(forbidden)) throw new Error(`S2.29 UI must not own physical clock/dynamics state: ${forbidden}`);
}

const domain = await readFile("tests/domain/invention-rotary-segment-rate.test.mjs", "utf8");
for (const token of [
  "derives deterministic segment-average angular rate and RPM only from explicit duration",
  "untimed rotary commands keep rate unresolved instead of inferring from wall-clock timestamps",
  "timed continuous target uses the exact multi-turn delta instead of the principal representative",
  "travel-limit rejection is fail closed and cannot publish false timed rate evidence",
  "GO HOME with explicit duration derives rate from the canonical continuous movement event",
  "rejects tampered persisted rate evidence",
  "averageRpm, 30"
]) {
  if (!domain.includes(token)) throw new Error(`S2.29 inherited rate domain evidence missing: ${token}`);
}
const namedDomain = await readFile("tests/domain/invention-rotary-segment-rate-named-position.test.mjs", "utf8");
for (const token of [
  "S2.29 GO POSITION with explicit duration derives rate from canonical continuous movement and preserves limit precedence",
  "GO POSITION rate must come from canonical movement command",
  "bookmark authoring must not replace movement rate",
  "blocked timed GO POSITION must not mutate inventionSpatial",
  "blocked timed GO POSITION must not replace latest valid movement rate"
]) {
  if (!namedDomain.includes(token)) throw new Error(`S2.29 Named Position rate domain evidence missing: ${token}`);
}

const browser = await readFile("tests/browser/rotary-segment-rate.spec.ts", "utf8");
for (const token of [
  "derives explicit segment-average rotary rate across step targets limits HOME and restore",
  'data-rate-mode", "unresolved-no-duration"',
  "Rotary joint command duration seconds",
  'data-rpm", "5.000"',
  "GO HOME",
  "Guardar 3D",
  "page.reload"
]) {
  if (!browser.includes(token)) throw new Error(`S2.29 inherited Chromium rate evidence missing: ${token}`);
}
const namedBrowser = await readFile("tests/browser/rotary-segment-rate-named-position.spec.ts", "utf8");
for (const token of [
  "S2.29 derives explicit segment-average rate when GO POSITION delegates to canonical continuous movement",
  "GO POSITION",
  'data-rate-command-id", "mechanical-cmd-3"',
  'data-duration-seconds", "6.000"',
  'data-rpm", "5.000"',
  "travel limit exceeded",
  'data-rate-mode", "unresolved-no-duration"'
]) {
  if (!namedBrowser.includes(token)) throw new Error(`S2.29 GO POSITION browser evidence missing: ${token}`);
}

const readme = await readFile("README.md", "utf8");
for (const token of [
  "`0.1.0-alpha.1 · S1.12 + S2.29`",
  "Rotary Segment Rate Evidence (S2.29)", "durationSeconds", "segment-average", "RATE UNRESOLVED", "wall-clock",
  "Rotary Named Positions (S2.28)", "GO HOME", "GO POSITION", "MechanicalRotaryNamedPositionRequested",
  "HERO_CANDIDATE", "AF-001L", "Tehkné Solutions"
]) {
  if (!readme.includes(token)) throw new Error(`S2.29 README baseline missing: ${token}`);
}
if (!readme.includes("does **not** claim instantaneous angular velocity, acceleration, torque or time integration")) {
  throw new Error("S2.29 README must preserve no-instantaneous-dynamics boundary");
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.29"] !== "node scripts/verify-s2.29.mjs") throw new Error("S2.29 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
for (const token of [
  "S2.29 Rotary Segment Rate Evidence Gate",
  "S2.28 rotary named positions contract", "npm run verify:s2.28",
  "S2.29 rotary segment rate evidence contract", "npm run verify:s2.29",
  "S2.28 rotary named positions browser contract", "tests/browser/rotary-named-positions.spec.ts",
  "S2.29 rotary segment rate evidence browser contract", "tests/browser/rotary-segment-rate.spec.ts", "tests/browser/rotary-segment-rate-named-position.spec.ts",
  "s2-29-browser-failure"
]) {
  if (!workflow.includes(token)) throw new Error(`S2.29 CI promotion contract missing: ${token}`);
}
if (workflow.includes("contents: write")) throw new Error("S2.29 CI must remain read-only");

console.log("S2.29 Rotary Segment Rate Evidence PASS · explicit duration → deterministic segment-average rad/s + RPM for step/principal/continuous/GO HOME/GO POSITION + travel-limit precedence + HOME/Named Positions orchestration preserved + persisted canonical movement evidence + untimed fail-closed + no wall-clock inference/no torque dynamics + Tehkné Solutions");
