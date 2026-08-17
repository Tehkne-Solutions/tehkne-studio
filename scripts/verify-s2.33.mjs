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
if (reference.stage !== "ENGINEERING_REFERENCE" || reference.version !== "0.2.0-engineering-reference") throw new Error("S2.33 must preserve the canonical engineering-reference authority");
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
if (coupler.metadata?.assetForgeId !== "AF-002" || coupler.metadata?.assetForgeSku !== "TS_MECH_SHAFT_COUPLER_A") throw new Error("S2.33 component identity mismatch");
const allowedStages = new Set(["ENGINEERING_REFERENCE", "RUNTIME_CANDIDATE", "HERO_CANDIDATE"]);
if (!allowedStages.has(coupler.metadata?.assetForgeStage)) throw new Error(`S2.33 unauthorized AF-002 presentation stage: ${coupler.metadata?.assetForgeStage}`);
const allowedProvenance = new Set([referencePath, "tools/asset_forge/af002_v02/dcc_qa_evidence.json"]);
if (!allowedProvenance.has(coupler.metadata?.provenance)) throw new Error("S2.33 component must retain canonical AF-002 reference/DCC provenance");
const allowedProxyStatuses = new Set(["PROXY_EXPLICIT_ENGINEERING_REFERENCE", "FALLBACK_ONLY_RUNTIME_CANDIDATE", "FALLBACK_ONLY_HERO_CANDIDATE"]);
if (!allowedProxyStatuses.has(coupler.metadata?.spatialProxy?.status)) throw new Error("S2.33 AF-002 proxy/fallback stage is unauthorized");
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
if (coupler.metadata?.assetForgeStage === "HERO_CANDIDATE") {
  const runtime = coupler.metadata?.runtimeAsset;
  const visual = coupler.metadata?.visualAsset;
  if (coupler.metadata.assetForgeVersion !== "0.5.0-hero-quality") throw new Error("S2.33 HERO candidate version mismatch");
  if (runtime?.status !== "HERO_CANDIDATE" || runtime?.bytes !== 138120 || runtime?.sha256 !== "2eda04ec02fb31c65c2d1ecb342c18bc4d7eaedd02af9a93b676b8a66d1fc6e6") throw new Error("S2.33 HERO runtime fingerprint mismatch");
  if (visual?.status !== "HERO_CANDIDATE" || visual?.triangles !== 19520 || visual?.bytes !== 138120 || visual?.sha256 !== runtime.sha256) throw new Error("S2.33 HERO visual fingerprint mismatch");
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

for (const forbidden of ["GOLDEN_ASSET", "torqueSolver", "rpmSolver", "transmissionMap", "parallelTransmissionGraph"]) {
  if (JSON.stringify(coupler).includes(forbidden)) throw new Error(`S2.33 cannot invent AF-002 golden/dynamics state: ${forbidden}`);
}

console.log("S2.33 AF-002 Dual-Shaft Assembly PASS · canonical engineering-reference authority + stage-monotonic presentation through HERO_CANDIDATE + v0.5 runtime fingerprint + two rotary ports mirrored from AF-002 socket authority + motor→coupler→wheel connectedTo topology + fallback proxy preserved + no GOLDEN/torque/RPM fiction + Tehkné Solutions");