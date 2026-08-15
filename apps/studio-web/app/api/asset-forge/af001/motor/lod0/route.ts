import { createHash } from "node:crypto";
import { brotliDecompressSync } from "node:zlib";

import payload0 from "./payload-v065-0";
import payload1 from "./payload-v065-1";
import payload2 from "./payload-v065-2";
import payload3 from "./payload-v065-3";
import payload4 from "./payload-v065-4";
import payload5 from "./payload-v065-5";

const SOURCE_VERSION = "0.6.5-hero-candidate";
const SOURCE_BYTES = 243_672;
const SOURCE_SHA256 = "ad73d83d0dcd8485a8c2a7a680f83090a98d637cea455dde4915f0d771cd6552";
const SOURCE_COMPRESSED_BYTES = 25_162;
const SOURCE_COMPRESSED_SHA256 = "f6b1062238c941f81bbd5c38e154add9bb4ab56b81c06f9c45989c9604dd90c8";
const EXPECTED_VERSION = "0.6.6-hero-candidate";
const EXPECTED_BYTES = 243_848;
const EXPECTED_SHA256 = "d19e51fd33c461cf761b7c2c086c1284fc4ddfb38f3274acabd88e33fc5ce487";
const EXPECTED_TRIANGLES = 3_292;
const EXPECTED_LOD = "LOD0";
const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

const SOCKET_TRANSLATIONS: Readonly<Record<string, readonly [number, number, number]>> = Object.freeze({
  SOCKET_MECH_AXIS_OUT: [0, 0, 0.03185],
  SOCKET_MECH_MOUNT_FRONT: [0, 0, 0.01655],
  SOCKET_ELEC_POWER_POS: [-0.0047, -0.00085, -0.01936],
  SOCKET_ELEC_POWER_NEG: [0.0047, -0.00085, -0.01936]
});

let cachedMotor: Buffer | null = null;

