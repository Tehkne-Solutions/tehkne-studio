import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const referencePath = "tools/asset_forge/af002_v02/engineering_reference.json";
for (const path of [
  referencePath,
  "docs/platform/asset-forge/AF-002-ENGINEERING-REFERENCE.md",
  "library/components/extensions/asset-forge-af002-v1.json",
  "tests/domain/invention-af002-dual-shaft-assembly.test.mjs"
]) await access(resolve(path));

const reference = JSON.parse(await readFile(referencePath, "utf8"));
if (reference.assetId !== "AF-002" || reference.sku !== "TS_MECH_SHAFT_COUPLER_A") throw new Error("S2.33 AF-002 identity mismatch");
if (reference.stage !== "ENGINEERING_REFERENCE" || reference.version !== "0.2.0-engineering-reference") throw new Error("S2.33 must preserve engineering-reference stage");
if (reference.signature !== "Tehkné Solutions") throw new Error("S2.33 AF-002 signature mismatch");
if (reference.units !== "m" || reference.coordinateSystem?.rotaryAxis !== "+Z") throw new Error("S2.33 AF-002 coordinate authority mismatch");

const inputSocket = reference.sockets?.find((entry) => entry.name === "SOCKET_MECH_AXIS_IN");
const outputSocket = reference.sockets?.find((entry) => entry.name === "SOCKET_MECH_AXIS_OUT");
if (!inputSocket || inputSocket.type !== "mechanical.rotary-shaft" || inputSocket.role !== "input") throw new Error("S2.33 AF-002 input socket authority missing");
if (!outputSocket || outputSocket.type !== "mechanical.rotary-shaft" || outputSocket.role !== "output") throw new Error("S2.33 AF-002 output socket authority missing");

const extension = JSON.parse(await readFile("library/components/extensions/asset-forge-af002-v1.json", "utf8"));
if (extension.signature !== "Tehkné Solutions") throw new Error("S2.33 extension signature mismatch");
const coupler = extension.components?.find((entry) => entry.definitionId === "mechanical.coupler.shaft-a-v1");
if (!coupler) throw new Error("S2.33 AF-002 component definition missing");
if (coupler.metadata?.assetForgeId !== "AF-002" || coupler.metadata?.assetForgeStage !== "ENGINEERING_REFERENCE") throw new Error("S2.33 component provenance mismatch");
if (coupler.metadata?.provenance !== referencePath) throw new Error("S2.33 component must point to canonical AF-002 reference");
if (coupler.metadata?.spatialProxy?.status !== "PROXY_EXPLICIT_ENGINEERING_REFERENCE") throw new Error("S2.33 must not present AF-002 engineering reference as runtime asset");
for (const [portId, direction, socket] of [["axis-in", "in", inputSocket], ["axis-out", "out", outputSocket]]) {
  const port = coupler.ports?.[portId];
  const anchor = coupler.metadata?.spatialProxy?.portAnchors?.[portId];
  if (!port || port.direction !== direction || !port.compatibility?.includes("mechanical.rotary-shaft")) throw new Error(`S2.33 invalid rotary port: ${portId}`);
  if (!anchor || JSON.stringify(anchor.position) !== JSON.stringify(socket.position) || JSON.stringify(anchor.axis) !== JSON.stringify(socket.outwardAxis)) {
    throw new Error(`S2.33 socket transform mismatch: ${portId}`);
  }
}
for (const claim of ["torqueCapacity", "maxRpm", "misalignmentCapacity", "stiffness", "damping", "manufacturingCertification"]) {
  if (reference.claims?.[claim] !== false || coupler.metadata?.physicalClaims?.[claim] !== false) throw new Error(`S2.33 unsupported AF-002 physical claim must remain false: ${claim}`);
}

const testSource = await readFile("tests/domain/invention-af002-dual-shaft-assembly.test.mjs", "utf8");
for (const token of [
  "mechanical.coupler.shaft-a-v1",
  'portId: "axis-in"',
  'portId: "axis-out"',
  'entry.type === "connectedTo"',
  "two distinct canonical connectedTo relationships",
  "transmissionGraph"
]) if (!testSource.includes(token)) throw new Error(`S2.33 dual-shaft evidence missing: ${token}`);

for (const forbidden of ["GOLDEN_ASSET", "HERO_CANDIDATE", "RUNTIME_CANDIDATE", "torqueSolver", "rpmSolver", "transmissionMap", "parallelTransmissionGraph"]) {
  if (JSON.stringify(coupler).includes(forbidden)) throw new Error(`S2.33 cannot promote or invent AF-002 runtime/dynamics state: ${forbidden}`);
}

console.log("S2.33 AF-002 Dual-Shaft Assembly PASS · canonical engineering-reference component + two rotary ports mirrored from AF-002 socket authority + motor→coupler→wheel connectedTo topology + explicit proxy pending runtime GLB + no torque/RPM fiction + Tehkné Solutions");
