import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

for (const path of [
  "packages/invention-mechanical-command-runtime/src/rotary-waypoint-execution-evidence.ts",
  "tests/domain/invention-rotary-waypoint-execution-evidence.test.mjs",
  "README.md"
]) await access(resolve(path));

const source = await readFile("packages/invention-mechanical-command-runtime/src/rotary-waypoint-execution-evidence.ts", "utf8");
for (const token of [
  "MechanicalRotaryWaypointExecutionEvidence",
  "MechanicalRotaryWaypointSequenceRequested",
  "movementCommandIds",
  "cumulativeAbsoluteTravelRadians",
  "explicitDurationSeconds",
  "latestRotaryWaypointExecutionEvidence",
  'derivedFrom: "session-events"',
  "Tehkné Solutions"
]) if (!source.includes(token)) throw new Error(`S2.32 execution evidence contract missing: ${token}`);

for (const forbidden of ["events.record(", "commands.dispatch", "graph.replaceRelationship", "setContinuousTarget(", "setTimeout(", "setInterval(", "requestAnimationFrame(", "Date.now", "performance.now"]) {
  if (source.includes(forbidden)) throw new Error(`S2.32 evidence must remain read-only: ${forbidden}`);
}

const tests = await readFile("tests/domain/invention-rotary-waypoint-execution-evidence.test.mjs", "utf8");
for (const token of [
  "immutable execution evidence",
  "evidence projection must not manufacture events",
  "multiple historical executions",
  "partial-explicit"
]) if (!tests.includes(token)) throw new Error(`S2.32 domain evidence missing: ${token}`);

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.32"] !== "node scripts/verify-s2.32.mjs") throw new Error("S2.32 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
for (const token of ["S2.32 Rotary Waypoint Sequence Execution Evidence Gate", "npm run verify:s2.32", "s2-32-browser-failure"]) {
  if (!workflow.includes(token)) throw new Error(`S2.32 CI promotion contract missing: ${token}`);
}
if (workflow.includes("contents: write")) throw new Error("S2.32 CI must remain read-only");

const readme = await readFile("README.md", "utf8");
for (const token of ["S2.32", "Rotary Waypoint Sequence Execution Evidence", "session-events", "Tehkné Solutions"]) {
  if (!readme.includes(token)) throw new Error(`S2.32 README baseline missing: ${token}`);
}

console.log("S2.32 Rotary Waypoint Sequence Execution Evidence PASS · read-only session-events projection · Tehkné Solutions");
