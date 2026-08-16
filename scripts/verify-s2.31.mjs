import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/invention-mechanical-command-runtime/src/rotary-waypoint-sequence.ts",
  "packages/invention-mechanical-command-runtime/src/rotary-segment-rate.ts",
  "packages/invention-mechanical-command-runtime/src/rotary-named-positions.ts",
  "apps/studio-web/components/RotaryWaypointSequenceControls.tsx",
  "tests/domain/invention-rotary-waypoint-plan.test.mjs",
  "tests/browser/rotary-waypoint-plan.spec.ts",
  "README.md"
];
for (const path of required) await access(resolve(path));

const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = assetForge.components?.find((entry) => entry.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor) throw new Error("S2.31 AF-001 motor definition missing");
if (motor.metadata?.visualAsset?.version !== "0.6.6-hero-candidate" || motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.31 must preserve AF-001 HERO_CANDIDATE identity");
if (motor.metadata?.visualAsset?.triangles !== 3292 || motor.metadata?.visualAsset?.bytes !== 243848) throw new Error("S2.31 must preserve AF-001 LOD0 budget");
if (motor.metadata?.visualAsset?.sha256 !== "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c") throw new Error("S2.31 must not change AF-001 fingerprint");

const runtime = await readFile("packages/invention-mechanical-command-runtime/src/rotary-waypoint-sequence.ts", "utf8");
for (const token of [
  "MechanicalRotaryWaypointPlanSegment",
  "MechanicalRotaryWaypointSequencePlan",
  "fromContinuousRadians",
  "targetContinuousRadians",
  "deltaRadians",
  "averageAngularVelocityRadPerSec",
  "averageRpm",
  "withinTravelLimits",
  "cumulativeAbsoluteTravelRadians",
  "timedSteps",
  "untimedSteps",
  "explicitDurationSeconds",
  "totalDurationSeconds",
  '"complete-explicit" | "partial-explicit" | "unresolved-no-duration"',
  "planSequence(relationshipId: string, name: string)",
  "#buildPlan(",
  "deriveRotarySegmentRate(deltaRadians, durationSeconds)",
  "ROTARY_CONTINUOUS_EPSILON",
  "admissible: segments.every((entry) => entry.withinTravelLimits)",
  "#assertPlanAdmissible(plan: MechanicalRotaryWaypointSequencePlan)",
  "const plan = this.#buildPlan(command.payload.relationshipId, sequence, resolved, beforeContinuousRadians)",
  "this.#assertPlanAdmissible(plan)",
  "this.mechanical.setContinuousTarget("
]) {
  if (!runtime.includes(token)) throw new Error(`S2.31 waypoint plan runtime contract missing: ${token}`);
}
for (const forbidden of [
  "planMap", "plansByProject", "waypointPlanGraph", "rotaryWaypointPlan:", "sequencePlan:",
  "MechanicalRotaryWaypointSequencePlanned", "invention.mechanical.rotary.planWaypointSequence",
  "Date.now", "performance.now", "setTimeout(", "setInterval(", "requestAnimationFrame(",
  "rpmSolver", "torqueSolver", "angularVelocitySolver", "angularAccelerationSolver", "timeIntegrator", "sleep("
]) {
  if (runtime.includes(forbidden)) throw new Error(`S2.31 plan must remain pure read-only projection without parallel persistence/time/dynamics: ${forbidden}`);
}
const planStart = runtime.indexOf("  planSequence(relationshipId: string, name: string)");
const planEnd = runtime.indexOf("  #resolveRelationship", planStart);
if (planStart < 0 || planEnd < 0) throw new Error("S2.31 public plan query body missing");
const planBody = runtime.slice(planStart, planEnd);
for (const forbidden of ["commands.dispatch", "events.record", "graph.replaceRelationship", "setContinuousTarget(", "transformBatch("]) {
  if (planBody.includes(forbidden)) throw new Error(`S2.31 planSequence must be read-only and command-free: ${forbidden}`);
}
const runStart = runtime.indexOf("  async #executeRun(");
const runEnd = runtime.indexOf("  #executeDelete(", runStart);
const runBody = runtime.slice(runStart, runEnd);
const buildPlan = runBody.indexOf("const plan = this.#buildPlan");
const assertPlan = runBody.indexOf("this.#assertPlanAdmissible(plan)");
const movement = runBody.indexOf("this.mechanical.setContinuousTarget(");
if (buildPlan < 0 || assertPlan < 0 || movement < 0 || !(buildPlan < assertPlan && assertPlan < movement)) {
  throw new Error("S2.31 RUN SEQUENCE must consume the shared deterministic plan before the first canonical movement");
}

const rate = await readFile("packages/invention-mechanical-command-runtime/src/rotary-segment-rate.ts", "utf8");
for (const token of ["deriveRotarySegmentRate", "deltaRadians / durationSeconds", "averageRpm", 'mode: "segment-average"']) {
  if (!rate.includes(token)) throw new Error(`S2.31 must reuse S2.29 pure segment-rate evidence: ${token}`);
}

const control = await readFile("apps/studio-web/components/RotaryWaypointSequenceControls.tsx", "utf8");
for (const token of [
  "MechanicalRotaryWaypointSequencePlan",
  "sequenceRuntime.planSequence(relationshipId, selectedSequence.name)",
  "PREVIEW SEQUENCE",
  "PLAN NÃO GERADO",
  "PLAN OK",
  "PLAN BLOCKED",
  "LIMIT OK",
  "LIMIT BLOCKED",
  'aria-label="Rotary waypoint sequence plan summary"',
  'aria-label="Rotary waypoint sequence plan segments"',
  "data-sequence-plan-status",
  "data-sequence-plan-steps",
  "data-sequence-plan-duration-mode",
  "data-sequence-plan-total-duration",
  "data-sequence-plan-explicit-duration",
  "data-sequence-plan-total-delta-rad",
  "data-sequence-plan-absolute-travel-rad",
  "data-sequence-plan-final-rad",
  "data-sequence-plan-timed-steps",
  "data-sequence-plan-untimed-steps",
  'data-sequence-preflight="shared-read-only-plan"',
  'data-sequence-plan-mutation="none"',
  "sem relógio contínuo/dinâmica"
]) {
  if (!control.includes(token)) throw new Error(`S2.31 waypoint plan UI contract missing: ${token}`);
}
for (const forbidden of ["localStorage", "planMap", "plansByProject", "setTimeout(", "setInterval(", "requestAnimationFrame(", "Date.now", "performance.now", "rpmSolver", "timelineState"]) {
  if (control.includes(forbidden)) throw new Error(`S2.31 UI plan must remain transient display evidence without persisted/time state: ${forbidden}`);
}

const domain = await readFile("tests/domain/invention-rotary-waypoint-plan.test.mjs", "utf8");
for (const token of [
  "plans a fully timed waypoint sequence without mutation and derives deterministic per-segment rates",
  "PREVIEW must not mutate inventionSpatial",
  "pure plan query must not consume a CommandBus sequence ID",
  "keeps partial timing unresolved instead of inventing total duration while preserving route geometry",
  "partial timing must not be promoted to a fictional total duration",
  "exposes blocked waypoint segments and RUN SEQUENCE consumes the same plan as fail-closed preflight",
  "RUN must reject the same blocked plan before waypoint 1",
  "recomputes plans from live Named Positions after restore and persists no independent plan document",
  "rotaryWaypointPlan",
  "sequencePlan",
  "averageRpm, -15"
]) {
  if (!domain.includes(token)) throw new Error(`S2.31 domain evidence missing: ${token}`);
}

const browser = await readFile("tests/browser/rotary-waypoint-plan.spec.ts", "utf8");
for (const token of [
  "previews deterministic waypoint geometry rates and travel admissibility without movement",
  "PREVIEW SEQUENCE",
  'data-sequence-plan-status", "admissible"',
  'data-sequence-plan-status", "blocked"',
  'data-sequence-plan-duration-mode", "complete-explicit"',
  'data-sequence-plan-total-duration", "12.000"',
  'data-sequence-plan-total-delta-rad", "6.283"',
  'data-sequence-plan-absolute-travel-rad", "6.283"',
  'data-sequence-plan-mutation", "none"',
  "PLAN OK",
  "PLAN BLOCKED",
  "5.000 RPM",
  "LIMIT BLOCKED",
  'data-command-id", "mechanical-cmd-3"',
  "waypoint sequence travel limit exceeded",
  'data-sequence-final-movement-id", "mechanical-cmd-7"'
]) {
  if (!browser.includes(token)) throw new Error(`S2.31 browser evidence missing: ${token}`);
}

const readme = await readFile("README.md", "utf8");
for (const token of [
  "`0.1.0-alpha.1 · S1.12 + S2.31`",
  "Rotary Waypoint Sequence Plan (S2.31)",
  "planSequence",
  "PREVIEW SEQUENCE",
  "read-only",
  "cumulativeAbsoluteTravelRadians",
  "partial-explicit",
  "shared",
  "does not persist",
  "does not wait",
  "HERO_CANDIDATE",
  "AF-001L",
  "Tehkné Solutions"
]) {
  if (!readme.includes(token)) throw new Error(`S2.31 README baseline missing: ${token}`);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.31"] !== "node scripts/verify-s2.31.mjs") throw new Error("S2.31 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
for (const token of [
  "S2.31 Rotary Waypoint Sequence Plan Gate",
  "S2.30 rotary waypoint sequence contract", "npm run verify:s2.30",
  "S2.31 rotary waypoint sequence plan contract", "npm run verify:s2.31",
  "S2.30 rotary waypoint sequence browser contract", "tests/browser/rotary-waypoint-sequence.spec.ts",
  "S2.31 rotary waypoint sequence plan browser contract", "tests/browser/rotary-waypoint-plan.spec.ts",
  "s2-31-browser-failure"
]) {
  if (!workflow.includes(token)) throw new Error(`S2.31 CI promotion contract missing: ${token}`);
}
if (workflow.includes("contents: write")) throw new Error("S2.31 CI must remain read-only");

console.log("S2.31 Rotary Waypoint Sequence Plan PASS · pure read-only plan query + shared RUN preflight + live Named Position resolution + per-segment deterministic geometry + explicit-duration segment-average rate preview + partial timing remains unresolved + travel admissibility before movement + no plan persistence/no hidden clock/no dynamics solver + Tehkné Solutions");