function digest(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function reconstructCompressedPayload(): Buffer {
  const payload = Buffer.from(
    [payload0, payload1, payload2, payload3, payload4, payload5].join(""),
    "base64"
  );
  if (payload.byteLength !== SOURCE_COMPRESSED_BYTES) {
    throw new Error(`AF001 v0.6.6 source Brotli byte-length mismatch: expected ${SOURCE_COMPRESSED_BYTES}, received ${payload.byteLength}`);
  }
  const compressedDigest = digest(payload);
  if (compressedDigest !== SOURCE_COMPRESSED_SHA256) {
    throw new Error(`AF001 v0.6.6 source Brotli SHA-256 mismatch: expected ${SOURCE_COMPRESSED_SHA256}, received ${compressedDigest}`);
  }
  return payload;
}

function materializeSourceMotor(): Buffer {
  let motor: Buffer;
  try {
    motor = brotliDecompressSync(reconstructCompressedPayload());
  } catch (error) {
    throw new Error(`AF001 v0.6.6 source Brotli decompression failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (motor.byteLength !== SOURCE_BYTES) {
    throw new Error(`AF001 v0.6.6 source GLB byte-length mismatch: expected ${SOURCE_BYTES}, received ${motor.byteLength}`);
  }
  const motorDigest = digest(motor);
  if (motorDigest !== SOURCE_SHA256) {
    throw new Error(`AF001 v0.6.6 source GLB SHA-256 mismatch: expected ${SOURCE_SHA256}, received ${motorDigest}`);
  }
  return motor;
}

function patchSocketTransforms(source: Buffer): Buffer {
  if (source.byteLength < 28) throw new Error("AF001 v0.6.6 source GLB is truncated");
  if (
    source.readUInt32LE(0) !== GLB_MAGIC ||
    source.readUInt32LE(4) !== GLB_VERSION ||
    source.readUInt32LE(8) !== source.byteLength
  ) {
    throw new Error("AF001 v0.6.6 source GLB header mismatch");
  }
  const jsonLength = source.readUInt32LE(12);
  const jsonType = source.readUInt32LE(16);
  if (jsonType !== JSON_CHUNK) throw new Error("AF001 v0.6.6 source GLB first chunk must be JSON");
  const jsonStart = 20;
  const jsonEnd = jsonStart + jsonLength;
  if (jsonEnd + 8 > source.byteLength) throw new Error("AF001 v0.6.6 source JSON chunk exceeds payload");
  const binLength = source.readUInt32LE(jsonEnd);
  const binType = source.readUInt32LE(jsonEnd + 4);
  if (binType !== BIN_CHUNK) throw new Error("AF001 v0.6.6 source GLB second chunk must be BIN");
  const binStart = jsonEnd + 8;
  const binEnd = binStart + binLength;
  if (binEnd !== source.byteLength) throw new Error("AF001 v0.6.6 source GLB must contain exactly JSON + BIN chunks");

  const document = JSON.parse(
    source.subarray(jsonStart, jsonEnd).toString("utf8").trimEnd()
  ) as { nodes?: Array<{ name?: string; translation?: number[] }> };
  if (!Array.isArray(document.nodes)) throw new Error("AF001 v0.6.6 source GLB nodes are missing");

  for (const [socketName, translation] of Object.entries(SOCKET_TRANSLATIONS)) {
    const matches = document.nodes.filter((node) => node.name === socketName);
    if (matches.length !== 1) {
      throw new Error(`AF001 v0.6.6 requires exactly one ${socketName} node; found ${matches.length}`);
    }
    matches[0]!.translation = [...translation];
  }

  const jsonPayload = Buffer.from(JSON.stringify(document), "utf8");
  const paddedJsonLength = Math.ceil(jsonPayload.byteLength / 4) * 4;
  const paddedJson = Buffer.alloc(paddedJsonLength, 0x20);
  jsonPayload.copy(paddedJson);
  const binPayload = source.subarray(binStart, binEnd);
  const totalLength = 12 + 8 + paddedJson.byteLength + 8 + binPayload.byteLength;
  const candidate = Buffer.alloc(totalLength);
  candidate.writeUInt32LE(GLB_MAGIC, 0);
  candidate.writeUInt32LE(GLB_VERSION, 4);
  candidate.writeUInt32LE(totalLength, 8);
  candidate.writeUInt32LE(paddedJson.byteLength, 12);
  candidate.writeUInt32LE(JSON_CHUNK, 16);
  paddedJson.copy(candidate, 20);
  const candidateBinHeader = 20 + paddedJson.byteLength;
  candidate.writeUInt32LE(binPayload.byteLength, candidateBinHeader);
  candidate.writeUInt32LE(BIN_CHUNK, candidateBinHeader + 4);
  binPayload.copy(candidate, candidateBinHeader + 8);
  return candidate;
}

function loadMotor(): Buffer {
  if (cachedMotor) return cachedMotor;
  const motor = patchSocketTransforms(materializeSourceMotor());
  if (motor.byteLength !== EXPECTED_BYTES) {
    throw new Error(`AF001 v0.6.6 GLB byte-length mismatch: expected ${EXPECTED_BYTES}, received ${motor.byteLength}`);
  }
  const motorDigest = digest(motor);
  if (motorDigest !== EXPECTED_SHA256) {
    throw new Error(`AF001 v0.6.6 GLB SHA-256 mismatch: expected ${EXPECTED_SHA256}, received ${motorDigest}`);
  }
  cachedMotor = motor;
  return motor;
}

function toResponseBody(buffer: Buffer): ArrayBuffer {
  const body = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(body).set(buffer);
  return body;
}

export async function GET() {
  const motor = loadMotor();
  return new Response(toResponseBody(motor), {
    status: 200,
    headers: {
      "Content-Type": "model/gltf-binary",
      "Content-Length": String(motor.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Tehkne-Asset-Id": "TS_ELEC_MOTOR_DC_A",
      "X-Tehkne-Asset-Version": EXPECTED_VERSION,
      "X-Tehkne-Asset-Lod": EXPECTED_LOD,
      "X-Tehkne-Asset-Triangles": String(EXPECTED_TRIANGLES),
      "X-Tehkne-Asset-Sha256": EXPECTED_SHA256,
      "X-Tehkne-Asset-Transport-Sha256": SOURCE_COMPRESSED_SHA256,
      "X-Tehkne-Asset-Source-Version": SOURCE_VERSION,
      "X-Tehkne-Asset-Source-Sha256": SOURCE_SHA256,
      "X-Tehkne-Asset-Socket-Transform-Patch": "glb-json-v1",
      "X-Tehkne-Gate": "AF001I-V066"
    }
  });
}
