import { createHash } from "node:crypto";
import { brotliDecompressSync } from "node:zlib";
import { readFile } from "node:fs/promises";

const EXPECTED_BYTES = 74_472;
const EXPECTED_SHA256 = "2142509d651e5ae1683da383360675b4343cbad83fbbb498326a894cf0c2baae";
const EXPECTED_TRIANGLES = 3_904;
const EXPECTED_LOD = "LOD0";

let cachedMotor: Buffer | null = null;

async function loadMotor(): Promise<Buffer> {
  if (cachedMotor) return cachedMotor;

  const compressed = await readFile(new URL("./motor-lod0.glb.br", import.meta.url));
  const motor = brotliDecompressSync(compressed);

  if (motor.byteLength !== EXPECTED_BYTES) {
    throw new Error(`AF001I LOD0 byte-length mismatch: expected ${EXPECTED_BYTES}, received ${motor.byteLength}`);
  }

  const digest = createHash("sha256").update(motor).digest("hex");
  if (digest !== EXPECTED_SHA256) {
    throw new Error(`AF001I LOD0 SHA-256 mismatch: expected ${EXPECTED_SHA256}, received ${digest}`);
  }

  cachedMotor = motor;
  return motor;
}

export async function GET() {
  const motor = await loadMotor();

  return new Response(motor, {
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
