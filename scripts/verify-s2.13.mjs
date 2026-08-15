import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "library/components/extensions/asset-forge-v1.json",
  "apps/studio-web/components/InventionAssetVisual.tsx",
  "apps/studio-web/components/Invention3DWorkbench.tsx",
  "tests/browser/asset-backed-invention.spec.ts"
];
for (const path of required) await access(resolve(path));
const extension = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
if (extension.extensionId !== "asset-forge-v1" || extension.extensionVersion !== "1" || extension.signature !== "Tehkné Solutions") throw new Error("S2.13 Asset Forge extension identity/signature mismatch");
const motor = extension.components?.find((definition) => definition.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor || motor.domain !== "actuation" || motor.metadata?.provenance !== "authored-template") throw new Error("S2.13 canonical DC motor definition mismatch");
const visual = motor.metadata?.visualAsset;
if (visual?.kind !== "gltf" || visual?.assetId !== "TS_ELEC_MOTOR_DC_A") throw new Error("S2.13 motor visual identity mismatch");
if (visual?.version !== "0.6.6-hero-candidate" || visual?.status !== "HERO_CANDIDATE") throw new Error("S2.13 AF-001 v0.6.6 HERO_CANDIDATE contract mismatch");
if (visual?.lod !== "LOD0" || visual?.triangles !== 3292 || visual?.bytes !== 243848) throw new Error("S2.13 motor LOD0 evidence mismatch");
if (visual?.sha256 !== "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c") throw new Error("S2.13 motor GLB SHA mismatch");
if (visual?.runtimeUrl !== "/api/asset-forge/af001/motor/lod0") throw new Error("S2.13 motor runtime URL mismatch");
for (const [portId, socket] of Object.entries({ "power-pos": "SOCKET_ELEC_POWER_POS", "power-neg": "SOCKET_ELEC_POWER_NEG", "shaft-out": "SOCKET_MECH_AXIS_OUT", "mount-front": "SOCKET_MECH_MOUNT_FRONT" })) {
  if (motor.metadata?.portSocketMap?.[portId] !== socket) throw new Error(`S2.13 port/socket mapping mismatch: ${portId}`);
}
const visualRuntime = await readFile("apps/studio-web/components/InventionAssetVisual.tsx", "utf8");
for (const token of ["GltfVisualAssetDescriptor", "visualAssetForEntity", 'raw.kind !== "gltf"', 'runtimeUrl.startsWith("/api/asset-forge/")', "GLTFLoader", "prepareAssetScene", "source.clone(true)", "AssetBackedComponent"]) {
  if (!visualRuntime.includes(token)) throw new Error(`S2.13 visual runtime contract missing: ${token}`);
}
const workbench = await readFile("apps/studio-web/components/Invention3DWorkbench.tsx", "utf8");
for (const token of ["assetForgeExtension", "applyComponentCatalogExtension(tabletCatalog, assetForgeExtension)", "visualAssetForEntity", "AssetBackedComponent", "AssetLoadingPlaceholder", "ComponentProxy", 'data-testid="invention-3d-visual-source"', 'data-source={selectedVisual ? "asset" : "proxy"}', "PROXY EXPLÍCITO", "REAL ASSET", "frameloop=\"demand\"", "runtime.spatial.connectionSegments(connections)", "runtime.spatial.move", "runtime.builder.connect", "runtime.builder.disconnect", "inventionSpatial: runtime.spatial.document()"] ) {
  if (!workbench.includes(token)) throw new Error(`S2.13 workbench contract missing: ${token}`);
}
if (!["S2.13", "S2.14", "S2.15", "S2.16", "S2.17"].some((marker) => workbench.includes(marker))) throw new Error("S2.13 workbench lineage marker missing");
for (const forbidden of ['status: "GOLDEN_ASSET"', "parallelGraph", "inventionGraph3d", "runFunctionalBoot("]) if (workbench.includes(forbidden)) throw new Error(`S2.13 forbidden workbench behavior: ${forbidden}`);
const browser = await readFile("tests/browser/asset-backed-invention.spec.ts", "utf8");
for (const token of ["actuation.motor.dc-brushed-v1", "TS_ELEC_MOTOR_DC_A", "0.6.6-hero-candidate", "data-real-assets", "data-proxies", "PROXY EXPLÍCITO", "Guardar 3D", "Projeto salvo carregado no 3D", "pageErrors", "consoleErrors"]) if (!browser.includes(token)) throw new Error(`S2.13 browser evidence missing: ${token}`);
const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
if (rootPackage.scripts?.["verify:s2.13"] !== "node scripts/verify-s2.13.mjs") throw new Error("S2.13 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("npm run verify:s2.13") || workflow.includes("contents: write")) throw new Error("S2.13 CI contract mismatch");
console.log("S2.13 Asset-Backed Invention Rendering PASS · AF-001 v0.6.6 physical-socket candidate + explicit proxy fallback + same Engineering Graph/spatial persistence + HERO_CANDIDATE preserved through S2.17 · Tehkné Solutions");
