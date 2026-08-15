import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { brotliDecompressSync } from "node:zlib";

const ROOT = resolve(process.cwd());
const PAYLOAD_DIR = resolve(ROOT, "apps/studio-web/app/api/asset-forge/af001/motor/lod0");
const EXPECTED_COMPRESSED_BYTES = 25_162;
const EXPECTED_COMPRESSED_SHA256 = "f6b1062238c941f81bbd5c38e154add9bb4ab56b81c06f9c45989c9604dd90c8";
const EXPECTED_GLB_BYTES = 243_672;
const EXPECTED_GLB_SHA256 = "ad73d83d0dcd8485a8c2a7a680f83090a98d637cea455dde4915f0d771cd6552";
const REQUIRED_NODES = [
  "PIVOT_MAIN",
  "PIVOT_SHAFT",
  "BODY_CAN",
  "FRONT_CAP",
  "REAR_CAP",
  "SHAFT",
  "TERMINAL_POS",
  "TERMINAL_NEG",
  "SOCKET_MECH_AXIS_OUT",
  "SOCKET_MECH_MOUNT_FRONT",
  "SOCKET_ELEC_POWER_POS",
  "SOCKET_ELEC_POWER_NEG"
];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function fail(message) {
  throw new Error(`AF001I_V065_CONTRACT BLOCKED: ${message}`);
}

function extractDefaultString(path) {
  const source = readFileSync(path, "utf8");
  const match = source.match(/export\s+default\s+"([A-Za-z0-9+/=]*)"\s*;?/s);
  if (!match) fail(`unable to parse Base64 default export: ${path}`);
  return match[1];
}

function parseGlbJson(glb) {
  if (glb.subarray(0, 4).toString("ascii") !== "glTF") fail("GLB magic mismatch");
  const version = glb.readUInt32LE(4);
  const declaredLength = glb.readUInt32LE(8);
  if (version !== 2) fail(`GLB version mismatch: ${version}`);
  if (declaredLength !== glb.length) fail(`GLB declared length mismatch: ${declaredLength} != ${glb.length}`);

  let offset = 12;
  while (offset + 8 <= glb.length) {
    const chunkLength = glb.readUInt32LE(offset);
    const chunkType = glb.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = glb.subarray(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === 0x4e4f534a) {
      return JSON.parse(chunk.toString("utf8").replace(/\u0000+$/g, "").trimEnd());
    }
  }
  fail("GLB JSON chunk missing");
}

const encoded = Array.from({ length: 6 }, (_, index) =>
  extractDefaultString(resolve(PAYLOAD_DIR, `payload-v065-${index}.ts`))
).join("");
const compressed = Buffer.from(encoded, "base64");

if (compressed.length !== EXPECTED_COMPRESSED_BYTES) {
  fail(`Brotli bytes ${compressed.length} != ${EXPECTED_COMPRESSED_BYTES}`);
}
const compressedHash = sha256(compressed);
if (compressedHash !== EXPECTED_COMPRESSED_SHA256) {
  fail(`Brotli SHA-256 ${compressedHash} != ${EXPECTED_COMPRESSED_SHA256}`);
}

const glb = brotliDecompressSync(compressed);
if (glb.length !== EXPECTED_GLB_BYTES) fail(`GLB bytes ${glb.length} != ${EXPECTED_GLB_BYTES}`);
const glbHash = sha256(glb);
if (glbHash !== EXPECTED_GLB_SHA256) fail(`GLB SHA-256 ${glbHash} != ${EXPECTED_GLB_SHA256}`);

const document = parseGlbJson(glb);
const nodeNames = new Set((document.nodes ?? []).map((node) => node.name).filter(Boolean));
const missingNodes = REQUIRED_NODES.filter((name) => !nodeNames.has(name));
if (missingNodes.length) fail(`required nodes missing: ${missingNodes.join(", ")}`);

console.log(
  `AF001I_V065_CONTRACT PASS chunks=6 brotli_bytes=${compressed.length} glb_bytes=${glb.length} ` +
  `nodes=${document.nodes?.length ?? 0} meshes=${document.meshes?.length ?? 0} materials=${document.materials?.length ?? 0}`
);
console.log(`AF001I_V065_TRANSPORT_SHA256 ${compressedHash}`);
console.log(`AF001I_V065_GLB_SHA256 ${glbHash}`);
console.log("Tehkné Solutions");
