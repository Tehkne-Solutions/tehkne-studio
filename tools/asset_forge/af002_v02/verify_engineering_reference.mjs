import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const PATH = resolve(ROOT, "tools/asset_forge/af002_v02/engineering_reference.json");
const manifest = JSON.parse(readFileSync(PATH, "utf8"));

function fail(message) {
  throw new Error(`AF002_V02_ENGINEERING_REFERENCE BLOCKED: ${message}`);
}

function close(a, b, epsilon = 1e-9) {
  return Math.abs(a - b) <= epsilon;
}

if (manifest.assetId !== "AF-002") fail("assetId mismatch");
if (manifest.sku !== "TS_MECH_SHAFT_COUPLER_A") fail("SKU mismatch");
if (manifest.stage !== "ENGINEERING_REFERENCE") fail("stage mismatch");
if (manifest.signature !== "Tehkné Solutions") fail("signature mismatch");
if (manifest.units !== "m") fail("units must remain metres");
if (manifest.coordinateSystem?.handedness !== "right") fail("right-handed coordinates required");
if (manifest.coordinateSystem?.rotaryAxis !== "+Z") fail("canonical rotary axis must be +Z");

const required = new Set([
  "COUPLER_HALF_IN",
  "COUPLER_HALF_OUT",
  "ELASTIC_INSERT",
  "CLAMP_SCREW_IN_A",
  "CLAMP_SCREW_IN_B",
  "CLAMP_SCREW_OUT_A",
  "CLAMP_SCREW_OUT_B",
  "SOCKET_MECH_AXIS_IN",
  "SOCKET_MECH_AXIS_OUT",
  "SOCKET_MECH_INSPECT_A",
  "SOCKET_MECH_INSPECT_B"
]);
for (const name of required) {
  if (!manifest.requiredNodes?.includes(name)) fail(`required node missing from contract: ${name}`);
}
if (new Set(manifest.requiredNodes ?? []).size !== (manifest.requiredNodes ?? []).length) fail("duplicate required nodes");

const axisIn = manifest.sockets?.find((socket) => socket.name === "SOCKET_MECH_AXIS_IN");
const axisOut = manifest.sockets?.find((socket) => socket.name === "SOCKET_MECH_AXIS_OUT");
if (!axisIn || !axisOut) fail("axis sockets missing");
if (axisIn.type !== "mechanical.rotary-shaft" || axisOut.type !== "mechanical.rotary-shaft") fail("axis socket type mismatch");
if (!close(axisIn.position?.[0], 0) || !close(axisIn.position?.[1], 0)) fail("input socket must lie on rotary axis");
if (!close(axisOut.position?.[0], 0) || !close(axisOut.position?.[1], 0)) fail("output socket must lie on rotary axis");
if (!close(axisIn.position?.[2], -manifest.envelope.overallLength / 2)) fail("input socket plane does not match envelope");
if (!close(axisOut.position?.[2], manifest.envelope.overallLength / 2)) fail("output socket plane does not match envelope");
if (JSON.stringify(axisIn.outwardAxis) !== JSON.stringify([0, 0, -1])) fail("input outward axis mismatch");
if (JSON.stringify(axisOut.outwardAxis) !== JSON.stringify([0, 0, 1])) fail("output outward axis mismatch");
if (!close(axisIn.nominalDiameter, manifest.envelope.nominalBoreIn)) fail("input diameter mismatch");
if (!close(axisOut.nominalDiameter, manifest.envelope.nominalBoreOut)) fail("output diameter mismatch");

for (const inspectionName of ["SOCKET_MECH_INSPECT_A", "SOCKET_MECH_INSPECT_B"]) {
  const inspection = manifest.sockets?.find((socket) => socket.name === inspectionName);
  if (!inspection) fail(`${inspectionName} missing`);
  if (inspection.type !== "mechanical.inspect") fail(`${inspectionName} type mismatch`);
  if (inspection.transmission !== false) fail(`${inspectionName} must remain non-transmission`);
}

const lodBudgets = new Map((manifest.lods ?? []).map((lod) => [lod.name, lod.maxTriangles]));
for (const [name, budget] of [["LOD0", 7500], ["LOD1", 3500], ["LOD2", 1500], ["LOD3", 600]]) {
  if (lodBudgets.get(name) !== budget) fail(`${name} triangle budget mismatch`);
}

for (const material of ["MAT_COUPLER_BODY", "MAT_FASTENER_STEEL", "MAT_ELASTIC_INSERT"]) {
  if (!manifest.materials?.includes(material)) fail(`material contract missing: ${material}`);
}

for (const falseClaim of ["torqueCapacity", "maxRpm", "misalignmentCapacity", "stiffness", "damping", "manufacturingCertification"]) {
  if (manifest.claims?.[falseClaim] !== false) fail(`unsupported physical claim enabled: ${falseClaim}`);
}

console.log(`AF002_V02_ENGINEERING_REFERENCE PASS nodes=${manifest.requiredNodes.length} sockets=${manifest.sockets.length} lods=${manifest.lods.length}`);
console.log("AF002_NEXT_GATE DCC_CANDIDATE");
console.log("Tehkné Solutions");
