import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/electronics-runtime/src/index.ts",
  "presets/electronics-workbench-01/profile.json",
  "tests/domain/electronics-runtime.test.mjs",
  "apps/studio-web/components/ElectronicsBenchAssembly.tsx",
  "apps/studio-web/components/ElectronicsWorkbenchPanel.tsx",
  "apps/studio-web/components/ElectronicsWorkbenchExperience.tsx",
  "tests/browser/electronics-workbench.spec.ts"
];
for (const path of required) await access(resolve(path));

const profile = JSON.parse(await readFile("presets/electronics-workbench-01/profile.json", "utf8"));
if (profile.electronicsVersion !== "1") throw new Error("S2.8 electronics profile version mismatch");
if (profile.profileId !== "electronics-workbench-01-v1") throw new Error("S2.8 electronics profile identity mismatch");
if (profile.projectId !== "electronics-workbench-01") throw new Error("S2.8 electronics project identity mismatch");
if (profile.signature !== "Tehkné Solutions") throw new Error("S2.8 electronics signature missing");
if (profile.sourceVoltageV !== 5) throw new Error("S2.8 canonical learning source must start at 5 V");
if (profile.resistorOhms !== 330) throw new Error("S2.8 canonical learning resistor must start at 330 ohm");
if (profile.ledForwardVoltageV !== 2 || profile.ledMaxCurrentA !== 0.02) throw new Error("S2.8 canonical LED envelope changed unexpectedly");
if (profile.switchClosed !== false) throw new Error("S2.8 canonical circuit must start safely open");

const runtime = await readFile("packages/electronics-runtime/src/index.ts", "utf8");
for (const token of [
  'ELECTRONICS_WORKBENCH_SIGNATURE = "Tehkné Solutions"',
  "ElectronicsWorkbenchProfile",
  "validateElectronicsWorkbenchProfile",
  "createElectronicsWorkbenchProject",
  'projectType: "experiment"',
  'id: "electronics.source"',
  'id: "electronics.switch"',
  'id: "electronics.resistor"',
  'id: "electronics.led"',
  'id: "electronics.multimeter"',
  "electronics-wire-source-switch",
  "electronics-wire-switch-resistor",
  "electronics-wire-resistor-led",
  "electronics-wire-led-return",
  "export class ElectronicsBench",
  "setSourceVoltage",
  "setResistance",
  "setSwitchClosed",
  "simulate()",
  "currentMarginPercent",
  "Sobrecorrente",
  "resistorPowerW",
  "ElectronicsFaultDetected",
  "measure(kind",
  'source: "calculated"'
]) {
  if (!runtime.includes(token)) throw new Error(`S2.8 electronics runtime contract missing: ${token}`);
}
if (runtime.includes("physicalMeasurementReady")) throw new Error("S2.8 must not claim physical measurement evidence");

const domain = await readFile("tests/domain/electronics-runtime.test.mjs", "utf8");
for (const token of [
  "creates a signed experiment with a closed-loop DC learning circuit",
  "open switch produces zero current",
  "5 V with 330 ohm resistor drives the LED inside its current envelope",
  "reducing resistance exposes an overcurrent fault instead of clamping the simulated truth",
  "multimeter measurements are derived from the latest simulation with calculated provenance",
  "source voltage and resistance edits remain bounded and recover from a fault",
  "keeps simulation evidence without replaying it"
]) {
  if (!domain.includes(token)) throw new Error(`S2.8 electronics domain evidence missing: ${token}`);
}

const assembly = await readFile("apps/studio-web/components/ElectronicsBenchAssembly.tsx", "utf8");
for (const token of [
  "ElectronicsBenchAssembly",
  'session.getEntity("electronics.source")',
  'session.getEntity("electronics.switch")',
  'session.getEntity("electronics.resistor")',
  'session.getEntity("electronics.led")',
  'session.getEntity("electronics.multimeter")',
  "createSpatialBinding",
  "resolveSpatialSelection",
  'led.state === "on"',
  'led.state === "fault"'
]) {
  if (!assembly.includes(token)) throw new Error(`S2.8 electronics spatial surface missing: ${token}`);
}

