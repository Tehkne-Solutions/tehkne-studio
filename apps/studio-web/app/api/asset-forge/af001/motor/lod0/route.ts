import { createHash } from "node:crypto";
import { brotliDecompressSync } from "node:zlib";

import payload0 from "./payload-v065-0";
import payload1 from "./payload-v065-1";
import payload2 from "./payload-v065-2";
import payload3 from "./payload-v065-3";
import payload4 from "./payload-v065-4";
import payload5 from "./payload-v065-5";

const EXPECTED_BYTES = 243_672;
const EXPECTED_SHA256 = "ad73d83d0dcd8485a8c2a7a680f83090a98d637cea455dde4915f0d771cd6552";
const EXPECTED_TRIANGLES = 3_292;
const EXPECTED_LOD = "LOD0";
const EXPECTED_COMPRESSED_BYTES = 25_162;
const EXPECTED_COMPRESSED_SHA256 = "f6b1062238c941f81bbd5c38e154add9bb4ab56b81c06f9c45989c9604dd90c8";

let cachedMotor: Buffer | null = null;

function digest(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function reconstructCompressedPayload(): Buffer {
  const payload = Buffer.from(
    [payload0, payload1, payload2, payload3, payload4, payload5].join(""),
    "base64"
  );

  if (payload.byteLength !== EXPECTED_COMPRESSED_BYTES) {
    throw new Error(
      `AF001I v0.6.5 Brotli byte-length mismatch: expected ${EXPECTED_COMPRESSED_BYTES}, received ${payload.byteLength}`
    );
  }

  const compressedDigest = digest(payload);
  if (compressedDigest !== EXPECTED_COMPRESSED_SHA256) {
    throw new Error(
      `AF001I v0.6.5 Brotli SHA-256 mismatch: expected ${EXPECTED_COMPRESSED_SHA256}, received ${compressedDigest}`
    );
  }

  return payload;
}

function materializeMotor(): Buffer {
  let motor: Buffer;
  try {
    motor = brotliDecompressSync(reconstructCompressedPayload());
  } catch (error) {
    throw new Error(
      `AF001I v0.6.5 Brotli decompression failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (motor.byteLength !== EXPECTED_BYTES) {
    throw new Error(
      `AF001I v0.6.5 GLB byte-length mismatch: expected ${EXPECTED_BYTES}, received ${motor.byteLength}`
    );
  }

  const motorDigest = digest(motor);
  if (motorDigest !== EXPECTED_SHA256) {
    throw new Error(
      `AF001I v0.6.5 GLB SHA-256 mismatch: expected ${EXPECTED_SHA256}, received ${motorDigest}`
    );
  }

  return motor;
}

function loadMotor(): Buffer {
  if (cachedMotor) return cachedMotor;
  cachedMotor = materializeMotor();
  return cachedMotor;
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
      "X-Tehkne-Asset-Version": "0.6.5-hero-candidate",
      "X-Tehkne-Asset-Lod": EXPECTED_LOD,
      "X-Tehkne-Asset-Triangles": String(EXPECTED_TRIANGLES),
      "X-Tehkne-Asset-Sha256": EXPECTED_SHA256,
      "X-Tehkne-Asset-Transport-Sha256": EXPECTED_COMPRESSED_SHA256,
      "X-Tehkne-Gate": "AF001I-V065"
    }
  });
}
