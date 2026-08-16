import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/invention-mechanical-command-runtime/src/rotary-segment-rate.ts",
  "packages/invention-mechanical-command-runtime/src/index.ts",
  "apps/studio-web/components/RotaryJointControls.tsx",
  "tests/domain/invention-rotary-segment-rate.test.mjs",
  "tests/browser/rotary-segment-rate.spec.ts",
  "README.md"
];
for (const path of required) await access(resolve(path));

const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = assetForge.components?.find((entry) => entry.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor) throw new Error("S2.27 AF-001 motor definition missing");
if (motor.metadata?.visualAsset?.version !== "0.6.6-hero-candidate" || motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.27 must preserve AF-001 HERO_CANDIDATE identity");
if (motor.metadata?.visualAsset?.triangles !== 3292 || motor.metadata?.visualAsset?.bytes !== 243848) throw new Error("S2.27 must preserve AF-001 LOD0 budget");
if (motor.metadata?.visualAsset?.sha256 !== "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c") throw new Error("S2.27 must not change AF-001 fingerprint");

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
  if (!rateMath.includes(token)) throw new Error(`S2.27 pure segment-rate math missing: ${token}`);
}
for (const forbidden of ["Date", "performance", "issuedAt", "occurredAt", "timestamp", "setTimeout", "requestAnimationFrame", "torque", "acceleration", "inertia"]) {
  if (rateMath.includes(forbidden)) throw new Error(`S2.27 segment-rate math must not infer time/dynamics: ${forbidden}`);
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
  "this.#recordEvidence(command, result)",
  "durationSeconds: result.durationSeconds",
  "averageRpm: result.averageRpm"
]) {
  if (!runtime.includes(token)) throw new Error(`S2.27 command duration/rate evidence missing: ${token}`);
}
for (const forbidden of [
  "Date.parse(",
  "performance.now(",
  "getTime()",
  "issuedAt -",
  "occurredAt -",
  "setInterval(",
  "requestAnimationFrame(",
  "torqueSolver",
  "angularAccelerationSolver",
  "momentOfInertia",
  "rpmState",
  "rateByProject",
  "new Map<string, MechanicalRotaryRate"
]) {
  if (runtime.includes(forbidden)) throw new Error(`S2.27 must avoid wall-clock inference/parallel dynamics state: ${forbidden}`);
}
const applyStart = runtime.indexOf("  #apply(");
const applyEnd = runtime.indexOf("  #recordEvidence(", applyStart);
if (applyStart < 0 || applyEnd < 0) throw new Error("S2.27 mechanical apply body missing");
const applyBody = runtime.slice(applyStart, applyEnd);
const limitCheck = applyBody.indexOf("assertWithinTravelLimits(relationshipId, intendedContinuousRadians, limits)");
const rateDerivation = applyBody.indexOf("deriveRotarySegmentRate(deltaRadians, durationSeconds)");
const planner = applyBody.indexOf("planMechanicalRotaryJointStep(");
const transform = applyBody.indexOf("this.spatial.transformBatch");
if (limitCheck < 0 || rateDerivation < 0 || planner < 0 || transform < 0 || !(limitCheck < rateDerivation && rateDerivation < planner && planner < transform)) {
  throw new Error("S2.27 must validate S2.26 travel before rate evidence, planner and spatial mutation");
}
const eventTypeStart = runtime.indexOf("function rotaryEventType");
const eventTypeEnd = runtime.indexOf("function rateMatches", eventTypeStart);
const movementFold = runtime.slice(eventTypeStart, eventTypeEnd);
if (!movementFold.includes("MechanicalRotaryContinuousTargetExecuted")) throw new Error("S2.27 rate fold must include continuous-target motion evidence");
if (movementFold.includes("MechanicalRotaryTravelLimitsSet") || movementFold.includes("MechanicalRotaryTravelLimitsCleared")) {
  throw new Error("S2.27 travel-limit authoring events must not become motion-rate evidence");
}

