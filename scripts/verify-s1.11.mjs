import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/factory-runtime/src/index.ts",
  "packages/studio-factory/src/index.ts",
  "presets/arm-01/manufacturing-profile.json",
  "tests/domain/factory-runtime.test.mjs",
  "tests/domain/studio-factory.test.mjs"
];
for (const path of required) await access(resolve(path));

const profile = JSON.parse(await readFile("presets/arm-01/manufacturing-profile.json", "utf8"));
if (profile.projectId !== "arm-01") throw new Error("Factory profile project mismatch");
if (profile.variantId !== "arm-01/high-torque") throw new Error("Factory profile must target validated high-torque variant");
if (profile.readiness !== "prototype-plan") throw new Error("Factory profile must not claim production readiness");
if (profile.signature !== "Tehkné Solutions") throw new Error("Factory profile signature missing");
const strategies = new Set(profile.items.map((item) => item.strategy));
for (const strategy of ["make", "buy", "wire", "assemble", "program", "test"]) {
  if (!strategies.has(strategy)) throw new Error(`Factory strategy missing: ${strategy}`);
}
if (!profile.knownLimitations.some((item) => item.includes("No manufacturing-grade CAD"))) {
  throw new Error("Factory profile must disclose missing manufacturing-grade CAD");
}
if (!profile.knownLimitations.some((item) => item.includes("Simulation evidence does not count as physical"))) {
  throw new Error("Factory profile must separate simulation and physical evidence");
}

const factoryRuntime = await readFile("packages/factory-runtime/src/index.ts", "utf8");
for (const token of ["ManufacturingStrategy", "PrototypeManufacturingProfile", "PrototypePackageManifest", "fabricationReady: false", "generatePrototypePackage", "validateManufacturingProfile"]) {
  if (!factoryRuntime.includes(token)) throw new Error(`Factory Runtime contract missing: ${token}`);
}

const studioFactory = await readFile("packages/studio-factory/src/index.ts", "utf8");
for (const token of ["ArmPrototypeFactory", "validated engineering variant", "PrototypePackageGenerated", "sourceFailureExperimentId", "fabricationReady"]) {
  if (!studioFactory.includes(token)) throw new Error(`Studio Factory orchestration missing: ${token}`);
}

const panel = await readFile("apps/studio-web/components/ArmRuntimePanel.tsx", "utf8");
for (const token of ["ArmPrototypeFactory", "factory: ArmPrototypeFactory", "VIRTUAL FACTORY", "Preparar Prototype Package", "ASSEMBLY PLAN", "NOT FABRICATION READY", "strategyCounts"]) {
  if (!panel.includes(token)) throw new Error(`Virtual Factory UX missing: ${token}`);
}

const workbench = await readFile("apps/studio-web/components/SpatialWorkbench.tsx", "utf8");
for (const token of ["ArmPrototypeFactory", "manufacturingProfile", "factory={armFactory}"]) {
  if (!workbench.includes(token)) throw new Error(`Virtual Factory ownership/injection missing: ${token}`);
}

console.log(`S1.11 factory structure PASS · ${required.length} new surfaces · validated variant → prototype plan package · Tehkné Solutions`);