const panel = await readFile("apps/studio-web/components/ElectronicsWorkbenchPanel.tsx", "utf8");
for (const token of [
  "ElectronicsWorkbenchPanel",
  "Tensão da fonte",
  "Resistência do resistor",
  "Fechar chave",
  "Simular circuito",
  "Preset seguro · 330 Ω",
  "Teste de falha · 100 Ω",
  "ENGINEERING READOUT",
  "MULTÍMETRO VIRTUAL",
  "circuit-current",
  "calculated/simulated"
]) {
  if (!panel.includes(token)) throw new Error(`S2.8 electronics instrumentation UX missing: ${token}`);
}

const experience = await readFile("apps/studio-web/components/ElectronicsWorkbenchExperience.tsx", "utf8");
for (const token of [
  "ElectronicsWorkbenchExperience",
  "createElectronicsWorkbenchProject",
  "new ElectronicsBench",
  "new StudioIntelligence",
  "Abrir Electronics Workbench",
  "Restaurar bancada eletrônica",
  'saveBrowserProject("electronics"',
  'loadBrowserProject("electronics")',
  "electronicsBench",
  "sem replay",
  "Comando para a bancada eletrônica",
  "bench.setSwitchClosed",
  "bench.setResistance",
  'bench.measure("circuit-current")',
  "listenOnce",
  "speakStudioResponse"
]) {
  if (!experience.includes(token)) throw new Error(`S2.8 Electronics Workbench host missing: ${token}`);
}

const page = await readFile("apps/studio-web/app/page.tsx", "utf8");
for (const token of ["ElectronicsWorkbenchExperience", "<ElectronicsWorkbenchExperience />", "Robotics · Electronics · Failure"]) {
  if (!page.includes(token)) throw new Error(`S2.8 Studio shell integration missing: ${token}`);
}

const persistence = await readFile("apps/studio-web/lib/projectPersistence.ts", "utf8");
if (!persistence.includes('"electronics"')) throw new Error("S2.8 persistence adapter does not include electronics experiments");

const browser = await readFile("tests/browser/electronics-workbench.spec.ts", "utf8");
for (const token of [
  "Abrir Electronics Workbench",
  "Preset seguro · 330 Ω",
  "9\\.09 mA",
  "Teste de falha · 100 Ω",
  "Sobrecorrente",
  "Guardar experimento",
  "Restaurar bancada eletrônica",
  "restaurada · 2 simulações · sem replay",
  "Feche a chave do circuito",
  "Resistor 470 ohms",
  "Meça corrente",
  "Inspecione o resistor",
  "Inspecione o multímetro"
]) {
  if (!browser.includes(token)) throw new Error(`S2.8 Electronics Workbench browser evidence missing: ${token}`);
}

const tsconfig = await readFile("tsconfig.core.json", "utf8");
if (!tsconfig.includes("packages/electronics-runtime/src/**/*.ts")) throw new Error("S2.8 electronics runtime is not part of core typecheck/build");

const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
if (rootPackage.scripts?.["verify:s2.8"] !== "node scripts/verify-s2.8.mjs") throw new Error("S2.8 package verification script missing");

const workflow = await readFile(".github/workflows/ci.yml", "utf8");
for (const token of ["npm run verify:s2.7", "npm run verify:s2.8", "npm run smoke:browser", "Assert AF-001I deterministic evidence"]) {
  if (!workflow.includes(token)) throw new Error(`S2.8 accumulated CI contract missing: ${token}`);
}
if (workflow.includes("contents: write")) throw new Error("S2.8 final CI must remain read-only");

console.log("S2.8 Electronics Workbench structure PASS · experiment graph + DC solver + safe/fault envelopes + virtual multimeter + voice/text + persistence · Tehkné Solutions");
