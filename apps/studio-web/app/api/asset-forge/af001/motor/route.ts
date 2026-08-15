import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

const EXPECTED_BYTES = 21_452;
const EXPECTED_SHA256 = "0a74f27df8a67b61e5ac10b87c0b6fa3736531fac15044bb360a641da6228e69";

const MOTOR_GZIP_BASE64_CHUNKS = [
  "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",
  "oWeu5lG/L4OeuZpH/V4GPXM1j/q9HHrmah71ewX0zNU86vdK6JmredTvVdAzV/Oo36uhZ67mUb8vh565mkf9XgM9czUPDl4B",
  "PXP17qNKvfbhb1V94u+O6xX7q1Tsrn+x+GN+Ul15+mcWZ9ZG1Om/+JXFf3ioQv1qyVxF+Ae716vY+gUWv3bTFeqJXYssbvrO",
  "Un3DbYtZr1lv7DXbGz+a/Rj/mv2bfjX3a+LRHI+JU5s4A6EPhH0g/ATCvxb9ahGPRpzKxKlF/FrkpUW+WoxDIMYnEONm8SNn",
  "6tUjZ56uqj2U0xsP1an77/pni3/vq9Xqr2p/bvHIKym1/nVHEV60xlf3BvMtrv3m9erTDyyy+K+7rla1qcss1iPL6GG9Zr2x",
  "12xv/Gj2Y/xr9m/61dyviUdzPCZO8zwdCH0g7APhRwv/WvSrRTwacSqKVcSvRV5a5KvFOGgxPoEYtwBx8ngqMZ5KjKcS46nE",
  "eCoxnkqMpxLjqcR4KjGeSoynEuOpxHgqMZ5KjKcS46nEeCoxnkqMpxLjqcR4KjGeSoynEuOpxHgqMZ5KjKcS46nEfFdivisx",
  "35WY70rMdyXmuxLzXYn5rsR8V2K+KzHflZjvSsx3Jea7EvNdifmuxHxXYr4rMd+VmO9KzHcl5rsS812J+a7EfFdivisx35WY",
  "7wrLqkNzX2D1hbO/ZbZ5o9Wff/Oklff/5wkrCw+OWPmxVN7KrjeOWvmNNTkr6+vnbCX53Ru+t4Xkv9Z/zsrG7lNW7l8ft/LF",
  "7bOsfP4/nlQkv3D2rJLf+Xe25/bsj/3//Ge3F/XP8XB8HC/Hz/nQc+LEieo/9e+28qv/eMrKp+actPLh14etPPRKv5U/uLrb",
  "StoWk3xp/jNbSP76p/dZ+d9f32blJ7tfViT/6R92WflW554qtHPkd/6d7bk9+2P/ZkdR1D/Hw/FxvBw/50P53XfP/C30nST9",
  "TpLsSVJ7kuSPJPknSfmRpP5JUjwkKT6SFC9Jip8k5YN2jvzOv7M9t2d/7J/yk/1zPBwfx8vxcz4hPx0nfJ+OE75fxwnft+OE",
  "79/slywfHCfkhzlDWH46Tsgfxwn5ZPb4ll9mn2n55jgh/xwn5KPjhPwc/86/sz23Z3/sP+TneP8cD8fH8XL8nE94zBrlo9f7",
  "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",
] as const;

export const runtime = "nodejs";

export async function GET() {
  const encoded = MOTOR_GZIP_BASE64_CHUNKS.join("");
  const payload = gunzipSync(Buffer.from(encoded, "base64"));
  const digest = createHash("sha256").update(payload).digest("hex");

  if (payload.byteLength !== EXPECTED_BYTES || digest !== EXPECTED_SHA256) {
    return Response.json(
      { error: "AF001H_ASSET_INTEGRITY_FAILURE", expectedBytes: EXPECTED_BYTES, actualBytes: payload.byteLength, expectedSha256: EXPECTED_SHA256, actualSha256: digest },
      { status: 500 }
    );
  }

  return new Response(payload, {
    headers: {
      "Content-Type": "model/gltf-binary",
      "Content-Length": String(payload.byteLength),
      "Cache-Control": "no-store",
      "X-Tehkne-Asset-Sha256": digest,
      "X-Tehkne-Asset-Id": "TS_ELEC_MOTOR_DC_A"
    }
  });
}
