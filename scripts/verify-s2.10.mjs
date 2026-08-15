import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/invention-runtime/src/index.ts",
  "tests/domain/invention-runtime.test.mjs",
  "apps/studio-web/components/BlankInventionExperience.tsx",
  "apps/studio-web/components/BlankInventionTrigger.tsx",
  "tests/browser/blank-invention.spec.ts"
];
for (const path of required) await access(resolve(path));

const runtime = await readFile("packages/invention-runtime/src/index.ts", "utf8");
for (const token of [
  'INVENTION_RUNTIME_VERSION = "1"',
  'INVENTION_RUNTIME_SIGNATURE = "Tehkné Solutions"',
  "createBlankInventionProject",
  'projectType: "invention"',
  "preset: false",
  "class InventionBuilder",
  "addComponent",
  "removeComponent",
  "compatibleTargets",
  "connect(from",
  "disconnect(connectionId",
  "portsAreCompatible",
  "inventionRuntime: true",
  'validatedBy: "component-library"',
  'simulationStatus: "not-requested"',
  "Disconnect ${active.length} invention connection(s) before removing"
]) {
  if (!runtime.includes(token)) throw new Error(`S2.10 Invention Runtime contract missing: ${token}`);
}

const domain = await readFile("tests/domain/invention-runtime.test.mjs", "utf8");
for (const token of [
  "starts as a signed non-preset Engineering Graph",
  "materializes canonical Component Library definitions",
  "connects only compatible available ports",
  "remains fail closed for self, incompatible and occupied port connections",
  "requires explicit disconnect before component removal",
  "snapshot restores the authored topology without replay"
]) {
  if (!domain.includes(token)) throw new Error(`S2.10 domain evidence missing: ${token}`);
}

const experience = await readFile("apps/studio-web/components/BlankInventionExperience.tsx", "utf8");
for (const token of [
  "applyComponentCatalogExtension",
  "applyComponentCatalogOverlay",
  'aria-label="Blank Invention Workspace"',
  "BLANK INVENTION",
  "PRESET false",
  "Adicionar ao projeto",
  "Porta de origem",
  "Porta compatível de destino",
  "Conectar interfaces",
  "Guardar invenção",
  "Restaurar invenção",
  "SIMULAÇÃO NÃO IMPLÍCITA",
  'saveBrowserProject("invention"',
  "restoreSessionSnapshot"
]) {
  if (!experience.includes(token)) throw new Error(`S2.10 Blank Invention UX missing: ${token}`);
}

const trigger = await readFile("apps/studio-web/components/BlankInventionTrigger.tsx", "utf8");
for (const token of [
  'data-testid="blank-invention-trigger"',
  'tehkne:open-invention',
  "PROJETO VAZIO · S2.10"
]) {
  if (!trigger.includes(token)) throw new Error(`S2.10 workspace trigger missing: ${token}`);
}

const browser = await readFile("tests/browser/blank-invention.spec.ts", "utf8");
for (const token of [
  "creates a blank invention from canonical components",
  "energy.battery.lithium-ion-v1",
  "power.regulator.dc-v1",
  "compute.soc.mobile-v1",
  "display.oled.touch-v1",
  "BLANK INVENTION · 4 COMPONENTES · 3 CONEXÕES",
  "Disconnect 1 invention connection",
  "Guardar invenção",
  "Restaurar invenção",
  "sem replay"
]) {
  if (!browser.includes(token)) throw new Error(`S2.10 Chromium evidence missing: ${token}`);
}

const tsconfig = await readFile("tsconfig.core.json", "utf8");
if (!tsconfig.includes("packages/invention-runtime/src/**/*.ts")) {
  throw new Error("S2.10 Invention Runtime is not part of strict core compile surface");
}

const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
if (rootPackage.scripts?.["verify:s2.10"] !== "node scripts/verify-s2.10.mjs") {
  throw new Error("S2.10 package verification script missing");
}

const persistence = await readFile("apps/studio-web/lib/projectPersistence.ts", "utf8");
if (!persistence.includes('| "invention"')) throw new Error("S2.10 invention persistence workspace missing");

const page = await readFile("apps/studio-web/app/page.tsx", "utf8");
for (const token of ["BlankInventionTrigger", "BlankInventionExperience", "Invention"] ) {
  if (!page.includes(token)) throw new Error(`S2.10 Studio integration missing: ${token}`);
}

const workflow = await readFile(".github/workflows/ci.yml", "utf8");
for (const token of [
  "npm run verify:s2.9",
  "npm run verify:s2.10",
  "npm run smoke:browser",
  "Assert AF-001I deterministic evidence"
]) {
  if (!workflow.includes(token)) throw new Error(`S2.10 accumulated CI contract missing: ${token}`);
}
if (workflow.includes("contents: write")) throw new Error("S2.10 CI must remain read-only");

console.log("S2.10 Blank Invention PASS · canonical Component Library composition + live port compatibility + fail-closed wiring/removal + persistence without replay + no implicit solver · Tehkné Solutions");
