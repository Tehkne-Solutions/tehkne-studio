import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "library/components/extensions/asset-forge-v1.json",
  "library/components/extensions/mechanical-assembly-v1.json",
  "packages/invention-assembly-runtime/src/index.ts",
  "apps/studio-web/components/InventionAssetVisual.tsx",
  "apps/studio-web/components/Invention3DWorkbench.tsx",
  "tests/domain/invention-axial-alignment-runtime.test.mjs",
  "tests/browser/axial-joint-alignment.spec.ts"
];
for (const path of required) await access(resolve(path));

const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = assetForge.components?.find((entry) => entry.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor) throw new Error("S2.18 AF-001 motor definition missing");
if (motor.metadata?.mechanicalPortAxisMap?.["shaft-out"]?.join(",") !== "0,0,1") throw new Error("S2.18 AF-001 shaft-out local axis missing");
if (motor.metadata?.visualAsset?.version !== "0.6.6-hero-candidate" || motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.18 must preserve AF-001 HERO_CANDIDATE identity");
if (motor.metadata?.visualAsset?.sha256 !== "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c") throw new Error("S2.18 must not change AF-001 fingerprint");

const mechanical = JSON.parse(await readFile("library/components/extensions/mechanical-assembly-v1.json", "utf8"));
const wheel = mechanical.components?.find((entry) => entry.definitionId === "mechanical.wheel.drive-v1");
if (wheel?.metadata?.spatialProxy?.portAnchors?.["hub-in"]?.axis?.join(",") !== "0,0,1") throw new Error("S2.18 Drive Wheel hub-in local axis missing");

const assembly = await readFile("packages/invention-assembly-runtime/src/index.ts", "utf8");
for (const token of [
  "MechanicalAxialConstraint",
  'constraint: "axis-aligned"',
  "deriveMechanicalAxialConstraints",
  'sharedInterfaces.includes("mechanical.rotary-shaft")',
  "mechanicalPortLocalAxis",
  "mechanicalWorldAxis",
  "mechanicalAxesAreAligned",
  "alignedFollowerRotation",
  "planMechanicalAxialAlignment",
  "followerEndpointLocal",
  "transformedLocalOffset",
  "Mechanical axial alignment would place",
  'derivedFrom: "engineering-graph" as const',
  "planMechanicalAssemblyRotation"
]) {
  if (!assembly.includes(token)) throw new Error(`S2.18 axial planner contract missing: ${token}`);
}
for (const forbidden of ["assemblyGraph", "mechanicalGraph", "rotationGraph", "axialGraph", "parallelGraph"]) {
  if (assembly.includes(forbidden)) throw new Error(`S2.18 must not create parallel topology: ${forbidden}`);
}

const visual = await readFile("apps/studio-web/components/InventionAssetVisual.tsx", "utf8");
for (const token of [
  "readonly axis?: SpatialVector3",
  "readonly localPosition: SpatialVector3",
  "Spatial proxy anchor axis",
  "localPosition = { ...socket.position }",
  "localPosition = { ...anchor.position }",
  'source: "asset-socket"',
  'source: "proxy-anchor"'
]) {
  if (!visual.includes(token)) throw new Error(`S2.18 local endpoint evidence missing: ${token}`);
}

const workbench = await readFile("apps/studio-web/components/Invention3DWorkbench.tsx", "utf8");
for (const token of [
  "Axial Joint Alignment",
  "Rigid Assembly Rotation",
  "deriveMechanicalAxialConstraints",
  "axialConstraintMap",
  "planMechanicalAxialAlignment",
  "followerEndpoint.localPosition",
  "spatial.transformBatch([{ entityId: plan.entityId, position: plan.toPosition, rotation: plan.toRotation }])",
  'data-mechanical-axial-joints={axialConstraints.length}',
  'data-axial-state={axialState}',
  "data-driver-axis={driverAxis ? formatAxis(driverAxis) : \"\"}",
  "data-follower-axis={followerAxis ? formatAxis(followerAxis) : \"\"}",
  "mechanicalAssemblyMembers(mechanicalConstraints, selectedEntityId)",
  "planMechanicalAssemblyRotation",
  'data-spatial-transform-mode="atomic-batch"',
  "inventionSpatial: runtime.spatial.document()"
]) {
  if (!workbench.includes(token)) throw new Error(`S2.18 semantic Workbench contract missing: ${token}`);
}
for (const forbidden of ["torqueSimulation", "implicitTorque", "angularVelocitySolver", "rpmSolver", 'status: "GOLDEN_ASSET"']) {
  if (workbench.includes(forbidden)) throw new Error(`S2.18 forbidden premature behavior: ${forbidden}`);
}

const domain = await readFile("tests/domain/invention-axial-alignment-runtime.test.mjs", "utf8");
for (const token of [
  "S2.18 derives one rotary axial constraint",
  "ignores non-rotary mounts",
  "S2.18 atomic axial planner aligns orientation",
  "planner must not mutate input binding",
  "fails closed before any out-of-bounds",
  "S2.17 rigid assembly rotation planner"
]) {
  if (!domain.includes(token)) throw new Error(`S2.18 domain evidence missing: ${token}`);
}

const browser = await readFile("tests/browser/axial-joint-alignment.spec.ts", "utf8");
for (const token of [
  "S2.18 atomically aligns a misoriented wheel hub",
  'name: "RY +", exact: true',
  'data-axial-state", "aligned"',
  'data-mechanical-axial-joints", "1"',
  "SOCKET_MECH_AXIS_OUT",
  "PROXY_HUB_CENTER",
  "Guardar 3D",
  "page.reload",
  "pageErrors",
  "consoleErrors"
]) {
  if (!browser.includes(token)) throw new Error(`S2.18 browser evidence missing: ${token}`);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.18"] !== "node scripts/verify-s2.18.mjs") throw new Error("S2.18 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("npm run verify:s2.18")) throw new Error("S2.18 CI contract missing");
if (!workflow.includes("tests/browser/axial-joint-alignment.spec.ts")) throw new Error("S2.18 browser gate missing from CI");
if (workflow.includes("contents: write")) throw new Error("S2.18 CI must remain read-only");

console.log("S2.18 Axial Joint Alignment PASS · semantic connectedTo-derived rotary axis contract + atomic spatial batch commit + rigid-rotation composition + no torque fiction + Tehkné Solutions");
