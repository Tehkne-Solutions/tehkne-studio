import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import chunk0 from "./lod0/payload-v050-0";
import chunk1 from "./lod0/payload-v050-1";
import chunk2 from "./lod0/payload-v050-2";
import chunk3 from "./lod0/payload-v050-3";
import chunk4 from "./lod0/payload-v050-4";
import chunk5 from "./lod0/payload-v050-5";
import chunk6 from "./lod0/payload-v050-6";

const EXPECTED_GZIP_BYTES = 31462;
const EXPECTED_GZIP_SHA256 = "81d01b94a46d6cd160c8ebc47603ec911fe37ed6cab9c3bac1e655e202f4827c";
const EXPECTED_GLB_BYTES = 138120;
const EXPECTED_GLB_SHA256 = "2eda04ec02fb31c65c2d1ecb342c18bc4d7eaedd02af9a93b676b8a66d1fc6e6";

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function GET() {
  const compressed = Buffer.from(chunk0 + chunk1 + chunk2 + chunk3 + chunk4 + chunk5 + chunk6, "base64");
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
      "X-Tehkne-Asset-Version": "0.5.0-hero-quality",
      "X-Tehkne-Asset-Stage": "HERO_CANDIDATE",
      "X-Tehkne-Asset-Triangles": "19520",
      "X-Tehkne-Asset-Sha256": EXPECTED_GLB_SHA256,
      "X-Tehkne-Runtime-Promoted": "true",
      "X-Tehkne-Hero-Promoted": "true",
      "X-Tehkne-Golden-Asset": "false",
      "X-Tehkne-Signature": "Tehkné Solutions"
    }
  });
}
