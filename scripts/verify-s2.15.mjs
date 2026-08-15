import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "library/components/extensions/mechanical-assembly-v1.json",
  "library/components/extensions/asset-forge-v1.json",
  "library/assets/asset-forge/af001/AF001M_SOCKET_TRANSFORM_QA.json",
  "packages/invention-assembly-runtime/src/index.ts",
  "apps/studio-web/app/api/asset-forge/af001/motor/lod0/route.ts",
  "apps/studio-web/components/InventionAssetVisual.tsx",
  "apps/studio-web/components/Invention3DWorkbench.tsx",
  "tools/asset_forge/af001_v06/glb_socket_transforms.py",
  "tools/asset_forge/af001_v06/build_golden_motor_v064.py",
  "tests/domain/invention-assembly-runtime.test.mjs",
  "tests/browser/mechanical-assembly-invention.spec.ts"
];
for (const path of required) await access(resolve(path));

const extension = JSON.parse(await readFile("library/components/extensions/mechanical-assembly-v1.json", "utf8"));
if (extension.extensionId !== "mechanical-assembly-v1" || extension.extensionVersion !== "1") {
  throw new Error("S2.15 mechanical extension identity mismatch");
}
if (extension.signature !== "Tehkné Solutions") throw new Error("S2.15 mechanical extension signature missing");
const wheel = extension.components?.find((definition) => definition.definitionId === "mechanical.wheel.drive-v1");
const bracket = extension.components?.find((definition) => definition.definitionId === "mechanical.bracket.motor-a-v1");
if (!wheel || !bracket) throw new Error("S2.15 wheel/bracket canonical definitions missing");
if (wheel.ports?.["hub-in"]?.compatibility?.[0] !== "mechanical.rotary-shaft") throw new Error("S2.15 wheel shaft compatibility mismatch");
if (bracket.ports?.["motor-mount"]?.compatibility?.[0] !== "mechanical.motor-mount") throw new Error("S2.15 bracket motor-mount compatibility mismatch");
if (bracket.ports?.["frame-mount"]?.compatibility?.[0] !== "mechanical.mount.generic") throw new Error("S2.15 bracket frame compatibility mismatch");
for (const definition of [wheel, bracket]) {
  if (definition.metadata?.spatialProxy?.status !== "PROXY_EXPLICIT") throw new Error(`S2.15 ${definition.definitionId} must remain an explicit proxy`);
  if (definition.metadata?.visualAsset) throw new Error(`S2.15 ${definition.definitionId} must not claim an Asset Forge visual before its own asset gate`);
  if (definition.metadata?.signature !== "Tehkné Solutions") throw new Error(`S2.15 ${definition.definitionId} signature missing`);
}
if (wheel.metadata?.spatialProxy?.portAnchors?.["hub-in"]?.name !== "PROXY_HUB_CENTER") throw new Error("S2.15 wheel hub anchor missing");
if (bracket.metadata?.spatialProxy?.portAnchors?.["motor-mount"]?.name !== "PROXY_MOTOR_FACE") throw new Error("S2.15 bracket motor anchor missing");

