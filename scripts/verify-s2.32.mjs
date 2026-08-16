import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

for (const path of [
  "packages/invention-mechanical-command-runtime/src/rotary-waypoint-execution-evidence.ts",
  "tests/domain/invention-rotary-waypoint-execution-evidence.test.mjs",
  "docs/platform/s2-32-waypoint-execution-evidence.md",
  ".github/workflows/s2-32.yml"
]) await access(resolve(path));

const source = await readFile("packages/invention-mechanical-command-runtime/src/rotary-waypoint-execution-evidence.ts", "utf8");
for (const token of [
  "MechanicalRotaryWaypointExecutionEvidence",
  "MechanicalRotaryWaypointSequenceRequested",
  "movementCommandIds",
  "cumulativeAbsoluteTravelRadians",
  "explicitDurationSeconds",
  "latestRotaryWaypointExecutionEvidence",
  'derivedFrom: \"session-events\"',
  "MECHANICAL_COMMAND_SIGNATURE"
]) if (!source.includes(token)) throw new Error(`S2.32 execution evidence contract missing: ${token}`);
for (const forbidden of ["events.record(", "commands.dispatch", "graph.replaceRelationship", "setContinuousTarget(", "setTimeout(", "setInterval(", "requestAnimationFrame(", "Date.now", "performance.now"]) {
  if (source.includes(forbidden)) throw new Error(`S2.32 evidence must remain read-only: ${forbidden}`);
}

const tests = await readFile("tests/domain/invention-rotary-waypoint-execution-evidence.test.mjs", "utf8");
for (const token of ["immutable execution evidence", "evidence projection must not manufacture events", "multiple historical executions", "partial-explicit"]) {
  if (!tests.includes(token)) throw new Error(`S2.32 domain evidence missing: ${token}`);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.32"] !== "node scripts/verify-s2.32.mjs") throw new Error("S2.32 package verification script missing");
const workflow = await readFile(".github/workflows/s2-32.yml", "utf8");
for (const token of ["S2.32 Rotary Waypoint Sequence Execution Evidence Gate", "npm run verify:s2.31", "npm run verify:s2.32", "s2-32-browser-failure"]) {
  if (!workflow.includes(token)) throw new Error(`S2.32 candidate CI contract missing: ${token}`);
}
if (workflow.includes("contents: write")) throw new Error("S2.32 CI must remain read-only");

const doc = await readFile("docs/platform/s2-32-waypoint-execution-evidence.md", "utf8");
for (const token of ["S2.32", "Rotary Waypoint Sequence Execution Evidence", "session-events", "HERO_CANDIDATE", "AF-001L", "Tehkné Solutions"]) {
  if (!doc.includes(token)) throw new Error(`S2.32 candidate documentation missing: ${token}`);
}

console.log("S2.32 Rotary Waypoint Sequence Execution Evidence PASS · read-only session-events projection · canonical signature authority · Tehkné Solutions");
