import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";

const V03_BYTES = 22_600;
const V03_SHA = "48e8363cdc38b5ae93ace0b975c42498663e03c922970fb2b60e80c65d26b50e";
const V04_BYTES = 59_436;
const V04_SHA = "451d97b50ed9321c45b8dfb7e679cf6f273ec335da837d2c49d377426b98f122";

function sha256(body: Buffer) { return createHash("sha256").update(body).digest("hex"); }

test("AF-002 v0.4 renders beside the unchanged v0.3 runtime without promotion", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

  const [runtimeResponse, candidateResponse] = await Promise.all([
    page.request.get("/api/asset-forge/af002/coupler"),
    page.request.get("/api/asset-forge/af002/coupler-v04")
  ]);
  expect(runtimeResponse.status()).toBe(200);
  expect(candidateResponse.status()).toBe(200);
  const runtimeBody = await runtimeResponse.body();
  const candidateBody = await candidateResponse.body();
  expect(runtimeBody.byteLength).toBe(V03_BYTES);
  expect(sha256(runtimeBody)).toBe(V03_SHA);
  expect(candidateBody.byteLength).toBe(V04_BYTES);
  expect(sha256(candidateBody)).toBe(V04_SHA);
  expect(candidateResponse.headers()["x-tehkne-asset-stage"]).toBe("VISUAL_QUALITY_CANDIDATE");
  expect(candidateResponse.headers()["x-tehkne-runtime-promoted"]).toBe("false");
  expect(candidateResponse.headers()["x-tehkne-asset-triangles"]).toBe("10816");

  await page.goto("/asset-forge/af002/visual-quality-v04", { waitUntil: "networkidle" });
  await expect(page.getByText("AF-002 · v0.3 Runtime vs v0.4 Visual Quality Candidate")).toBeVisible();
  const runtime = page.getByTestId("af002-runtime-v03");
  const candidate = page.getByTestId("af002-candidate-v04");
  const authority = page.getByTestId("af002-v04-review-authority");
  await expect(runtime).toHaveAttribute("data-stage", "RUNTIME_CANDIDATE");
  await expect(runtime).toHaveAttribute("data-sha256", V03_SHA);
  await expect(candidate).toHaveAttribute("data-stage", "VISUAL_QUALITY_CANDIDATE");
  await expect(candidate).toHaveAttribute("data-sha256", V04_SHA);
  await expect(candidate).toHaveAttribute("data-runtime-promoted", "false");
  await expect(authority).toHaveAttribute("data-axis-in", "-0.0175");
  await expect(authority).toHaveAttribute("data-axis-out", "0.0175");
  await expect(authority).toHaveAttribute("data-runtime-promoted", "false");
  await expect(page.locator("canvas")).toHaveCount(2);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: testInfo.outputPath("af002-v03-v04-comparison.png"), fullPage: true });
  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);

  console.log(`AF002_V04_BROWSER_REVIEW runtime=${V03_SHA} candidate=${V04_SHA} candidate_bytes=${V04_BYTES} candidate_triangles=10816 runtime_promoted=false signature=Tehkné Solutions`);
});
