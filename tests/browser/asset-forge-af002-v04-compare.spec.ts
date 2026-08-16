import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";

const BASELINE_URL = "/api/asset-forge/af002/coupler";
const CANDIDATE_URL = "/api/asset-forge/af002/coupler-v04";
const BASELINE_BYTES = 22_600;
const BASELINE_SHA256 = "48e8363cdc38b5ae93ace0b975c42498663e03c922970fb2b60e80c65d26b50e";
const CANDIDATE_BYTES = 59_436;
const CANDIDATE_SHA256 = "451d97b50ed9321c45b8dfb7e679cf6f273ec335da837d2c49d377426b98f122";

function sha256(body: Buffer) {
  return createHash("sha256").update(body).digest("hex");
}

test("AF-002 v0.3 baseline and v0.4 candidate render side by side in Chromium", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

  const [baselineResponse, candidateResponse] = await Promise.all([
    page.request.get(BASELINE_URL),
    page.request.get(CANDIDATE_URL)
  ]);

  expect(baselineResponse.status()).toBe(200);
  expect(candidateResponse.status()).toBe(200);
  expect(candidateResponse.headers()["x-tehkne-asset-stage"]).toBe("VISUAL_QUALITY_CANDIDATE");
  expect(candidateResponse.headers()["x-tehkne-runtime-promoted"]).toBe("false");

  const baseline = await baselineResponse.body();
  const candidate = await candidateResponse.body();
  expect(baseline.byteLength).toBe(BASELINE_BYTES);
  expect(sha256(baseline)).toBe(BASELINE_SHA256);
  expect(candidate.byteLength).toBe(CANDIDATE_BYTES);
  expect(sha256(candidate)).toBe(CANDIDATE_SHA256);

  await page.goto("/asset-forge/af002/compare", { waitUntil: "networkidle" });
  const state = page.getByTestId("af002-visual-compare-state");
  await expect(state).toHaveAttribute("data-baseline-ready", "true", { timeout: 20_000 });
  await expect(state).toHaveAttribute("data-candidate-ready", "true", { timeout: 20_000 });
  await expect(state).toHaveAttribute("data-baseline-url", BASELINE_URL);
  await expect(state).toHaveAttribute("data-candidate-url", CANDIDATE_URL);
  await expect(state).toHaveAttribute("data-runtime-promoted", "false");
  await expect(page.locator("canvas")).toHaveCount(2);

  await page.screenshot({ path: "test-results/af002-v03-v04-visual-compare.png", fullPage: true });
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);

  console.log(`AF002_V04_COMPARE baseline=${BASELINE_SHA256} candidate=${CANDIDATE_SHA256} candidate_bytes=${CANDIDATE_BYTES} runtime_promoted=false signature=Tehkné Solutions`);
});
