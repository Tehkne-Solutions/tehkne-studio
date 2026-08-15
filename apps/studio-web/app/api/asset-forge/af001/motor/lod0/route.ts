import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const EXPECTED_BYTES = 76_000;
const EXPECTED_SHA256 = "b88bdbc842dc4852ff6c0f996259cd7c213653c49d53c9541a9ccc13d77cdb8a";
const EXPECTED_TRIANGLES = 3_904;
const EXPECTED_LOD = "LOD0";
const ASSET_VERSION = "0.5.1-hero-candidate-r1";

let cachedMotor: Buffer | null = null;

function digest(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function loadMotor(): Promise<Buffer> {
  if (cachedMotor) return cachedMotor;

  const motor = await readFile(new URL("./motor-lod0-r1.glb", import.meta.url));
  if (motor.byteLength !== EXPECTED_BYTES) {
    throw new Error(`AF001I LOD0 R1 byte-length mismatch: expected ${EXPECTED_BYTES}, received ${motor.byteLength}`);
  }

  const motorDigest = digest(motor);
  if (motorDigest !== EXPECTED_SHA256) {
    throw new Error(`AF001I LOD0 R1 SHA-256 mismatch: expected ${EXPECTED_SHA256}, received ${motorDigest}`);
  }

  cachedMotor = motor;
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
      "X-Tehkne-Asset-Version": ASSET_VERSION,
      "X-Tehkne-Asset-Lod": EXPECTED_LOD,
      "X-Tehkne-Asset-Triangles": String(EXPECTED_TRIANGLES),
      "X-Tehkne-Asset-Sha256": EXPECTED_SHA256,
      "X-Tehkne-Gate": "AF001I-R1"
    }
  });
}
