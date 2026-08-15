import { createHash } from "node:crypto";
import { brotliDecompressSync } from "node:zlib";

import payload0 from "./payload-0";
import payload1 from "./payload-1";
import payload2 from "./payload-2";
import payload3 from "./payload-3";
import payloadTail0 from "./payload-tail-0";
import payloadTail1 from "./payload-tail-1";
import payloadTail2 from "./payload-tail-2";
import payloadTail3 from "./payload-tail-3";

const EXPECTED_BYTES = 74_472;
const EXPECTED_SHA256 = "2142509d651e5ae1683da383360675b4343cbad83fbbb498326a894cf0c2baae";
const EXPECTED_TRIANGLES = 3_904;
const EXPECTED_LOD = "LOD0";
const EXPECTED_COMPRESSED_BYTES = 13_519;
const EXPECTED_COMPRESSED_SHA256 = "747034a1fe0082c7b96e66df3891d84895f81d63820d4235730b92ae5e23cd8f";

let cachedMotor: Buffer | null = null;

function digest(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function isExpectedMotor(buffer: Buffer): boolean {
  return buffer.byteLength === EXPECTED_BYTES && digest(buffer) === EXPECTED_SHA256;
}

function reconstructCompressedPayload(): Buffer {
  // The first four Base64 chunks contain exactly 9,000 bytes. The remaining
  // 4,519 bytes are hexadecimal text. Keeping the transport textual avoids
  // binary rewriting while preserving a byte-for-byte, checksum-verified
  // Brotli payload in the source tree.
  const prefix = Buffer.from([payload0, payload1, payload2, payload3].join(""), "base64");
  const tail = Buffer.from(
    [payloadTail0, payloadTail1, payloadTail2, payloadTail3].join(""),
    "hex"
  );
  const payload = Buffer.concat([prefix, tail]);

  if (payload.byteLength !== EXPECTED_COMPRESSED_BYTES) {
    throw new Error(
      `AF001I Brotli byte-length mismatch: expected ${EXPECTED_COMPRESSED_BYTES}, received ${payload.byteLength}`
    );
  }

  const compressedDigest = digest(payload);
  if (compressedDigest !== EXPECTED_COMPRESSED_SHA256) {
    throw new Error(
      `AF001I Brotli SHA-256 mismatch: expected ${EXPECTED_COMPRESSED_SHA256}, received ${compressedDigest}`
    );
  }

  return payload;
}

function materializeMotor(payload: Buffer): Buffer {
  if (isExpectedMotor(payload)) return payload;

  let motor: Buffer;
  try {
    motor = brotliDecompressSync(payload);
  } catch (error) {
    throw new Error(
      `AF001I LOD0 payload is neither the expected GLB nor valid Brotli: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (motor.byteLength !== EXPECTED_BYTES) {
    throw new Error(`AF001I LOD0 byte-length mismatch: expected ${EXPECTED_BYTES}, received ${motor.byteLength}`);
  }

  const motorDigest = digest(motor);
  if (motorDigest !== EXPECTED_SHA256) {
    throw new Error(`AF001I LOD0 SHA-256 mismatch: expected ${EXPECTED_SHA256}, received ${motorDigest}`);
  }

  return motor;
}

function loadMotor(): Buffer {
  if (cachedMotor) return cachedMotor;
  cachedMotor = materializeMotor(reconstructCompressedPayload());
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
      "X-Tehkne-Asset-Version": "0.5.1-hero-candidate",
      "X-Tehkne-Asset-Lod": EXPECTED_LOD,
      "X-Tehkne-Asset-Triangles": String(EXPECTED_TRIANGLES),
      "X-Tehkne-Asset-Sha256": EXPECTED_SHA256,
      "X-Tehkne-Asset-Transport-Sha256": EXPECTED_COMPRESSED_SHA256,
      "X-Tehkne-Gate": "AF001I"
    }
  });
}
