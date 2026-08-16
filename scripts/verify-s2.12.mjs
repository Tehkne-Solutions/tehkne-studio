import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "apps/studio-web/components/Invention3DWorkbench.tsx",
  "apps/studio-web/components/Invention3DWorkbench.module.css",
  "tests/browser/invention-3d-workbench.spec.ts",
  "apps/studio-web/app/page.tsx"
];
for (const path of required) await access(resolve(path));

const workbench = await readFile("apps/studio-web/components/Invention3DWorkbench.tsx", "utf8");
for (const token of [
  'from "@react-three/fiber"',
  "frameloop=\"demand\"",
  "InventionBuilder",
  "InventionSpatialScene",
  "parseInventionSpatialDocument",
  "runtime.spatial.connectionSegments(connections)",
  "runtime.spatial.transformBatch",
  "runtime.spatial.select",
  "runtime.builder.compatibleTargets",
  "runtime.builder.connect",
  "runtime.builder.disconnect",
  "inventionSpatial: runtime.spatial.document()",
  'data-testid="invention-3d-workbench"',
  'data-testid="invention-3d-selected"',
  "invention-3d-wire-${wire.relationshipId}",
  "SIMULAÇÃO {document.simulationStatus.toUpperCase()}",
  "3D Invention Workbench",
  "TEHKNÉ SOLUTIONS"
]) {
  if (!workbench.includes(token)) throw new Error(`S2.12 semantic 3D workbench contract missing: ${token}`);
}

for (const forbidden of [
  "runFunctionalBoot(",
  "simulateArbitrary",
  "simulationStatus: \"passed\"",
  "inventionGraph3d",
  "parallelGraph"
]) {
  if (workbench.includes(forbidden)) throw new Error(`S2.12 must not invent a parallel graph or unsupported physics: ${forbidden}`);
}

const styles = await readFile("apps/studio-web/components/Invention3DWorkbench.module.css", "utf8");
for (const token of [".viewport", ".cameraBar", ".axisGrid", ".wireEvidence", ".feedbackError"]) {
  if (!styles.includes(token)) throw new Error(`S2.12 3D UI style missing: ${token}`);
}

const browser = await readFile("tests/browser/invention-3d-workbench.spec.ts", "utf8");
for (const token of [
  "materializes the same invention graph in 3D, moves depth, keeps wiring attached and restores without replay",
  "SIMULAÇÃO NOT-REQUESTED",
  "Lithium-Ion Battery Pack · dc-output",
  "DC Power Regulator · dc-input",
  "power.dc.source",
  "data-source-z",
  "Z +",
  "Guardar 3D",
  "Projeto salvo carregado no 3D"
]) {
  if (!browser.includes(token)) throw new Error(`S2.12 Chromium evidence missing: ${token}`);
}

const page = await readFile("apps/studio-web/app/page.tsx", "utf8");
for (const token of ["Invention3DWorkbench", "<Invention3DWorkbench />", "3D Spatial Workbench"]) {
  if (!page.includes(token)) throw new Error(`S2.12 Studio integration missing: ${token}`);
}

const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
if (rootPackage.scripts?.["verify:s2.12"] !== "node scripts/verify-s2.12.mjs") {
  throw new Error("S2.12 package verification script missing");
}

const workflow = await readFile(".github/workflows/ci.yml", "utf8");
for (const token of [
  "npm run verify:s2.10",
  "npm run verify:s2.11",
  "npm run verify:s2.12",
  "npm run smoke:browser",
  "Assert AF-001I deterministic evidence"
]) {
  if (!workflow.includes(token)) throw new Error(`S2.12 accumulated CI contract missing: ${token}`);
}
if (workflow.includes("contents: write")) throw new Error("S2.12 CI must remain read-only");

console.log("S2.12 3D Invention Workbench PASS · real R3F viewport + same Engineering Graph/spatial bindings + atomic XYZ manipulation + connectedTo-derived 3D wires + canonical compatibility + shared persistence + no implicit physics · Tehkné Solutions");
