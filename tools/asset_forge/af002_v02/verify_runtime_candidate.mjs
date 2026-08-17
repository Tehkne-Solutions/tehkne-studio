import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const ROOT = resolve(process.cwd());
const EXPECTED_GZIP_BYTES = 31462;
const EXPECTED_GZIP_SHA256 = "81d01b94a46d6cd160c8ebc47603ec911fe37ed6cab9c3bac1e655e202f4827c";
const EXPECTED_GLB_BYTES = 138120;
const EXPECTED_GLB_SHA256 = "2eda04ec02fb31c65c2d1ecb342c18bc4d7eaedd02af9a93b676b8a66d1fc6e6";
const PAYLOAD_SUFFIXES = ["0", "1", "2", "3s0", "3s1", "3s2", "3s3", "3s4", "3s5", "4", "5", "6s0", "6s1", "6s2", "6s3", "6s4", "6s5"];
const EXPECTED_SOCKET_TRANSLATIONS = new Map([
  ["SOCKET_MECH_AXIS_IN", [0, 0, -0.0175]],
  ["SOCKET_MECH_AXIS_OUT", [0, 0, 0.0175]],
  ["SOCKET_MECH_INSPECT_A", [0.015, 0, 0]],
  ["SOCKET_MECH_INSPECT_B", [-0.015, 0, 0]]
]);

function fail(message) {
  throw new Error(`AF002_RUNTIME_CANDIDATE BLOCKED: ${message}`);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function payload(suffix) {
  const path = resolve(ROOT, `apps/studio-web/app/api/asset-forge/af002/coupler/lod0/payload-v050-${suffix}.ts`);
  const source = readFileSync(path, "utf8").trim();
  const direct = source.match(/^export default "([A-Za-z0-9+/=]+)";$/);
  if (direct) return direct[1];
  const declared = source.match(/^const payload = "([A-Za-z0-9+/=]+)";\s*export default payload;$/s);
  if (!declared) fail(`invalid payload module ${path}`);
  return declared[1];
}

function glbDocument(glb) {
  if (glb.subarray(0, 4).toString("ascii") !== "glTF") fail("GLB magic mismatch");
  if (glb.readUInt32LE(4) !== 2) fail("GLB version mismatch");
  if (glb.readUInt32LE(8) !== glb.length) fail("GLB declared length mismatch");
  let offset = 12;
  while (offset + 8 <= glb.length) {
    const length = glb.readUInt32LE(offset);
    const type = glb.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = glb.subarray(offset, offset + length);
    offset += length;
    if (type === 0x4e4f534a) return JSON.parse(chunk.toString("utf8").trimEnd());
  }
  fail("GLB JSON chunk missing");
}

const compressed = Buffer.from(PAYLOAD_SUFFIXES.map(payload).join(""), "base64");
if (compressed.length !== EXPECTED_GZIP_BYTES) fail(`gzip bytes ${compressed.length} != ${EXPECTED_GZIP_BYTES}`);
if (sha256(compressed) !== EXPECTED_GZIP_SHA256) fail("gzip SHA-256 mismatch");

const glb = gunzipSync(compressed);
if (glb.length !== EXPECTED_GLB_BYTES) fail(`GLB bytes ${glb.length} != ${EXPECTED_GLB_BYTES}`);
if (sha256(glb) !== EXPECTED_GLB_SHA256) fail("GLB SHA-256 mismatch");

const document = glbDocument(glb);
const nodes = new Map((document.nodes ?? []).filter((node) => node.name).map((node) => [node.name, node]));
for (const [name, expected] of EXPECTED_SOCKET_TRANSLATIONS) {
  const node = nodes.get(name);
  if (!node) fail(`missing socket node ${name}`);
  const actual = node.translation ?? [0, 0, 0];
  if (actual.length !== 3 || actual.some((value, index) => Math.abs(value - expected[index]) > 1e-9)) {
    fail(`socket ${name} translation ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
  }
}

const extension = JSON.parse(readFileSync(resolve(ROOT, "library/components/extensions/asset-forge-af002-v1.json"), "utf8"));
const component = extension.components?.find((entry) => entry.definitionId === "mechanical.coupler.shaft-a-v1");
if (!component) fail("AF-002 component extension missing");
const metadata = component.metadata ?? {};
if (metadata.assetForgeVersion !== "0.5.0-hero-quality") fail("component version is not v0.5 hero quality");
if (metadata.assetForgeStage !== "HERO_CANDIDATE") fail("component stage is not HERO_CANDIDATE");
if (metadata.runtimeAsset?.url !== "/api/asset-forge/af002/coupler") fail("runtime URL mismatch");
if (metadata.runtimeAsset?.status !== "HERO_CANDIDATE") fail("runtime asset status mismatch");
if (metadata.runtimeAsset?.bytes !== EXPECTED_GLB_BYTES) fail("runtime component byte count mismatch");
if (metadata.runtimeAsset?.sha256 !== EXPECTED_GLB_SHA256) fail("runtime component SHA mismatch");
if (metadata.visualAsset?.triangles !== 19520) fail("runtime visual triangle count mismatch");
if (metadata.spatialProxy?.status !== "FALLBACK_ONLY_HERO_CANDIDATE") fail("proxy is not HERO fallback-only");
for (const forbidden of ["torqueCapacity", "maxRpm", "misalignmentCapacity", "stiffness", "damping", "manufacturingCertification"]) {
  if (metadata.physicalClaims?.[forbidden] !== false) fail(`unsupported physical claim ${forbidden} must remain false`);
}
if (JSON.stringify(metadata).includes("GOLDEN_ASSET")) fail("GOLDEN_ASSET must remain blocked");

console.log(`AF002_HERO_CANDIDATE_RUNTIME PASS gzip_bytes=${compressed.length} glb_bytes=${glb.length} triangles=19520 sockets=${EXPECTED_SOCKET_TRANSLATIONS.size}`);
console.log(`AF002_RUNTIME_GLB_SHA256 ${EXPECTED_GLB_SHA256}`);
console.log("AF002_NEXT_GATE STUDIO_RENDER_AND_AF001_SNAP_EVIDENCE");
console.log("Tehkné Solutions");
