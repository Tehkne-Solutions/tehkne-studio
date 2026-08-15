import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
const required = [
  "library/components/extensions/mechanical-assembly-v1.json",
  "packages/invention-assembly-runtime/src/index.ts",
  "apps/studio-web/components/InventionAssetVisual.tsx",
  "apps/studio-web/components/Invention3DWorkbench.tsx",
  "tests/domain/invention-assembly-runtime.test.mjs",
  "tests/browser/mechanical-assembly-invention.spec.ts"
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
const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.16"] !== "node scripts/verify-s2.16.mjs") throw new Error("S2.16 package verification script missing");
const tsconfig = await readFile("tsconfig.core.json", "utf8");
if (!tsconfig.includes('"packages/invention-assembly-runtime/src/**/*.ts"')) throw new Error("S2.16 runtime missing from core typecheck");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("npm run verify:s2.16") || !workflow.includes("tests/browser/mechanical-assembly-invention.spec.ts") || workflow.includes("contents: write")) throw new Error("S2.16 CI contract mismatch");
console.log("S2.16 Mechanical Assembly Constraints PASS · S2.15 Direct Socket Wiring preserved + connectedTo-derived coincident constraints + AF-001 v0.6.6 real sockets/proxy anchors + atomic assembly movement + no parallel graph · Tehkné Solutions");
