import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/invention-mechanical-command-runtime/src/index.ts",
  "packages/invention-mechanical-command-runtime/src/port-geometry.ts",
  "apps/studio-web/components/RotaryJointControls.tsx",
  "tests/domain/invention-mechanical-command-runtime.test.mjs",
  "tests/browser/mechanical-command-runtime.spec.ts",
  "library/assets/asset-forge/af001/AF001M_SOCKET_TRANSFORM_QA.json",
  "README.md"
];
for (const path of required) await access(resolve(path));

const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = assetForge.components?.find((entry) => entry.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor) throw new Error("S2.23 AF-001 motor definition missing");
if (motor.metadata?.visualAsset?.version !== "0.6.6-hero-candidate" || motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.23 must preserve AF-001 HERO_CANDIDATE identity");
if (motor.metadata?.visualAsset?.triangles !== 3292 || motor.metadata?.visualAsset?.bytes !== 243848) throw new Error("S2.23 must preserve AF-001 LOD0 budget");
if (motor.metadata?.visualAsset?.sha256 !== "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c") throw new Error("S2.23 must not change AF-001 fingerprint");
if (motor.metadata?.mechanicalPortPositionMap?.["shaft-out"]?.join(",") !== "0,0,0.03185") throw new Error("S2.23 AF-001 shaft-out local position metadata missing");

const af001m = JSON.parse(await readFile("library/assets/asset-forge/af001/AF001M_SOCKET_TRANSFORM_QA.json", "utf8"));
if (af001m.socket_translations_m?.SOCKET_MECH_AXIS_OUT?.join(",") !== motor.metadata.mechanicalPortPositionMap["shaft-out"].join(",")) {
  throw new Error("S2.23 mechanicalPortPositionMap must match AF-001M canonical shaft socket evidence");
}

const geometry = await readFile("packages/invention-mechanical-command-runtime/src/port-geometry.ts", "utf8");
for (const token of [
  "mechanicalPortLocalPosition",
  "mechanicalPortPositionMap",
  "spatialProxy",
  "portAnchors",
  "mechanicalPortWorldPosition",
  "binding.scale",
  "binding.rotation",
  "binding.position"
]) {
  if (!geometry.includes(token)) throw new Error(`S2.23 non-React port geometry contract missing: ${token}`);
}

const runtime = await readFile("packages/invention-mechanical-command-runtime/src/index.ts", "utf8");
for (const token of [
  'MECHANICAL_ROTARY_STEP_COMMAND = "invention.mechanical.rotary.step"',
  'MECHANICAL_ROTARY_TARGET_COMMAND = "invention.mechanical.rotary.setTarget"',
  "this.session.commands.register",
  "this.session.commands.dispatch",
  "deriveMechanicalAxialConstraints",
  "mechanicalPortLocalPosition",
  "mechanicalPortWorldPosition",
  "rotaryJointTargetDelta",
  "planMechanicalRotaryJointStep",
  "this.spatial.transformBatch",
  "this.session.events.record",
  "command.source",
  "MechanicalRotaryStepExecuted",
  "MechanicalRotaryTargetExecuted",
  "runtimeCache = new WeakMap<EngineeringSession",
  "mechanicalCommandRuntimeFor",
  "MECHANICAL_COMMAND_SIGNATURE"
]) {
  if (!runtime.includes(token)) throw new Error(`S2.23 mechanical CommandBus runtime missing: ${token}`);
}
for (const forbidden of [
  "new CommandBus(",
  "mechanicalCommandBus",
  "mechanicalHistory",
  "commandGraph",
  "jointGraph",
  "rotationGraph",
  "rpmSolver",
  "torqueSolver",
  "angularVelocitySolver",
  "revolutionCounter"
]) {
  if (runtime.includes(forbidden)) throw new Error(`S2.23 must reuse session CommandBus and avoid premature/parallel state: ${forbidden}`);
}

const control = await readFile("apps/studio-web/components/RotaryJointControls.tsx", "utf8");
for (const token of [
  "mechanicalCommandRuntimeFor",
  "commands.step",
  "commands.setTarget",
  'data-command-bus="session"',
  "data-command-source",
  "data-command-id",
  "data-command-mode",
  "CommandBus + atomic transform"
]) {
  if (!control.includes(token)) throw new Error(`S2.23 UI command projection missing: ${token}`);
}
for (const forbidden of ["planMechanicalRotaryJointStep(", "rotaryJointTargetDelta(", "spatial.transformBatch([{"]) {
  if (control.includes(forbidden)) throw new Error(`S2.23 UI must not execute mechanical planning directly: ${forbidden}`);
}

const domain = await readFile("tests/domain/invention-mechanical-command-runtime.test.mjs", "utf8");
for (const token of [
  "existing session CommandBus",
  "voice target command",
  "atomic spatial commit",
  "persistent event evidence",
  "restored automation command continues command IDs",
  "fail closed for invalid mechanical relationships",
  "without spatial mutation or false evidence",
  "stable semantic command type names"
]) {
  if (!domain.includes(token)) throw new Error(`S2.23 domain evidence missing: ${token}`);
}

const browser = await readFile("tests/browser/mechanical-command-runtime.spec.ts", "utf8");
for (const token of [
  "routes rotary UI through the session CommandBus",
  'data-command-bus", "session"',
  'data-command-id", "mechanical-cmd-1"',
  'data-command-id", "mechanical-cmd-2"',
  'data-command-id", "mechanical-cmd-3"',
  'data-command-source", "ui"',
  'data-command-mode", "principal-shortest"',
  'data-command-mode", "incremental"',
  "Guardar 3D",
  "page.reload"
]) {
  if (!browser.includes(token)) throw new Error(`S2.23 browser evidence missing: ${token}`);
}

const tsconfig = await readFile("tsconfig.core.json", "utf8");
if (!tsconfig.includes('"packages/invention-mechanical-command-runtime/src/**/*.ts"')) throw new Error("S2.23 runtime missing from core typecheck");
const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.23"] !== "node scripts/verify-s2.23.mjs") throw new Error("S2.23 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("npm run verify:s2.23")) throw new Error("S2.23 CI contract missing");
if (!workflow.includes("tests/browser/mechanical-command-runtime.spec.ts")) throw new Error("S2.23 browser gate missing from CI");
if (workflow.includes("contents: write")) throw new Error("S2.23 CI must remain read-only");

const readme = await readFile("README.md", "utf8");
for (const token of ["Current baseline", "S2.23", "Mechanical Command Runtime", "CommandBus", "voice", "automation", "HERO_CANDIDATE", "AF-001L", "Tehkné Solutions"]) {
  if (!readme.includes(token)) throw new Error(`S2.23 README baseline missing: ${token}`);
}

console.log("S2.23 Mechanical Command Runtime PASS · existing session CommandBus + UI/voice/automation source evidence + non-React physical port geometry + atomic spatial commit + persisted events + no second bus/no torque solver + later explicit rate evidence compatible + Tehkné Solutions");
