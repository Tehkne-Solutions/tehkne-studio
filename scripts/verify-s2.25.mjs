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
if (!motor) throw new Error("S2.25 AF-001 motor definition missing");
if (motor.metadata?.visualAsset?.version !== "0.6.6-hero-candidate" || motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.25 must preserve AF-001 HERO_CANDIDATE identity");
if (motor.metadata?.visualAsset?.triangles !== 3292 || motor.metadata?.visualAsset?.bytes !== 243848) throw new Error("S2.25 must preserve AF-001 LOD0 budget");
if (motor.metadata?.visualAsset?.sha256 !== "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c") throw new Error("S2.25 must not change AF-001 fingerprint");

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
  if (!rateMath.includes(token)) throw new Error(`S2.25 pure segment-rate math missing: ${token}`);
}
for (const forbidden of ["Date", "performance", "issuedAt", "occurredAt", "timestamp", "setTimeout", "requestAnimationFrame", "torque", "acceleration", "inertia"]) {
  if (rateMath.includes(forbidden)) throw new Error(`S2.25 segment-rate math must not infer time/dynamics: ${forbidden}`);
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
  "this.#recordEvidence(command, result)",
  "durationSeconds: result.durationSeconds",
  "averageRpm: result.averageRpm"
]) {
  if (!runtime.includes(token)) throw new Error(`S2.25 command duration/rate evidence missing: ${token}`);
}
for (const forbidden of [
  "Date.parse(",
  "performance.now(",
  "getTime()",
  "issuedAt -",
  "occurredAt -",
  "torqueSolver",
  "angularAcceleration",
  "momentOfInertia",
  "rpmState",
  "rateByProject",
  "new Map<string, MechanicalRotaryRate"
]) {
  if (runtime.includes(forbidden)) throw new Error(`S2.25 must avoid wall-clock inference/parallel dynamics state: ${forbidden}`);
}

const control = await readFile("apps/studio-web/components/RotaryJointControls.tsx", "utf8");
for (const token of [
  'aria-label="Rotary command duration seconds"',
  "commands.rate(constraint.relationshipId)",
  "data-rate-mode",
  "data-rate-source",
  "data-duration-seconds",
  "data-angular-velocity-rad-s",
  "data-rpm",
  "RATE UNRESOLVED",
  "TAXA MÉDIA",
  "sem torque/aceleração",
  "sem inferência por wall-clock",
  "commands.step(constraint.relationshipId, radians, \"ui\", commandDurationSeconds())",
  "commands.setTarget(constraint.relationshipId, degrees * Math.PI / 180, \"ui\", commandDurationSeconds())"
]) {
  if (!control.includes(token)) throw new Error(`S2.25 UI segment-rate projection missing: ${token}`);
}
for (const forbidden of ["Date.now", "performance.now", "setInterval", "requestAnimationFrame", "torqueNm", "accelerationRad"]) {
  if (control.includes(forbidden)) throw new Error(`S2.25 UI must not own a physical clock/dynamics solver: ${forbidden}`);
}

const domain = await readFile("tests/domain/invention-rotary-segment-rate.test.mjs", "utf8");
for (const token of [
  "deterministic segment-average angular rate and RPM only from explicit duration",
  "untimed rotary commands keep rate unresolved instead of inferring from wall-clock timestamps",
  "timed step records and restores segment-average rate through the existing session event stream",
  "timed principal target uses the actual shortest delta and explicit duration for segment rate",
  "latest untimed command makes rate unresolved even after timed evidence",
  "rejects tampered persisted rate evidence",
  "Math.PI / 6",
  "averageRpm, 5"
]) {
  if (!domain.includes(token)) throw new Error(`S2.25 domain evidence missing: ${token}`);
}

const browser = await readFile("tests/browser/rotary-segment-rate.spec.ts", "utf8");
for (const token of [
  "derives segment-average rotary rate only from explicit command duration and restores evidence",
  'data-rate-mode", "unresolved-no-duration"',
  'data-rate-source", "session-events-explicit-duration"',
  "Rotary command duration seconds",
  'duration.fill("0.5")',
  'data-angular-velocity-rad-s", "0.524"',
  'data-rpm", "5.000"',
  'duration.fill("2")',
  'data-rate-command-id", "mechanical-cmd-2"',
  "Guardar 3D",
  "page.reload",
  'data-command-id", "mechanical-cmd-3"',
  "RATE UNRESOLVED"
]) {
  if (!browser.includes(token)) throw new Error(`S2.25 browser evidence missing: ${token}`);
}

const readme = await readFile("README.md", "utf8");
for (const token of [
  "`0.1.0-alpha.1 · S1.12 + S2.25`",
  "Rotary Segment Rate Evidence",
  "durationSeconds",
  "segment-average",
  "RATE UNRESOLVED",
  "wall-clock",
  "HERO_CANDIDATE",
  "AF-001L",
  "Tehkné Solutions"
]) {
  if (!readme.includes(token)) throw new Error(`S2.25 README baseline missing: ${token}`);
}
if (!readme.includes("does **not** claim instantaneous angular velocity, acceleration, torque or time integration")) {
  throw new Error("S2.25 README must preserve the no-dynamics claim boundary");
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.25"] !== "node scripts/verify-s2.25.mjs") throw new Error("S2.25 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
for (const token of [
  "S2.25 Rotary Segment Rate Evidence Gate",
  "npm run verify:s2.25",
  "tests/browser/rotary-segment-rate.spec.ts",
  "s2-25-browser-failure"
]) {
  if (!workflow.includes(token)) throw new Error(`S2.25 CI promotion contract missing: ${token}`);
}
if (workflow.includes("contents: write")) throw new Error("S2.25 CI must remain read-only");

console.log("S2.25 Rotary Segment Rate Evidence PASS · explicit duration → deterministic segment-average rad/s + RPM + persisted session-event evidence + untimed fail-closed + no wall-clock inference/no torque dynamics + Tehkné Solutions");
