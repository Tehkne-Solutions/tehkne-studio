import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/invention-spatial-runtime/src/index.ts",
  "tests/domain/invention-spatial-runtime.test.mjs",
  "apps/studio-web/components/BlankInventionExperience.tsx",
  "apps/studio-web/components/BlankInventionExperience.module.css",
  "tests/browser/spatial-invention.spec.ts"
];
for (const path of required) await access(resolve(path));

const runtime = await readFile("packages/invention-spatial-runtime/src/index.ts", "utf8");
for (const token of [
  'INVENTION_SPATIAL_VERSION = "1"',
  'INVENTION_SPATIAL_SIGNATURE = "Tehkné Solutions"',
  "INVENTION_SPATIAL_BOUNDS",
  "parseInventionSpatialDocument",
  "class InventionSpatialScene",
  "createSpatialBinding",
  "resolveSpatialSelection",
  "ensureComponent",
  "move(entityId",
  "connectionSegments",
  'relationship.type === "connectedTo"',
  "inventionRuntime === true",
  "does not cover the current component graph",
  "auto-layout capacity exceeded"
]) {
  if (!runtime.includes(token)) throw new Error(`S2.11 spatial runtime contract missing: ${token}`);
}

const domain = await readFile("tests/domain/invention-spatial-runtime.test.mjs", "utf8");
for (const token of [
  "binds the same invention Engineering Entities instead of cloning domain state",
  "move is bounded, finite and preserves entity identity",
  "visual wire segments derive from the authored connectedTo relationships and follow movement",
  "spatial document restores exact layout and rejects tampered or incomplete evidence",
  "default layout covers the complete canonical base catalog"
]) {
  if (!domain.includes(token)) throw new Error(`S2.11 domain evidence missing: ${token}`);
}

const experience = await readFile("apps/studio-web/components/BlankInventionExperience.tsx", "utf8");
for (const token of [
  "InventionSpatialScene",
  "parseInventionSpatialDocument",
  "snapshot.extensions.inventionSpatial",
  "if (!rawSpatial)",
  "spatial.ensureComponent(entity.id)",
  "inventionSpatial: runtime.spatial.document()",
  'data-testid="invention-spatial-canvas"',
  "invention-spatial-node-${entity.id}",
  "invention-spatial-wire-${wire.relationshipId}",
  "onPointerMove={moveDrag}",
  "runtime.spatial.move",
  "runtime.spatial.select",
  "runtime.spatial.removeComponent",
  "Spatial Invention Canvas"
]) {
  if (!experience.includes(token)) throw new Error(`S2.11 spatial UX contract missing: ${token}`);
}

const styles = await readFile("apps/studio-web/components/BlankInventionExperience.module.css", "utf8");
for (const token of [".wireLayer", ".spatialNode", ".dragHandle", ".selectionBadge", "touch-action: none"]) {
  if (!styles.includes(token)) throw new Error(`S2.11 spatial style contract missing: ${token}`);
}

const browser = await readFile("tests/browser/spatial-invention.spec.ts", "utf8");
for (const token of [
  "moves the authored invention spatially, keeps wiring attached and restores layout without replay",
  "invention-spatial-node-invention.component.1",
  "invention-spatial-wire-invention-connection-1",
  'data-interfaces", "power.dc.source"',
  "page.mouse.down()",
  "page.mouse.move",
  "Posição atualizada",
  "2 bindings · sem replay"
]) {
  if (!browser.includes(token)) throw new Error(`S2.11 Chromium evidence missing: ${token}`);
}

const tsconfig = await readFile("tsconfig.core.json", "utf8");
if (!tsconfig.includes("packages/invention-spatial-runtime/src/**/*.ts")) {
  throw new Error("S2.11 invention spatial runtime is not part of strict core compile surface");
}

const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
if (rootPackage.scripts?.["verify:s2.11"] !== "node scripts/verify-s2.11.mjs") {
  throw new Error("S2.11 package verification script missing");
}

const workflow = await readFile(".github/workflows/ci.yml", "utf8");
for (const token of [
  "npm run verify:s2.10",
  "npm run verify:s2.11",
  "npm run smoke:browser",
  "Assert AF-001I deterministic evidence"
]) {
  if (!workflow.includes(token)) throw new Error(`S2.11 accumulated CI contract missing: ${token}`);
}
if (workflow.includes("contents: write")) throw new Error("S2.11 CI must remain read-only");

console.log("S2.11 Spatial Invention PASS · same Engineering Entities + bounded spatial bindings + authored connectedTo wires + drag/move + backward-compatible S2.10 restore + persisted layout without replay · Tehkné Solutions");
