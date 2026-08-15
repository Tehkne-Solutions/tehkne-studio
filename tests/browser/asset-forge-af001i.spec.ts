import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const EXPECTED_BYTES = 243_672;
const EXPECTED_SHA256 = "ad73d83d0dcd8485a8c2a7a680f83090a98d637cea455dde4915f0d771cd6552";
const EXPECTED_TRANSPORT_SHA256 = "f6b1062238c941f81bbd5c38e154add9bb4ab56b81c06f9c45989c9604dd90c8";
const EXPECTED_TRIANGLES = "3292";
const EXPECTED_VERSION = "0.6.5-hero-candidate";
const MIN_BENCHMARK_SAMPLES = 30;
const EVIDENCE_DIR = resolve("test-results", "af001i-evidence");

test("AF-001I v0.6.5 HERO runs LOD0 PBR review and preserves visual evidence", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  await mkdir(EVIDENCE_DIR, { recursive: true });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

  const assetResponse = await page.request.get("/api/asset-forge/af001/motor/lod0");
  expect(assetResponse.status()).toBe(200);
  expect(assetResponse.headers()["content-type"]).toContain("model/gltf-binary");
  expect(assetResponse.headers()["x-tehkne-asset-id"]).toBe("TS_ELEC_MOTOR_DC_A");
  expect(assetResponse.headers()["x-tehkne-asset-version"]).toBe(EXPECTED_VERSION);
  expect(assetResponse.headers()["x-tehkne-asset-lod"]).toBe("LOD0");
  expect(assetResponse.headers()["x-tehkne-asset-triangles"]).toBe(EXPECTED_TRIANGLES);
  expect(assetResponse.headers()["x-tehkne-asset-sha256"]).toBe(EXPECTED_SHA256);
  expect(assetResponse.headers()["x-tehkne-asset-transport-sha256"]).toBe(EXPECTED_TRANSPORT_SHA256);
  expect((await assetResponse.body()).byteLength).toBe(EXPECTED_BYTES);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/asset-forge/af001/pbr", { waitUntil: "networkidle" });

  const review = page.getByLabel("AF-001I Golden Motor LOD0 PBR Runtime Review");
  await expect(review).toBeVisible();
  await expect(review).toHaveAttribute("data-runtime-ready", "true", { timeout: 20_000 });
  await expect(review).toHaveAttribute("data-node-gate", "pass", { timeout: 20_000 });
  await expect(review).toHaveAttribute("data-benchmark-ready", "true", { timeout: 20_000 });
  await expect(page.getByTestId("node-gate-verdict")).toHaveText("PASS");

  const canvasShell = page.getByTestId("pbr-canvas-shell");
  const cameraViews = ["three-quarter", "front", "side", "rear", "bearing", "terminals"] as const;
  for (const cameraView of cameraViews) {
    await page.getByTestId(`camera-view-${cameraView}`).click();
    await expect(canvasShell).toHaveAttribute("data-camera-view", cameraView);
    await page.waitForTimeout(180);
    const screenshotPath = resolve(EVIDENCE_DIR, `af001i-v065-${cameraView}.png`);
    await canvasShell.screenshot({ path: screenshotPath });
    await testInfo.attach(`AF001I v0.6.5 ${cameraView}`, { path: screenshotPath, contentType: "image/png" });
  }

  const samples = Number.parseInt(await page.getByTestId("benchmark-samples-i").innerText(), 10);
  const averageFrameMs = Number.parseFloat(await page.getByTestId("average-frame-ms-i").innerText());
  const p95FrameMs = Number.parseFloat(await page.getByTestId("p95-frame-ms-i").innerText());
  const runtimeContext = await page.evaluate(() => ({ userAgent: navigator.userAgent, platform: navigator.platform, viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio } }));

  const runtimeEvidence = { gate: "AF001I-V065", asset: "TS_ELEC_MOTOR_DC_A", version: EXPECTED_VERSION, lod: "LOD0", triangles: Number(EXPECTED_TRIANGLES), bytes: EXPECTED_BYTES, sha256: EXPECTED_SHA256, transportSha256: EXPECTED_TRANSPORT_SHA256, samples, averageFrameMs, p95FrameMs, ...runtimeContext };
  const runtimeEvidencePath = resolve(EVIDENCE_DIR, "af001i-v065-runtime-context.json");
  await writeFile(runtimeEvidencePath, JSON.stringify(runtimeEvidence, null, 2), "utf8");
  await testInfo.attach("AF001I v0.6.5 runtime context", { path: runtimeEvidencePath, contentType: "application/json" });

  console.log(`AF001I_V065_METRICS average_frame_ms=${averageFrameMs} p95_frame_ms=${p95FrameMs} samples=${samples} triangles=${EXPECTED_TRIANGLES} bytes=${EXPECTED_BYTES} sha256=${EXPECTED_SHA256}`);

  expect(Number.isFinite(samples)).toBe(true);
  expect(samples).toBeGreaterThanOrEqual(MIN_BENCHMARK_SAMPLES);
  expect(Number.isFinite(averageFrameMs)).toBe(true);
  expect(Number.isFinite(p95FrameMs)).toBe(true);
  expect(averageFrameMs).toBeLessThan(100);
  expect(p95FrameMs).toBeLessThan(150);
  await expect(page.getByTestId("lod0-pbr-verdict")).toHaveText("LOD0 PBR RUNTIME PASS");
  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