const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = assetForge.components?.find((definition) => definition.definitionId === "actuation.motor.dc-brushed-v1");
if (motor?.metadata?.visualAsset?.version !== "0.6.6-hero-candidate") throw new Error("S2.15 requires AF-001 v0.6.6 physical socket candidate");
if (motor?.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.15 must not promote AF-001 beyond HERO_CANDIDATE");
if (motor?.metadata?.visualAsset?.triangles !== 3292 || motor?.metadata?.visualAsset?.bytes !== 243812) throw new Error("S2.15 AF-001 v0.6.6 geometry/byte evidence mismatch");
if (motor?.metadata?.visualAsset?.sha256 !== "d19e51fd33c461cf761b7c2c086c1284fc4ddfb38f3274acabd88e33fc5ce487") throw new Error("S2.15 AF-001 v0.6.6 SHA mismatch");

const af001m = JSON.parse(await readFile("library/assets/asset-forge/af001/AF001M_SOCKET_TRANSFORM_QA.json", "utf8"));
if (af001m.gate !== "AF-001M" || af001m.signature !== "Tehkné Solutions") throw new Error("S2.15 AF-001M evidence identity mismatch");
if (af001m.source?.version !== "0.6.5-hero-candidate" || af001m.candidate?.version !== "0.6.6-hero-candidate") throw new Error("S2.15 AF-001M source/candidate lineage mismatch");
if (af001m.candidate?.triangles !== 3292 || af001m.candidate?.geometry_changed !== false || af001m.candidate?.materials_changed !== false) throw new Error("S2.15 AF-001M must preserve geometry/materials");
if (af001m.promotion?.golden_asset !== false || af001m.promotion?.af001l_target_hardware_required_again !== true) throw new Error("S2.15 AF-001M promotion guard missing");
for (const socketName of ["SOCKET_MECH_AXIS_OUT", "SOCKET_MECH_MOUNT_FRONT", "SOCKET_ELEC_POWER_POS", "SOCKET_ELEC_POWER_NEG"]) {
  if (!Array.isArray(af001m.socket_translations_m?.[socketName])) throw new Error(`S2.15 AF-001M socket translation missing: ${socketName}`);
}

const route = await readFile("apps/studio-web/app/api/asset-forge/af001/motor/lod0/route.ts", "utf8");
for (const token of [
  'SOURCE_VERSION = "0.6.5-hero-candidate"',
  'EXPECTED_VERSION = "0.6.6-hero-candidate"',
  "SOURCE_BYTES = 243_672",
  "EXPECTED_BYTES = 243_812",
  "ad73d83d0dcd8485a8c2a7a680f83090a98d637cea455dde4915f0d771cd6552",
  "d19e51fd33c461cf761b7c2c086c1284fc4ddfb38f3274acabd88e33fc5ce487",
  "patchSocketTransforms",
  "SOCKET_TRANSLATIONS",
  '"X-Tehkne-Asset-Socket-Transform-Patch": "glb-json-v1"',
  '"X-Tehkne-Gate": "AF001I-V066"'
]) {
  if (!route.includes(token)) throw new Error(`S2.15 AF-001 v0.6.6 route contract missing: ${token}`);
}

const assembly = await readFile("packages/invention-assembly-runtime/src/index.ts", "utf8");
for (const token of [
  "deriveMechanicalAssemblyConstraints",
  'relationship.type === "connectedTo"',
  "relationship.metadata.inventionRuntime === true",
  'token.startsWith("mechanical.")',
  'constraint: "coincident"',
  'derivedFrom: "engineering-graph"',
  "mechanicalAssemblyMembers",
  "coincidentFollowerPosition",
  "planMechanicalAssemblyTranslation",
  "INVENTION_SPATIAL_BOUNDS"
]) {
  if (!assembly.includes(token)) throw new Error(`S2.15 assembly runtime contract missing: ${token}`);
}
for (const forbidden of ["assemblyGraph", "mechanicalGraph", "parallelGraph", "assemblyRelationships = new Map"]) {
  if (assembly.includes(forbidden)) throw new Error(`S2.15 must not create parallel topology: ${forbidden}`);
}

const visual = await readFile("apps/studio-web/components/InventionAssetVisual.tsx", "utf8");
for (const token of [
  "SpatialProxyDescriptor",
  'status: "PROXY_EXPLICIT"',
  "spatialProxyForEntity",
  "useSpatialPortEndpoint",
  'source: "asset-socket" | "proxy-anchor" | "center-fallback"',
  'source: "proxy-anchor"',
  'source: "center-fallback"',
  "transformSocketPosition",
  "scene.worldToLocal(node.getWorldPosition(new Vector3()))"
]) {
  if (!visual.includes(token)) throw new Error(`S2.15 physical endpoint resolver missing: ${token}`);
}

const dccHelper = await readFile("tools/asset_forge/af001_v06/glb_socket_transforms.py", "utf8");
const dccWrapper = await readFile("tools/asset_forge/af001_v06/build_golden_motor_v064.py", "utf8");
for (const token of ["SOCKET_TRANSLATIONS", "patch_socket_transforms", "inspect_socket_transforms"]) {
  if (!dccHelper.includes(token)) throw new Error(`S2.15 DCC socket helper missing: ${token}`);
}
for (const token of ["VERSION='0.6.6-dcc-candidate'", "base.export=patched_export", "socket_transform_contract", "socket_transform_pass"]) {
  if (!dccWrapper.includes(token)) throw new Error(`S2.15 DCC v0.6.6 guard missing: ${token}`);
}

const workbench = await readFile("apps/studio-web/components/Invention3DWorkbench.tsx", "utf8");
for (const token of [
  "S2.15",
  "Mechanical Assembly 3D Invention Workbench",
  "mechanicalAssemblyExtension",
  "deriveMechanicalAssemblyConstraints",
  "mechanicalAssemblyMembers",
  "planMechanicalAssemblyTranslation",
  "MechanicalConstraintSynchronizer",
  "coincidentFollowerPosition",
  "useSpatialPortEndpoint",
  "physicalEndpointDeclared",
  "Montagem mecânica bloqueada",
  "data-mechanical-assemblies={mechanicalConstraints.length}",
  "data-driver-endpoint-source={driverEndpoint.source}",
  "data-follower-endpoint-source={followerEndpoint.source}",
  "runtime.builder.connect",
  "runtime.builder.disconnect",
  "inventionSpatial: runtime.spatial.document()"
]) {
  if (!workbench.includes(token)) throw new Error(`S2.15 workbench contract missing: ${token}`);
}
for (const forbidden of ["assemblyGraph", "mechanicalGraph", "inventionGraph3d", 'status: "GOLDEN_ASSET"']) {
  if (workbench.includes(forbidden) || visual.includes(forbidden)) throw new Error(`S2.15 forbidden parallel/premature behavior: ${forbidden}`);
}

const domain = await readFile("tests/domain/invention-assembly-runtime.test.mjs", "utf8");
for (const token of [
  "mechanical.rotary-shaft",
  "derivedFrom",
  "coincidentFollowerPosition",
  "mechanicalAssemblyMembers",
  "planMechanicalAssemblyTranslation",
  "planning failure must not partially mutate"
]) {
  if (!domain.includes(token)) throw new Error(`S2.15 domain evidence missing: ${token}`);
}

const browser = await readFile("tests/browser/mechanical-assembly-invention.spec.ts", "utf8");
for (const token of [
  "Brushed DC Motor · shaft-out",
  "Drive Wheel · hub-in",
  "SOCKET_MECH_AXIS_OUT",
  "PROXY_HUB_CENTER",
  'data-state", "snapped"',
  "data-mechanical-assemblies",
  "data-driver-endpoint-source",
  "data-follower-endpoint-source",
  "motorXBefore",
  "motorYBefore",
  "Z +",
  "pageErrors",
  "consoleErrors"
]) {
  if (!browser.includes(token)) throw new Error(`S2.15 browser evidence missing: ${token}`);
}

const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
if (rootPackage.scripts?.["verify:s2.15"] !== "node scripts/verify-s2.15.mjs") throw new Error("S2.15 package verification script missing");
if (rootPackage.scripts?.["verify:af001l:contract"] !== "node scripts/verify-af001l-contract.mjs") throw new Error("S2.15 must preserve AF-001L contract gate");
const tsconfig = await readFile("tsconfig.core.json", "utf8");
if (!tsconfig.includes('"packages/invention-assembly-runtime/src/**/*.ts"')) throw new Error("S2.15 assembly runtime missing from core typecheck");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("npm run verify:s2.15")) throw new Error("S2.15 CI contract missing");
if (!workflow.includes("tests/browser/mechanical-assembly-invention.spec.ts")) throw new Error("S2.15 browser gate missing from CI");
if (workflow.includes("contents: write")) throw new Error("S2.15 CI must remain read-only");

console.log("S2.15 Mechanical Assembly Constraints PASS · canonical wheel/bracket proxies + connectedTo-derived coincident constraints + AF-001 v0.6.6 repaired physical socket transforms + atomic assembly movement + AF-001L rebound + no parallel graph · Tehkné Solutions");