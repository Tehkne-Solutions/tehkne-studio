import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import chunk0 from "./lod0/payload-v040-0";
import chunk1a from "./lod0/payload-v040-1a";
import chunk1b from "./lod0/payload-v040-1b";
import chunk2a from "./lod0/payload-v040-2a";
import chunk2b from "./lod0/payload-v040-2b";

const EXPECTED_GZIP_BYTES = 11876;
const EXPECTED_GZIP_SHA256 = "934103b364a528383c5cc1d024d3108f147a0c1cca30518efcce4b45b4916d95";
const EXPECTED_GLB_BYTES = 59436;
const EXPECTED_GLB_SHA256 = "451d97b50ed9321c45b8dfb7e679cf6f273ec335da837d2c49d377426b98f122";

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function GET() {
  const compressed = Buffer.from(chunk0 + chunk1a + chunk1b + chunk2a + chunk2b, "base64");
  const transportSha = sha256(compressed);
  if (compressed.length !== EXPECTED_GZIP_BYTES || transportSha !== EXPECTED_GZIP_SHA256) {
    return Response.json({ stage: "transport", bytes: compressed.length, sha256: transportSha, signature: "Tehkné Solutions" }, { status: 500 });
  }
  const glb = gunzipSync(compressed);
  const glbSha = sha256(glb);
  if (glb.length !== EXPECTED_GLB_BYTES || glbSha !== EXPECTED_GLB_SHA256) {
    return Response.json({ stage: "glb", bytes: glb.length, sha256: glbSha, signature: "Tehkné Solutions" }, { status: 500 });
  }
  return new Response(glb, {
    status: 200,
    headers: {
      "Content-Type": "model/gltf-binary",
      "Content-Length": String(glb.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Tehkne-Asset-Id": "AF-002",
      "X-Tehkne-Asset-Sku": "TS_MECH_SHAFT_COUPLER_A",
      "X-Tehkne-Asset-Version": "0.4.0-visual-quality",
      "X-Tehkne-Asset-Stage": "VISUAL_QUALITY_CANDIDATE",
      "X-Tehkne-Asset-Triangles": "10816",
      "X-Tehkne-Asset-Sha256": EXPECTED_GLB_SHA256,
      "X-Tehkne-Runtime-Promoted": "false",
      "X-Tehkne-Signature": "Tehkné Solutions"
    }
  });
}
