import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/component-library/src/index.ts",
  "library/components/catalog.json",
  "tests/domain/component-library.test.mjs",
  "apps/studio-web/components/ComponentLibraryPanel.tsx",
  "apps/studio-web/components/ComponentLibraryPanel.module.css",
  "tests/browser/component-library.spec.ts"
];
for (const path of required) await access(resolve(path));

const catalog = JSON.parse(await readFile("library/components/catalog.json", "utf8"));
if (catalog.catalogId !== "tehkne-universal-components-v1") throw new Error("S2.3 catalog identity mismatch");
if (catalog.catalogVersion !== "1") throw new Error("S2.3 catalog version mismatch");
if (catalog.signature !== "Tehkné Solutions") throw new Error("S2.3 catalog signature missing");
if (!Array.isArray(catalog.components) || catalog.components.length < 16) throw new Error("S2.3 catalog requires at least 16 reusable component definitions");
const ids = catalog.components.map((definition) => definition.definitionId);
if (new Set(ids).size !== ids.length) throw new Error("S2.3 catalog definition IDs must remain unique");
for (const definitionId of [
  "compute.soc.mobile-v1",
  "memory.lpddr.package-v1",
  "storage.solid-state.general-v1",
  "energy.battery.lithium-ion-v1",
  "power.regulator.dc-v1",
  "display.oled.touch-v1",
  "sensing.imu.6dof-v1",
  "sensing.camera.rgb-v1",
  "communication.wireless.combo-v1",
  "control.robot-controller-v1",
  "actuation.servo.rotary-v1",
  "interface.usb-c.port-v1"
]) {
  if (!ids.includes(definitionId)) throw new Error(`S2.3 canonical component missing: ${definitionId}`);
}
const domains = new Set(catalog.components.map((definition) => definition.domain));
for (const domain of ["compute", "memory", "storage", "power", "energy", "display", "sensing", "actuation", "control", "thermal", "communication", "structural", "interface"]) {
  if (!domains.has(domain)) throw new Error(`S2.3 technology domain missing: ${domain}`);
}
for (const definition of catalog.components) {
  if (definition.version !== "1") throw new Error(`S2.3 component version mismatch: ${definition.definitionId}`);
  if (definition.metadata?.provenance !== "authored-template") throw new Error(`S2.3 component provenance missing: ${definition.definitionId}`);
  if (!definition.capabilities?.some((capability) => capability.id === "inspect")) throw new Error(`S2.3 inspect capability missing: ${definition.definitionId}`);
  if (!definition.capabilities?.some((capability) => capability.id === "explain")) throw new Error(`S2.3 explain capability missing: ${definition.definitionId}`);
}

const runtime = await readFile("packages/component-library/src/index.ts", "utf8");
for (const token of [
  'COMPONENT_LIBRARY_VERSION = "1"',
  'COMPONENT_LIBRARY_SIGNATURE = "Tehkné Solutions"',
  "ComponentDefinition",
  "ComponentCatalogManifest",
  "validateComponentDefinition",
  "validateComponentCatalog",
  "parseComponentCatalog",
  "portsAreCompatible",
  "ComponentRegistry",
  "compatibleWithPort",
  "instantiate(",
  'provenance: "component-library"'
]) {
  if (!runtime.includes(token)) throw new Error(`S2.3 component runtime contract missing: ${token}`);
}
for (const failClosedToken of [
  "Unknown component definition",
  "Unknown component property override",
  "Unknown component port override",
  "Invalid component catalog"
]) {
  if (!runtime.includes(failClosedToken)) throw new Error(`S2.3 fail-closed registry rule missing: ${failClosedToken}`);
}

const domainTest = await readFile("tests/domain/component-library.test.mjs", "utf8");
for (const token of [
  "covers reusable technology domains",
  "searches by product family, domain, tags and human text",
  "creates independent Engineering Entities",
  "composes a mobile architecture without product-specific glue",
  "robotics uses the same interface compatibility model",
  "malformed or unsigned catalogs remain fail closed"
]) {
  if (!domainTest.includes(token)) throw new Error(`S2.3 domain evidence missing: ${token}`);
}

const panel = await readFile("apps/studio-web/components/ComponentLibraryPanel.tsx", "utf8");
for (const token of [
  "Universal Component Library",
  "TEHKNÉ UNIVERSAL COMPONENTS",
  "Buscar componentes",
  "Filtrar família de produto",
  "ENGINEERING INTERFACES",
  "PRODUCT FAMILIES",
  "AUTHORED TEMPLATE · COMPONENT-LIBRARY",
  "Tehkné Solutions"
]) {
  if (!panel.includes(token)) throw new Error(`S2.3 component library UX missing: ${token}`);
}
const page = await readFile("apps/studio-web/app/page.tsx", "utf8");
if (!page.includes("<ComponentLibraryPanel />")) throw new Error("S2.3 component library is not surfaced in Studio");

const browser = await readFile("tests/browser/component-library.spec.ts", "utf8");
for (const token of [
  "COMPONENT LIBRARY",
  "Lithium-Ion Battery Pack",
  "Mobile System-on-Chip",
  "OLED Touch Display",
  "Wireless Connectivity Module",
  "bus.sdio-pcie",
  "pageErrors",
  "consoleErrors"
]) {
  if (!browser.includes(token)) throw new Error(`S2.3 browser evidence missing: ${token}`);
}

const tsconfig = await readFile("tsconfig.core.json", "utf8");
if (!tsconfig.includes("packages/component-library/src/**/*.ts")) throw new Error("S2.3 component library is not part of core typecheck/build");

console.log(`S2.3 component library structure PASS · ${catalog.components.length} reusable components · compatibility + instantiation + inspector · Tehkné Solutions`);
