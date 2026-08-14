import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/persistence-runtime/src/index.ts",
  "apps/studio-web/lib/projectPersistence.ts",
  "tests/domain/persistence-runtime.test.mjs",
  "tests/domain/studio-persistence.test.mjs",
  "tests/browser/persistence.spec.ts"
];
for (const path of required) await access(resolve(path));

const persistence = await readFile("packages/persistence-runtime/src/index.ts", "utf8");
for (const token of [
  'TEHKNE_STUDIO_PERSISTENCE_VERSION = "1"',
  'TEHKNE_STUDIO_PERSISTENCE_FORMAT = "tehkne-studio-session"',
  'TEHKNE_STUDIO_SIGNATURE = "Tehkné Solutions"',
  "StudioSessionSnapshot",
  "createSessionSnapshot",
  "serializeSessionSnapshot",
  "parseSessionSnapshot",
  "restoreSessionSnapshot",
  "validateProject",
  "RestoredEngineeringSession"
]) {
  if (!persistence.includes(token)) throw new Error(`S2.2 persistence contract missing: ${token}`);
}
for (const failClosedToken of [
  "Unsupported persistenceVersion",
  "Invalid Tehkné Studio persistence signature",
  "Invalid persisted project",
  "Persisted history target is missing",
  "Duplicate persisted event id"
]) {
  if (!persistence.includes(failClosedToken)) throw new Error(`S2.2 fail-closed persistence rule missing: ${failClosedToken}`);
}

const browserAdapter = await readFile("apps/studio-web/lib/projectPersistence.ts", "utf8");
for (const token of [
  "window.localStorage.setItem",
  "window.localStorage.getItem",
  "serializeSessionSnapshot",
  "parseSessionSnapshot",
  'tehkne-studio:s2.2:project:'
]) {
  if (!browserAdapter.includes(token)) throw new Error(`S2.2 browser persistence adapter missing: ${token}`);
}

const workbench = await readFile("apps/studio-web/components/SpatialWorkbench.tsx", "utf8");
for (const token of [
  "createDesktopRuntime",
  "createArmRuntime",
  "createSessionSnapshot",
  "restoreSessionSnapshot",
  "saveBrowserProject",
  "loadBrowserProject",
  "saveCurrentProject",
  "restoreProject",
  "motionRecords: armController.records()",
  "failureRecords: armFailureLab.records()",
  "variantRecords: armVariantLab.records()",
  "prototypePackage: armFactory.latest()",
  "Restaurar Desktop salvo",
  "Restaurar ARM-01 salvo",
  "factory={armFactory}",
  "RESTORE BLOCKED"
]) {
  if (!workbench.includes(token)) throw new Error(`S2.2 Workbench persistence integration missing: ${token}`);
}

const failureLab = await readFile("packages/studio-failure/src/index.ts", "utf8");
for (const token of ["ArmFailureLabRestoreState", "restore.records", "Invalid restored Failure Lab record id"]) {
  if (!failureLab.includes(token)) throw new Error(`S2.2 Failure Lab restore contract missing: ${token}`);
}
const robotics = await readFile("packages/studio-robotics/src/index.ts", "utf8");
for (const token of ["Arm01ControllerRestoreState", "restore.records", "Invalid restored ARM motion record"]) {
  if (!robotics.includes(token)) throw new Error(`S2.2 Robotics restore contract missing: ${token}`);
}
const variants = await readFile("packages/studio-variants/src/index.ts", "utf8");
for (const token of ["ArmVariantLabRestoreState", "source failure evidence is missing", "Restored variant lost base failure evidence"]) {
  if (!variants.includes(token)) throw new Error(`S2.2 Variant restore provenance missing: ${token}`);
}
const factory = await readFile("packages/studio-factory/src/index.ts", "utf8");
for (const token of ["ArmPrototypeFactoryRestoreState", "requires its validated engineering variant", "must not overclaim fabrication readiness"]) {
  if (!factory.includes(token)) throw new Error(`S2.2 Factory restore provenance missing: ${token}`);
}

const domainPersistence = await readFile("tests/domain/persistence-runtime.test.mjs", "utf8");
for (const token of [
  "saves current Engineering Graph, behaviors, history and events then restores them",
  "rejects invalid signature, schema and dangling engineering state",
  "refuses malformed JSON"
]) {
  if (!domainPersistence.includes(token)) throw new Error(`S2.2 domain persistence evidence missing: ${token}`);
}
const studioPersistence = await readFile("tests/domain/studio-persistence.test.mjs", "utf8");
for (const token of [
  "without replay",
  "rehydration must not manufacture new evidence",
  "source failure evidence is missing",
  "requires its validated engineering variant"
]) {
  if (!studioPersistence.includes(token)) throw new Error(`S2.2 ARM persistence evidence missing: ${token}`);
}
const browserPersistence = await readFile("tests/browser/persistence.spec.ts", "utf8");
for (const token of [
  "survives browser reload",
  "Restaurar Desktop salvo",
  "Restaurar ARM-01 salvo",
  "Criar variante High Torque",
  "Preparar Prototype Package",
  "NOT FABRICATION READY",
  "page.reload"
]) {
  if (!browserPersistence.includes(token)) throw new Error(`S2.2 browser persistence evidence missing: ${token}`);
}

const tsconfig = await readFile("tsconfig.core.json", "utf8");
if (!tsconfig.includes("packages/persistence-runtime/src/**/*.ts")) throw new Error("S2.2 persistence runtime is not part of core typecheck/build");

console.log("S2.2 persistence structure PASS · current graph + history/events + runtime evidence + localStorage reload/restore · Tehkné Solutions");
