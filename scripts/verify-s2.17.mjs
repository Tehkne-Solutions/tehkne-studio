import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/invention-spatial-runtime/src/index.ts",
  "packages/invention-assembly-runtime/src/index.ts",
  "library/components/extensions/asset-forge-v1.json",
  "library/components/extensions/mechanical-assembly-v1.json",
  "apps/studio-web/components/Invention3DWorkbench.tsx",
  "apps/studio-web/components/MechanicalOrientationSynchronizer.tsx",
  "tests/domain/invention-orientation-runtime.test.mjs",
  "tests/browser/mechanical-orientation-invention.spec.ts"
];
for (const path of required) await access(resolve(path));

const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = assetForge.components?.find((definition) => definition.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor || assetForge.signature !== "Tehkné Solutions") throw new Error("S2.17 AF-001 component/signature missing");
if (motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE" || motor.metadata?.visualAsset?.version !== "0.6.6-hero-candidate") throw new Error("S2.17 must preserve AF-001 v0.6.6 HERO_CANDIDATE status");
if (motor.metadata?.visualAsset?.bytes !== 243848 || motor.metadata?.visualAsset?.sha256 !== "65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c") throw new Error("S2.17 AF-001 canonical fingerprint mismatch");
if (JSON.stringify(motor.metadata?.mechanicalPortAxisMap?.["shaft-out"]) !== "[0,0,1]" || JSON.stringify(motor.metadata?.mechanicalPortAxisMap?.["mount-front"]) !== "[0,0,1]") throw new Error("S2.17 motor mechanical local axes missing");

const mechanical = JSON.parse(await readFile("library/components/extensions/mechanical-assembly-v1.json", "utf8"));
const wheel = mechanical.components?.find((definition) => definition.definitionId === "mechanical.wheel.drive-v1");
const bracket = mechanical.components?.find((definition) => definition.definitionId === "mechanical.bracket.motor-a-v1");
if (!wheel || !bracket || mechanical.signature !== "Tehkné Solutions") throw new Error("S2.17 mechanical extension identity missing");
if (JSON.stringify(wheel.metadata?.spatialProxy?.portAnchors?.["hub-in"]?.axis) !== "[0,0,1]") throw new Error("S2.17 wheel hub axis missing");
if (JSON.stringify(bracket.metadata?.spatialProxy?.portAnchors?.["motor-mount"]?.axis) !== "[0,0,1]" || JSON.stringify(bracket.metadata?.spatialProxy?.portAnchors?.["frame-mount"]?.axis) !== "[0,1,0]") throw new Error("S2.17 bracket axes missing");

const spatial = await readFile("packages/invention-spatial-runtime/src/index.ts", "utf8");
for (const token of ["rotate(entityId: EntityId, rotation: SpatialVector3)", 'assertFiniteVector(rotation, "Spatial rotation")', "rotation: clone(rotation)", "InventionSpatialDocument", "signature: INVENTION_SPATIAL_SIGNATURE"]) if (!spatial.includes(token)) throw new Error(`S2.17 spatial rotation contract missing: ${token}`);

const assembly = await readFile("packages/invention-assembly-runtime/src/index.ts", "utf8");
for (const token of [
  "MechanicalOrientationConstraint",
  'constraint: "axis-aligned"',
  "deriveMechanicalOrientationConstraints",
  "mechanicalPortAxisMap",
  "spatialProxy",
  "quaternionFromEulerXYZ",
  "quaternionFromUnitVectors",
  "quaternionMultiply",
  "quaternionToEulerXYZ",
  "mechanicalWorldAxis",
  "mechanicalAxesAreAligned",
  "alignedFollowerRotation",
  'derivedFrom: "engineering-graph"',
  'relationship.type === "connectedTo"',
  "relationship.metadata.inventionRuntime === true"
]) if (!assembly.includes(token)) throw new Error(`S2.17 orientation runtime missing: ${token}`);
for (const forbidden of ["orientationGraph", "rigidGraph", "assemblyGraph =", "mechanicalGraph =", "parallelGraph"]) if (assembly.includes(forbidden)) throw new Error(`S2.17 must not create parallel topology: ${forbidden}`);

const synchronizer = await readFile("apps/studio-web/components/MechanicalOrientationSynchronizer.tsx", "utf8");
for (const token of ["MechanicalOrientationSynchronizer", "mechanicalWorldAxis", "mechanicalAxesAreAligned", "alignedFollowerRotation", "spatial.rotate", 'data-state={aligned ? "aligned" : "aligning"}', "data-derived-from={constraint.derivedFrom}"]) if (!synchronizer.includes(token)) throw new Error(`S2.17 synchronizer missing: ${token}`);

const workbench = await readFile("apps/studio-web/components/Invention3DWorkbench.tsx", "utf8");
for (const token of [
  "S2.17",
  "Rigid Mechanical Orientation",
  "Direct Socket Wiring",
  "deriveMechanicalAssemblyConstraints",
  "deriveMechanicalOrientationConstraints",
  "MechanicalOrientationSynchronizer",
  "ROTATE_STEP = Math.PI / 12",
  "rotateSelected",
  "runtime.spatial.rotate(selectedEntityId, next)",
  'data-testid="invention-3d-rotation-controls"',
  "data-mechanical-orientations={orientationConstraints.length}",
  'data-rx={format(selectedBinding.rotation.x)}',
  'data-ry={format(selectedBinding.rotation.y)}',
  'data-rz={format(selectedBinding.rotation.z)}',
  "runtime.builder.connect(sourceRef, ref)",
  "runtime.builder.connect(from, to)",
  "inventionSpatial: runtime.spatial.document()"
]) if (!workbench.includes(token)) throw new Error(`S2.17 workbench contract missing: ${token}`);
for (const forbidden of ["orientationGraph", "rigidGraph", "inventionGraph3d", 'status: "GOLDEN_ASSET"']) if (workbench.includes(forbidden) || synchronizer.includes(forbidden)) throw new Error(`S2.17 forbidden UI topology/promotion: ${forbidden}`);

const domain = await readFile("tests/domain/invention-orientation-runtime.test.mjs", "utf8");
for (const token of ["S2.17", "axis-aligned", "deriveMechanicalOrientationConstraints", "alignedFollowerRotation", "mechanicalAxesAreAligned", "spatial.rotate", "parseInventionSpatialDocument", "Math.PI / 2", "builder.connections()"] ) if (!domain.includes(token)) throw new Error(`S2.17 domain evidence missing: ${token}`);
const browser = await readFile("tests/browser/mechanical-orientation-invention.spec.ts", "utf8");
for (const token of ["S2.17", "Brushed DC Motor · shaft-out", "Drive Wheel · hub-in", "mechanical-orientation-invention-connection-1", 'data-state", "aligned"', "data-derived-from", "data-mechanical-orientations", "RY +", "0.2588,0.0000,0.9659", "Guardar 3D", "pageErrors", "consoleErrors"]) if (!browser.includes(token)) throw new Error(`S2.17 browser evidence missing: ${token}`);

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (pkg.scripts?.["verify:s2.17"] !== "node scripts/verify-s2.17.mjs") throw new Error("S2.17 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("npm run verify:s2.17") || !workflow.includes("tests/browser/mechanical-orientation-invention.spec.ts") || workflow.includes("contents: write")) throw new Error("S2.17 CI contract mismatch");

console.log("S2.17 Rigid Mechanical Orientation PASS · S2.16 coincident + S2.15 Direct Socket Wiring preserved · connectedTo-derived axis alignment · persisted rotation · generic quaternion solver · AF-001 remains HERO_CANDIDATE · no parallel graph · Tehkné Solutions");
