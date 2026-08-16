import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import chunk0 from "./lod0/payload-v030-0";
import chunk1 from "./lod0/payload-v030-1";

const EXPECTED_GZIP_BYTES = 5032;
const EXPECTED_GZIP_SHA256 = "2bd7f252777249e6b27cadded8fb90485968dd41d6b933c33d3d1338a65c0e38";
const EXPECTED_GLB_BYTES = 22600;
const EXPECTED_GLB_SHA256 = "48e8363cdc38b5ae93ace0b975c42498663e03c922970fb2b60e80c65d26b50e";

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function GET() {
  const compressed = Buffer.from(chunk0 + chunk1, "base64");
  if (compressed.length !== EXPECTED_GZIP_BYTES || sha256(compressed) !== EXPECTED_GZIP_SHA256) {
    return new Response("AF-002 runtime transport integrity failure", { status: 500 });
  }

  const glb = gunzipSync(compressed);
  if (glb.length !== EXPECTED_GLB_BYTES || sha256(glb) !== EXPECTED_GLB_SHA256) {
    return new Response("AF-002 runtime GLB integrity failure", { status: 500 });
  }

  return new Response(glb, {
    status: 200,
    headers: {
      "Content-Type": "model/gltf-binary",
      "Content-Length": String(glb.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Tehkne-Asset-Id": "AF-002",
      "X-Tehkne-Asset-Sku": "TS_MECH_SHAFT_COUPLER_A",
      "X-Tehkne-Asset-Stage": "RUNTIME_CANDIDATE",
      "X-Tehkne-Asset-Sha256": EXPECTED_GLB_SHA256,
      "X-Tehkne-Signature": "Tehkné Solutions"
    }
  });
}
