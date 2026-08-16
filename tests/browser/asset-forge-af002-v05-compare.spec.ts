import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const BASELINE_URL = "/api/asset-forge/af002/coupler-v04";
const CANDIDATE_URL = "/api/asset-forge/af002/coupler-v05-review";
const BASELINE_BYTES = 59_436;
const BASELINE_SHA256 = "451d97b50ed9321c45b8dfb7e679cf6f273ec335da837d2c49d377426b98f122";
const CANDIDATE_BYTES = 138_120;
const CANDIDATE_SHA256 = "2eda04ec02fb31c65c2d1ecb342c18bc4d7eaedd02af9a93b676b8a66d1fc6e6";
const CANDIDATE_PATH = resolve(process.cwd(), "tools/asset_forge/af002_v05/generated/AF-002_TS_MECH_SHAFT_COUPLER_A_v0.5.0-hero-quality.glb");

function sha256(body: Buffer) {
  return createHash("sha256").update(body).digest("hex");
}

test("AF-002 v0.4 and v0.5 render side by side without runtime or HERO promotion", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

  const baselineResponse = await page.request.get(BASELINE_URL);
  expect(baselineResponse.status()).toBe(200);
  const baseline = await baselineResponse.body();
  expect(baseline.byteLength).toBe(BASELINE_BYTES);
  expect(sha256(baseline)).toBe(BASELINE_SHA256);

  const candidate = readFileSync(CANDIDATE_PATH);
  expect(candidate.byteLength).toBe(CANDIDATE_BYTES);
  expect(sha256(candidate)).toBe(CANDIDATE_SHA256);

  await page.route(`**${CANDIDATE_URL}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "model/gltf-binary",
      body: candidate,
      headers: {
        "X-Tehkne-Asset-Id": "AF-002",
        "X-Tehkne-Asset-Version": "0.5.0-hero-quality",
        "X-Tehkne-Asset-Stage": "HERO_QUALITY_CANDIDATE",
        "X-Tehkne-Runtime-Promoted": "false",
        "X-Tehkne-Hero-Promoted": "false",
        "X-Tehkne-Signature": "Tehkné Solutions"
      }
    });
  });

  await page.goto("/asset-forge/af002/compare-v05", { waitUntil: "networkidle" });
  const state = page.getByTestId("af002-hero-compare-state");
  await expect(state).toHaveAttribute("data-baseline-ready", "true", { timeout: 20_000 });
  await expect(state).toHaveAttribute("data-candidate-ready", "true", { timeout: 20_000 });
  await expect(state).toHaveAttribute("data-baseline-url", BASELINE_URL);
  await expect(state).toHaveAttribute("data-candidate-url", CANDIDATE_URL);
  await expect(state).toHaveAttribute("data-runtime-promoted", "false");
  await expect(state).toHaveAttribute("data-hero-promoted", "false");
  await expect(page.locator("canvas")).toHaveCount(2);

  await page.screenshot({ path: "test-results/af002-v04-v05-hero-compare.png", fullPage: true });
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);

  console.log(`AF002_V05_COMPARE baseline=${BASELINE_SHA256} candidate=${CANDIDATE_SHA256} candidate_bytes=${CANDIDATE_BYTES} runtime_promoted=false hero_promoted=false signature=Tehkné Solutions`);
});
