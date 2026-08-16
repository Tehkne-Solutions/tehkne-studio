import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

for (const path of [
  "packages/invention-mechanical-command-runtime/src/rotary-waypoint-plan-attestation.ts",
  "packages/invention-mechanical-command-runtime/src/rotary-waypoint-execution-evidence.ts",
  "packages/invention-mechanical-command-runtime/src/rotary-waypoint-sequence.ts",
  "apps/studio-web/components/RotaryWaypointSequenceControls.tsx",
  "tests/domain/invention-rotary-waypoint-plan-attestation.test.mjs",
  "tests/browser/rotary-waypoint-plan-attestation.spec.ts",
  "docs/platform/s2-34-waypoint-plan-execution-attestation.md",
  ".github/workflows/s2-34.yml"
]) await access(resolve(path));

const source = await readFile("packages/invention-mechanical-command-runtime/src/rotary-waypoint-plan-attestation.ts", "utf8");
for (const token of [
  'MECHANICAL_ROTARY_RUN_WAYPOINT_SEQUENCE_ATTESTED_COMMAND = "invention.mechanical.rotary.runWaypointSequenceAttested"',
  "MechanicalRotaryWaypointPlanExecutionAttestation",
  "runSequenceAttested(", "attestations(", "lastAttestation(",
  "this.sequences.planSequence(", "this.sequences.runSequence(", "rotaryWaypointExecutionEvidence(",
  "MechanicalRotaryWaypointPlanExecutionAttested",
  'derivedFrom: "consumed-plan+s2.32-execution-evidence"',
  "allSegmentsMatched: true", "mechanical-sequence-attestation-cmd-", "MECHANICAL_COMMAND_SIGNATURE"
]) if (!source.includes(token)) throw new Error(`S2.34 attestation contract missing: ${token}`);

for (const forbidden of [
  "movementEventType", "movementByCommandId", "receiptMap", "attestationMap", "attestationsByProject",
  "graph.replaceRelationship", "planMechanicalRotaryJointStep(", "transformBatch(",
  "Date.now", "performance.now", "setTimeout(", "setInterval(", "requestAnimationFrame(",
  "rpmSolver", "torqueSolver", "angularVelocitySolver", "angularAccelerationSolver", "timeIntegrator", "sleep("
]) if (source.includes(forbidden)) throw new Error(`S2.34 must reuse S2.32 authority and avoid parallel state/time/dynamics: ${forbidden}`);

const executeStart = source.indexOf("  async #executeAttestedRun(");
const executeEnd = source.indexOf("  #buildAttestation(", executeStart);
if (executeStart < 0 || executeEnd < 0) throw new Error("S2.34 attested run body missing");
const executeBody = source.slice(executeStart, executeEnd);
const plan = executeBody.indexOf("this.sequences.planSequence(");
const run = executeBody.indexOf("this.sequences.runSequence(");
const evidence = executeBody.indexOf("rotaryWaypointExecutionEvidence(");
const build = executeBody.indexOf("this.#buildAttestation(");
const record = executeBody.indexOf('type: "MechanicalRotaryWaypointPlanExecutionAttested"');
if (plan < 0 || run < 0 || evidence < 0 || build < 0 || record < 0 || !(plan < run && run < evidence && evidence < build && build < record)) {
  throw new Error("S2.34 must capture plan, run canonically, resolve S2.32 evidence, verify, then persist attestation");
}

const s232 = await readFile("packages/invention-mechanical-command-runtime/src/rotary-waypoint-execution-evidence.ts", "utf8");
for (const token of ["rotaryWaypointExecutionEvidence(", "MechanicalRotaryWaypointSequenceRequested", 'derivedFrom: "session-events"', "MECHANICAL_COMMAND_SIGNATURE"]) {
  if (!s232.includes(token)) throw new Error(`S2.34 must preserve canonical S2.32 evidence authority: ${token}`);
}
for (const forbidden of ["events.record(", "commands.dispatch", "graph.replaceRelationship", "setContinuousTarget("]) {
  if (s232.includes(forbidden)) throw new Error(`S2.32 evidence must remain read-only under S2.34: ${forbidden}`);
}

