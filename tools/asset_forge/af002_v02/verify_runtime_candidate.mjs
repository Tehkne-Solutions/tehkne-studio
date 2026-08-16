import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const ROOT = resolve(process.cwd());
const EXPECTED_GZIP_BYTES = 5032;
const EXPECTED_GZIP_SHA256 = "2bd7f252777249e6b27cadded8fb90485968dd41d6b933c33d3d1338a65c0e38";
const EXPECTED_GLB_BYTES = 22600;
const EXPECTED_GLB_SHA256 = "48e8363cdc38b5ae93ace0b975c42498663e03c922970fb2b60e80c65d26b50e";
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

function payload(index) {
  const path = resolve(ROOT, `apps/studio-web/app/api/asset-forge/af002/coupler/lod0/payload-v030-${index}.ts`);
  const source = readFileSync(path, "utf8").trim();
  const match = source.match(/^export default "([A-Za-z0-9+/=]+)";$/);
  if (!match) fail(`invalid payload module ${path}`);
  return match[1];
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

const compressed = Buffer.from(payload(0) + payload(1), "base64");
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
if (metadata.assetForgeStage !== "RUNTIME_CANDIDATE") fail("component stage is not RUNTIME_CANDIDATE");
if (metadata.runtimeAsset?.url !== "/api/asset-forge/af002/coupler") fail("runtime URL mismatch");
if (metadata.runtimeAsset?.sha256 !== EXPECTED_GLB_SHA256) fail("runtime component SHA mismatch");
if (metadata.spatialProxy?.status !== "FALLBACK_ONLY_RUNTIME_CANDIDATE") fail("proxy is not fallback-only");
for (const forbidden of ["torqueCapacity", "maxRpm", "misalignmentCapacity", "stiffness", "damping", "manufacturingCertification"]) {
  if (metadata.physicalClaims?.[forbidden] !== false) fail(`unsupported physical claim ${forbidden} must remain false`);
}

console.log(`AF002_RUNTIME_CANDIDATE PASS gzip_bytes=${compressed.length} glb_bytes=${glb.length} sockets=${EXPECTED_SOCKET_TRANSLATIONS.size}`);
console.log(`AF002_RUNTIME_GLB_SHA256 ${EXPECTED_GLB_SHA256}`);
console.log("AF002_NEXT_GATE STUDIO_RENDER_AND_AF001_SNAP_EVIDENCE");
console.log("Tehkné Solutions");
