import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/circuit-runtime/src/index.ts",
  "tests/domain/circuit-runtime.test.mjs",
  "apps/studio-web/components/CircuitBuilderAssembly.tsx",
  "apps/studio-web/components/CircuitBuilderPanel.tsx",
  "tests/browser/circuit-builder.spec.ts"
];
for (const path of required) await access(resolve(path));

const runtime = await readFile("packages/circuit-runtime/src/index.ts", "utf8");
for (const token of [
  'CIRCUIT_RUNTIME_VERSION = "1"',
  'CIRCUIT_RUNTIME_SIGNATURE = "Tehkné Solutions"',
  "CircuitDocument",
  "CircuitBuilder",
  "addComponent",
  "removeComponent",
  "connect(from",
  "disconnect(wireId",
  "availableOutputs",
  "availableInputs",
  "createSeriesLedCircuit",
  '"incomplete" | "unsupported"',
  "series solver requires exactly one DC source",
  "Circuit wire endpoints must belong to Circuit Builder",
  "placeVoltageProbe",
  "measureProbe",
  'type: "CircuitVoltageMeasured"',
  'provenance: "calculated"'
]) {
  if (!runtime.includes(token)) throw new Error(`S2.9 Circuit Graph Runtime contract missing: ${token}`);
}

const domain = await readFile("tests/domain/circuit-runtime.test.mjs", "utf8");
for (const token of [
  "signed editable Engineering Graph without replacing S2.8 preset",
  "components and wires are real Engineering Entities",
  "remains fail closed for incomplete or incompatible topology",
  "supports multiple resistors and detects overcurrent",
  "voltage probes are project entities",
  "restores records and probes without replaying simulations"
]) {
  if (!domain.includes(token)) throw new Error(`S2.9 domain evidence missing: ${token}`);
}

const experience = await readFile("apps/studio-web/components/ElectronicsWorkbenchExperience.tsx", "utf8");
for (const token of [
  "CircuitBuilder",
  "CircuitBuilderAssembly",
  "CircuitBuilderPanel",
  'mode: "preset" | "builder"',
  'extensions: { electronicsBench: electronicsState, circuitBuilder: circuitState, electronicsWorkspace: workspace }',
  "Abrir Circuit Builder S2.9",
  "runBuilderCommand",
  "connectCanonical",
  "monte circuito série",
  "meça tensão no resistor",
  "simulações S2.9",
  "sem replay"
]) {
  if (!experience.includes(token)) throw new Error(`S2.9 Electronics Workbench integration missing: ${token}`);
}

const panel = await readFile("apps/studio-web/components/CircuitBuilderPanel.tsx", "utf8");
for (const token of [
  'aria-label="Circuit Builder"',
  "Novo circuito",
  "Montar exemplo série",
  "+ Fonte",
  "+ Chave",
  "+ Resistor",
  "+ LED",
  "Terminal de saída do fio",
  "Terminal de entrada do fio",
  "Conectar fio",
  "SIMULAÇÃO SUPORTADA · LOOP DC SÉRIE",
  "Probe da fonte",
  "Probe do resistor",
  "Topologias fora do solver suportado"
]) {
  if (!panel.includes(token)) throw new Error(`S2.9 Circuit Builder UX missing: ${token}`);
}

const assembly = await readFile("apps/studio-web/components/CircuitBuilderAssembly.tsx", "utf8");
for (const token of [
  "CircuitBuilderAssembly",
  "CIRCUIT_ROOT_ID",
  "relationship.metadata.circuitBuilder === true",
  'entity.type !== "VoltageProbe"',
  'entity.type === "VoltageProbe"'
]) {
  if (!assembly.includes(token)) throw new Error(`S2.9 Circuit Builder spatial representation missing: ${token}`);
}

const browser = await readFile("tests/browser/circuit-builder.spec.ts", "utf8");
for (const token of [
  "creates, wires, simulates, probes, faults and restores a circuit",
  "CIRCUIT GRAPH · 4 COMPONENTES · 0 FIOS",
  "CIRCUIT GRAPH · 4 COMPONENTES · 4 FIOS",
  "Fonte DC 1 · positive",
  "Probe do resistor",
  "Sobrecorrente",
  "Guardar experimento",
  "Restaurar bancada eletrônica",
  "monte circuito série com LED",
  "meça tensão no resistor"
]) {
  if (!browser.includes(token)) throw new Error(`S2.9 Chromium evidence missing: ${token}`);
}

const tsconfig = await readFile("tsconfig.core.json", "utf8");
if (!tsconfig.includes("packages/circuit-runtime/src/**/*.ts")) throw new Error("S2.9 Circuit Runtime is not part of strict core compile surface");

const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
if (rootPackage.scripts?.["verify:s2.9"] !== "node scripts/verify-s2.9.mjs") throw new Error("S2.9 package verification script missing");

const workflow = await readFile(".github/workflows/ci.yml", "utf8");
for (const token of ["npm run verify:s2.8", "npm run verify:s2.9", "npm run smoke:browser", "Assert AF-001I deterministic evidence"]) {
  if (!workflow.includes(token)) throw new Error(`S2.9 accumulated CI contract missing: ${token}`);
}
if (workflow.includes("contents: write")) throw new Error("S2.9 CI must remain read-only");

console.log("S2.9 Circuit Creation & Measurement PASS · editable Engineering Graph + fail-closed series solver + dynamic wiring + voltage probes + persistence · Tehkné Solutions");