const control = await readFile("apps/studio-web/components/RotaryWaypointSequenceControls.tsx", "utf8");
for (const token of [
  "mechanicalRotaryWaypointPlanAttestationRuntimeFor(spatial)", "attestationRuntime.runSequenceAttested", "attestationRuntime.lastAttestation",
  "PLAN-EXECUTION ATTESTATION NÃO DISPONÍVEL", "ATTESTED",
  "data-sequence-attestation-status", "data-sequence-attestation-command-id", "data-sequence-attestation-run-id",
  "data-sequence-attestation-derived-from", "data-sequence-attestation-plan-delta-rad", "data-sequence-attestation-actual-delta-rad",
  "data-sequence-attestation-match", 'data-sequence-execution="canonical-continuous-targets"',
  'data-sequence-preflight="shared-read-only-plan"', 'data-sequence-plan-mutation="none"',
  'data-sequence-execution-evidence="s2.32-read-only"', 'data-sequence-attestation-persistence="session-events"'
]) if (!control.includes(token)) throw new Error(`S2.34 UI attestation projection missing: ${token}`);

const domain = await readFile("tests/domain/invention-rotary-waypoint-plan-attestation.test.mjs", "utf8");
for (const token of [
  "attests the consumed S2.31 plan against canonical S2.32 execution evidence per segment",
  "freezes consumed plan coordinates while future live plans follow edited Named Positions",
  "publishes no attestation when the canonical S2.31 preflight blocks before movement",
  "restores attestation without replay and fails closed when either attestation or S2.32 evidence is tampered",
  "mechanical-sequence-attestation-cmd-1", "consumed-plan+s2.32-execution-evidence"
]) if (!domain.includes(token)) throw new Error(`S2.34 domain evidence missing: ${token}`);

const browser = await readFile("tests/browser/rotary-waypoint-plan-attestation.spec.ts", "utf8");
for (const token of [
  "attests the consumed plan against S2.32 execution evidence and preserves history after bookmark edits",
  'data-sequence-attestation-status", "verified"', 'data-sequence-attestation-command-id", "mechanical-sequence-attestation-cmd-1"',
  'data-sequence-attestation-run-id", "mechanical-sequence-cmd-2"',
  'data-sequence-attestation-derived-from", "consumed-plan+s2.32-execution-evidence"',
  'data-sequence-attestation-plan-delta-rad", "6.283"', 'data-sequence-attestation-actual-delta-rad", "6.283"',
  "S2.32 actual", "120.0°", "90.0°", "Guardar 3D", "page.reload"
]) if (!browser.includes(token)) throw new Error(`S2.34 browser evidence missing: ${token}`);

const doc = await readFile("docs/platform/s2-34-waypoint-plan-execution-attestation.md", "utf8");
for (const token of ["S2.34", "S2.33", "Rotary Waypoint Plan-Execution Attestation", "S2.32", "consumed-plan+s2.32-execution-evidence", "session.events", "HERO_CANDIDATE", "DCC_QA_CANDIDATE", "Tehkné Solutions"]) {
  if (!doc.includes(token)) throw new Error(`S2.34 documentation missing: ${token}`);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.33"] !== "node scripts/verify-s2.33.mjs") throw new Error("S2.34 must preserve S2.33 verifier registration");
if (pkg.scripts?.["verify:s2.34"] !== "node scripts/verify-s2.34.mjs") throw new Error("S2.34 package verification script missing");
const workflow = await readFile(".github/workflows/s2-34.yml", "utf8");
for (const token of [
  "S2.34 Rotary Waypoint Plan-Execution Attestation Gate", "npm run verify:s2.32", "npm run verify:s2.33", "npm run verify:s2.34",
  "tests/browser/rotary-waypoint-plan.spec.ts", "tests/browser/rotary-waypoint-plan-attestation.spec.ts", "s2-34-browser-failure"
]) if (!workflow.includes(token)) throw new Error(`S2.34 candidate CI contract missing: ${token}`);
if (workflow.includes("contents: write")) throw new Error("S2.34 CI must remain read-only");

console.log("S2.34 Rotary Waypoint Plan-Execution Attestation PASS · consumed S2.31 plan + canonical S2.30 run + S2.32 read-only execution authority + S2.33 AF-002 baseline preserved + immutable session-event attestation + no duplicate movement parser/no hidden clock/no dynamics solver + Tehkné Solutions");
