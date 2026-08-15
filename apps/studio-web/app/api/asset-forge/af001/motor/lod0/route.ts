import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { brotliDecompressSync } from "node:zlib";

const EXPECTED_BYTES = 74_472;
const EXPECTED_SHA256 = "2142509d651e5ae1683da383360675b4343cbad83fbbb498326a894cf0c2baae";
const EXPECTED_TRIANGLES = 3_904;
const EXPECTED_LOD = "LOD0";
const COMPRESSED_ASSET_RELATIVE_PATH = ["asset-forge", "af001", "motor-lod0.brotli.bin"];

let cachedMotor: Buffer | null = null;

function digest(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function isExpectedMotor(buffer: Buffer): boolean {
  return buffer.byteLength === EXPECTED_BYTES && digest(buffer) === EXPECTED_SHA256;
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

async function readCompressedPayload(): Promise<Buffer> {
  const candidates = [
    join(process.cwd(), "public", ...COMPRESSED_ASSET_RELATIVE_PATH),
    join(process.cwd(), "apps", "studio-web", "public", ...COMPRESSED_ASSET_RELATIVE_PATH)
  ];

  const failures: string[] = [];
  for (const candidate of candidates) {
    try {
      return await readFile(candidate);
    } catch (error) {
      failures.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`AF001I LOD0 filesystem read failed: ${failures.join(" | ")}`);
}

async function loadMotor(): Promise<Buffer> {
  if (cachedMotor) return cachedMotor;

  // Read the opaque binary directly from disk. Routing the Brotli payload back
  // through the app's public HTTP surface can transform binary transport and
  // invalidates the fail-closed integrity contract before decompression.
  const payload = await readCompressedPayload();
  cachedMotor = materializeMotor(payload);
  return cachedMotor;
}

function toResponseBody(buffer: Buffer): ArrayBuffer {
  const body = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(body).set(buffer);
  return body;
}

export async function GET() {
  const motor = await loadMotor();

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
      "X-Tehkne-Gate": "AF001I"
    }
  });
}