const control = await readFile("apps/studio-web/components/RotaryJointControls.tsx", "utf8");
for (const token of [
  'aria-label="Rotary joint command duration seconds"',
  "commands.rate(constraint.relationshipId)",
  "data-rate-mode",
  "data-rate-source",
  "data-rate-command-id",
  "data-duration-seconds",
  "data-angular-velocity-rad-s",
  "data-rpm",
  "RATE UNRESOLVED",
  "TAXA MÉDIA",
  "commands.step(constraint.relationshipId, radians, \"ui\", commandDurationSeconds())",
  "commands.setTarget(",
  "commands.setContinuousTarget(",
  "commandDurationSeconds()",
  "commands.travelLimits(constraint.relationshipId)",
  "SET LIMITS",
  "CLEAR LIMITS",
  "sem torque/dinâmica instantânea"
]) {
  if (!control.includes(token)) throw new Error(`S2.27 UI segment-rate projection missing: ${token}`);
}
for (const forbidden of ["Date.now", "performance.now", "setInterval(", "requestAnimationFrame(", "torqueNm", "accelerationRad", "rateByProject"]) {
  if (control.includes(forbidden)) throw new Error(`S2.27 UI must not own a physical clock/dynamics solver: ${forbidden}`);
}

const domain = await readFile("tests/domain/invention-rotary-segment-rate.test.mjs", "utf8");
for (const token of [
  "deterministic segment-average angular rate and RPM only from explicit duration",
  "untimed rotary commands keep rate unresolved instead of inferring from wall-clock timestamps",
  "timed step records and restores segment-average rate through the existing session event stream",
  "timed principal target uses the actual shortest delta and explicit duration for segment rate",
  "timed continuous target uses the exact multi-turn delta instead of the principal representative",
  "latest untimed motion makes rate unresolved even after timed evidence while limit commands do not replace motion evidence",
  "travel-limit rejection is fail closed and cannot publish false timed rate evidence",
  "rejects tampered persisted rate evidence",
  "averageRpm, 5",
  "averageRpm, 30"
]) {
  if (!domain.includes(token)) throw new Error(`S2.27 domain evidence missing: ${token}`);
}

const browser = await readFile("tests/browser/rotary-segment-rate.spec.ts", "utf8");
for (const token of [
  "derives explicit segment-average rotary rate across step principal continuous targets limits and restore",
  'data-rate-mode", "unresolved-no-duration"',
  'data-rate-source", "session-events-explicit-duration"',
  "Rotary joint command duration seconds",
  'duration.fill("0.5")',
  'data-angular-velocity-rad-s", "0.524"',
  'data-rpm", "5.000"',
  'duration.fill("2")',
  'data-limit-command-id", "mechanical-cmd-3"',
  'continuous.fill("435")',
  'duration.fill("12")',
  'continuous.fill("720")',
  'data-rate-command-id", "mechanical-cmd-4"',
  "Guardar 3D",
  "page.reload",
  'data-command-id", "mechanical-cmd-5"',
  "RATE UNRESOLVED"
]) {
  if (!browser.includes(token)) throw new Error(`S2.27 browser evidence missing: ${token}`);
}

const readme = await readFile("README.md", "utf8");
for (const token of [
  "`0.1.0-alpha.1 · S1.12 + S2.27`",
  "Rotary Segment Rate Evidence",
  "durationSeconds",
  "segment-average",
  "RATE UNRESOLVED",
  "wall-clock",
  "Rotary Travel Limits",
  "continuous-absolute",
  "HERO_CANDIDATE",
  "AF-001L",
  "Tehkné Solutions"
]) {
  if (!readme.includes(token)) throw new Error(`S2.27 README baseline missing: ${token}`);
}
if (!readme.includes("does **not** claim instantaneous angular velocity, acceleration, torque or time integration")) {
  throw new Error("S2.27 README must preserve the no-instantaneous-dynamics claim boundary");
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.27"] !== "node scripts/verify-s2.27.mjs") throw new Error("S2.27 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
for (const token of [
  "S2.27 Rotary Segment Rate Evidence Gate",
  "S2.27 rotary segment rate evidence contract",
  "npm run verify:s2.27",
  "S2.27 rotary segment rate evidence browser contract",
  "tests/browser/rotary-segment-rate.spec.ts",
  "s2-27-browser-failure"
]) {
  if (!workflow.includes(token)) throw new Error(`S2.27 CI promotion contract missing: ${token}`);
}
if (workflow.includes("contents: write")) throw new Error("S2.27 CI must remain read-only");

console.log("S2.27 Rotary Segment Rate Evidence PASS · explicit duration → deterministic segment-average rad/s + RPM for step/principal/continuous commands + S2.26 travel-limit precedence + persisted session-event evidence + untimed fail-closed + no wall-clock inference/no torque dynamics + Tehkné Solutions");
