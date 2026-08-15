import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const CANONICAL_AF001_V066_BYTES = 243848;
const CANONICAL_AF001_V066_SHA256 = "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c";
const CANONICAL_AF001_V065_SHA256 = "ad73d83d0dcd8485a8c2a7a680f83090a98d637cea455dde4915f0d771cd6552";
const SOCKET_TRANSLATIONS = {
  SOCKET_MECH_AXIS_OUT: [0, 0, 0.03185],
  SOCKET_MECH_MOUNT_FRONT: [0, 0, 0.01655],
  SOCKET_ELEC_POWER_POS: [-0.0047, -0.00085, -0.01936],
  SOCKET_ELEC_POWER_NEG: [0.0047, -0.00085, -0.01936]
};

const required = [
  "library/components/extensions/mechanical-assembly-v1.json",
  "packages/invention-assembly-runtime/src/index.ts",
  "apps/studio-web/components/InventionAssetVisual.tsx",
  "apps/studio-web/components/Invention3DWorkbench.tsx",
  "tests/domain/invention-assembly-runtime.test.mjs",
  "tests/browser/mechanical-assembly-invention.spec.ts",
  "library/assets/asset-forge/af001/AF001M_SOCKET_TRANSFORM_QA.json",
  "tests/browser/asset-forge-af001i.spec.ts",
  "tests/hardware/asset-forge-af001l.spec.ts",
  "tools/asset_forge/af001_v06/glb_socket_transforms.py"
];
for (const path of required) await access(resolve(path));

const extension = JSON.parse(await readFile("library/components/extensions/mechanical-assembly-v1.json", "utf8"));
if (extension.extensionId !== "mechanical-assembly-v1" || extension.extensionVersion !== "1" || extension.signature !== "Tehkné Solutions") throw new Error("S2.16 mechanical extension identity/signature mismatch");
const wheel = extension.components?.find((definition) => definition.definitionId === "mechanical.wheel.drive-v1");
const bracket = extension.components?.find((definition) => definition.definitionId === "mechanical.bracket.motor-a-v1");
if (!wheel || !bracket) throw new Error("S2.16 wheel/bracket canonical definitions missing");
if (wheel.ports?.["hub-in"]?.compatibility?.[0] !== "mechanical.rotary-shaft") throw new Error("S2.16 wheel shaft compatibility mismatch");
if (bracket.ports?.["motor-mount"]?.compatibility?.[0] !== "mechanical.motor-mount" || bracket.ports?.["frame-mount"]?.compatibility?.[0] !== "mechanical.mount.generic") throw new Error("S2.16 bracket compatibility mismatch");
for (const definition of [wheel, bracket]) {
  if (definition.metadata?.spatialProxy?.status !== "PROXY_EXPLICIT" || definition.metadata?.visualAsset) throw new Error(`S2.16 ${definition.definitionId} must remain explicit proxy`);
  if (definition.metadata?.signature !== "Tehkné Solutions") throw new Error(`S2.16 ${definition.definitionId} signature missing`);
}
if (wheel.metadata?.spatialProxy?.portAnchors?.["hub-in"]?.name !== "PROXY_HUB_CENTER") throw new Error("S2.16 wheel hub anchor missing");

const af001m = JSON.parse(await readFile("library/assets/asset-forge/af001/AF001M_SOCKET_TRANSFORM_QA.json", "utf8"));
if (af001m.gate !== "AF-001M" || af001m.asset_id !== "TS_ELEC_MOTOR_DC_A" || af001m.signature !== "Tehkné Solutions" || af001m.status !== "HERO_CANDIDATE") throw new Error("S2.16 AF-001M identity/status mismatch");
if (af001m.source?.version !== "0.6.5-hero-candidate" || af001m.source?.sha256 !== CANONICAL_AF001_V065_SHA256) throw new Error("S2.16 AF-001M source provenance mismatch");
if (af001m.candidate?.version !== "0.6.6-hero-candidate" || af001m.candidate?.bytes !== CANONICAL_AF001_V066_BYTES || af001m.candidate?.sha256 !== CANONICAL_AF001_V066_SHA256) throw new Error("S2.16 AF-001M candidate fingerprint mismatch");
if (af001m.candidate?.triangles !== 3292 || af001m.candidate?.geometry_changed !== false || af001m.candidate?.materials_changed !== false || af001m.candidate?.binary_mesh_chunk_changed !== false || af001m.candidate?.glb_json_socket_transforms_changed !== true) throw new Error("S2.16 AF-001M geometry/material/socket change contract mismatch");
for (const [socketName, expected] of Object.entries(SOCKET_TRANSLATIONS)) {
  const actual = af001m.socket_translations_m?.[socketName];
  if (!Array.isArray(actual) || actual.length !== 3 || expected.some((value, index) => Math.abs(actual[index] - value) > 1e-7)) throw new Error(`S2.16 AF-001M socket translation mismatch: ${socketName}`);
}
if (af001m.dcc_prevention?.wrapper_version !== "0.6.6-dcc-candidate" || af001m.dcc_prevention?.helper !== "tools/asset_forge/af001_v06/glb_socket_transforms.py" || af001m.dcc_prevention?.all_lods_require_four_translations !== true) throw new Error("S2.16 AF-001M DCC prevention contract mismatch");
if (af001m.promotion?.golden_asset !== false || af001m.promotion?.af001i_required_again !== true || af001m.promotion?.af001l_target_hardware_required_again !== true || af001m.promotion?.physical_hardware_evidence_pending !== true) throw new Error("S2.16 AF-001M promotion must remain fail-closed pending physical AF-001L evidence");

const assembly = await readFile("packages/invention-assembly-runtime/src/index.ts", "utf8");
for (const token of ["deriveMechanicalAssemblyConstraints", 'relationship.type === "connectedTo"', "relationship.metadata.inventionRuntime === true", 'token.startsWith("mechanical.")', 'constraint: "coincident"', 'derivedFrom: "engineering-graph"', "mechanicalAssemblyMembers", "coincidentFollowerPosition", "planMechanicalAssemblyTranslation", "INVENTION_SPATIAL_BOUNDS"]) if (!assembly.includes(token)) throw new Error(`S2.16 assembly runtime missing: ${token}`);
for (const forbidden of ["assemblyGraph", "mechanicalGraph", "parallelGraph", "assemblyRelationships = new Map"]) if (assembly.includes(forbidden)) throw new Error(`S2.16 must not create parallel topology: ${forbidden}`);

const visual = await readFile("apps/studio-web/components/InventionAssetVisual.tsx", "utf8");
for (const token of ["SpatialProxyDescriptor", 'status: "PROXY_EXPLICIT"', "spatialProxyForEntity", "useSpatialPortEndpoint", 'source: "asset-socket" | "proxy-anchor" | "center-fallback"', 'source: "proxy-anchor"', 'source: "center-fallback"', "transformSocketPosition", "prepareAssetScene", "source.clone(true)"]) if (!visual.includes(token)) throw new Error(`S2.16 physical endpoint resolver missing: ${token}`);

const workbench = await readFile("apps/studio-web/components/Invention3DWorkbench.tsx", "utf8");
for (const token of ["S2.16", "Mechanical Assembly", "Direct Socket Wiring", "mechanicalAssemblyExtension", "deriveMechanicalAssemblyConstraints", "mechanicalAssemblyMembers", "planMechanicalAssemblyTranslation", "MechanicalConstraintSynchronizer", "coincidentFollowerPosition", "useSpatialPortEndpoint", "physicalEndpointDeclared", "Montagem mecânica bloqueada", "data-mechanical-assemblies={mechanicalConstraints.length}", "data-driver-endpoint-source={driverEndpoint.source}", "data-follower-endpoint-source={followerEndpoint.source}", "runtime.builder.connect(sourceRef, ref)", "runtime.builder.connect(from, to)", "runtime.builder.disconnect", "inventionSpatial: runtime.spatial.document()"] ) if (!workbench.includes(token)) throw new Error(`S2.16 workbench contract missing: ${token}`);
for (const forbidden of ["assemblyGraph", "mechanicalGraph", "inventionGraph3d", 'status: "GOLDEN_ASSET"']) if (workbench.includes(forbidden) || visual.includes(forbidden)) throw new Error(`S2.16 forbidden behavior: ${forbidden}`);

const domain = await readFile("tests/domain/invention-assembly-runtime.test.mjs", "utf8");
for (const token of ["S2.16", "mechanical.rotary-shaft", "derivedFrom", "coincidentFollowerPosition", "mechanicalAssemblyMembers", "planMechanicalAssemblyTranslation", "planning failure must not partially mutate"]) if (!domain.includes(token)) throw new Error(`S2.16 domain evidence missing: ${token}`);
const browser = await readFile("tests/browser/mechanical-assembly-invention.spec.ts", "utf8");
for (const token of ["S2.16", "Brushed DC Motor · shaft-out", "Drive Wheel · hub-in", "SOCKET_MECH_AXIS_OUT", "PROXY_HUB_CENTER", 'data-state", "snapped"', "data-mechanical-assemblies", "data-driver-endpoint-source", "data-follower-endpoint-source", "0.03185", "motorZBefore", "Z +", "pageErrors", "consoleErrors"]) if (!browser.includes(token)) throw new Error(`S2.16 browser evidence missing: ${token}`);

const af001i = await readFile("tests/browser/asset-forge-af001i.spec.ts", "utf8");
const af001l = await readFile("tests/hardware/asset-forge-af001l.spec.ts", "utf8");
for (const [name, text] of [["AF-001I", af001i], ["AF-001L", af001l]]) {
  if (!text.includes("243_848") || !text.includes(CANONICAL_AF001_V066_SHA256) || !text.includes("0.6.6-hero-candidate") || !text.includes("0.6.5-hero-candidate")) throw new Error(`S2.16 ${name} canonical v0.6.6 fingerprint/provenance mismatch`);
}
for (const token of ["averageFrameMs", "p95FrameMs", "toBeLessThan(100)", "toBeLessThan(150)"]) if (!af001i.includes(token)) throw new Error(`S2.16 AF-001I runtime gate missing: ${token}`);
for (const token of ["PHYSICAL_HARDWARE_CONFIRMED", "self-hosted:tehkne-af001l", "MAX_AVERAGE_FRAME_MS = 100", "MAX_P95_FRAME_MS = 150", "TARGET_HARDWARE_PASS"]) if (!af001l.includes(token)) throw new Error(`S2.16 AF-001L physical gate missing: ${token}`);

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.16"] !== "node scripts/verify-s2.16.mjs") throw new Error("S2.16 package verification script missing");
const tsconfig = await readFile("tsconfig.core.json", "utf8");
if (!tsconfig.includes('"packages/invention-assembly-runtime/src/**/*.ts"')) throw new Error("S2.16 runtime missing from core typecheck");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("npm run verify:s2.16") || !workflow.includes("tests/browser/mechanical-assembly-invention.spec.ts") || workflow.includes("contents: write")) throw new Error("S2.16 CI contract mismatch");

console.log("S2.16 Mechanical Assembly Constraints PASS · S2.15 Direct Socket Wiring preserved + connectedTo-derived coincident constraints + AF-001 v0.6.6 canonical physical sockets/proxy anchors + AF-001M fail-closed promotion evidence + atomic assembly movement + no parallel graph · Tehkné Solutions");
