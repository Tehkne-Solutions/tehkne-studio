import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const EXPECTED_BYTES = 243_812;
const EXPECTED_SHA256 = "d19e51fd33c461cf761b7c2c086c1284fc4ddfb38f3274acabd88e33fc5ce487";
const EXPECTED_TRANSPORT_SHA256 = "f6b1062238c941f81bbd5c38e154add9bb4ab56b81c06f9c45989c9604dd90c8";
const EXPECTED_SOURCE_SHA256 = "ad73d83d0dcd8485a8c2a7a680f83090a98d637cea455dde4915f0d771cd6552";
const EXPECTED_TRIANGLES = "3292";
const MIN_BENCHMARK_SAMPLES = 30;
const EVIDENCE_DIR = resolve("test-results", "af001i-evidence");
const SOCKET_TRANSLATIONS: Readonly<Record<string, readonly [number, number, number]>> = Object.freeze({
  SOCKET_MECH_AXIS_OUT: [0, 0, 0.03185],
  SOCKET_MECH_MOUNT_FRONT: [0, 0, 0.01655],
  SOCKET_ELEC_POWER_POS: [-0.0047, -0.00085, -0.01936],
  SOCKET_ELEC_POWER_NEG: [0.0047, -0.00085, -0.01936]
});

function parseGlbDocument(buffer: Buffer): { nodes?: Array<{ name?: string; translation?: number[] }> } {
  expect(buffer.readUInt32LE(0)).toBe(0x46546c67);
  expect(buffer.readUInt32LE(4)).toBe(2);
  expect(buffer.readUInt32LE(8)).toBe(buffer.byteLength);
  const jsonLength = buffer.readUInt32LE(12);
  expect(buffer.readUInt32LE(16)).toBe(0x4e4f534a);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8").trimEnd()) as {
    nodes?: Array<{ name?: string; translation?: number[] }>;
  };
}

function expectVector(actual: readonly number[] | undefined, expected: readonly number[]): void {
  expect(actual).toBeDefined();
  expect(actual).toHaveLength(3);
  expected.forEach((value, index) => expect(actual![index]).toBeCloseTo(value, 7));
}

test("AF-001I Golden Motor v0.6.6 runs LOD0 PBR review and preserves physical socket evidence", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  await mkdir(EVIDENCE_DIR, { recursive: true });

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const assetResponse = await page.request.get("/api/asset-forge/af001/motor/lod0");
  expect(assetResponse.status()).toBe(200);
  expect(assetResponse.headers()["content-type"]).toContain("model/gltf-binary");
  expect(assetResponse.headers()["x-tehkne-asset-id"]).toBe("TS_ELEC_MOTOR_DC_A");
  expect(assetResponse.headers()["x-tehkne-asset-version"]).toBe("0.6.6-hero-candidate");
  expect(assetResponse.headers()["x-tehkne-asset-lod"]).toBe("LOD0");
  expect(assetResponse.headers()["x-tehkne-asset-triangles"]).toBe(EXPECTED_TRIANGLES);
  expect(assetResponse.headers()["x-tehkne-asset-sha256"]).toBe(EXPECTED_SHA256);
  expect(assetResponse.headers()["x-tehkne-asset-transport-sha256"]).toBe(EXPECTED_TRANSPORT_SHA256);
  expect(assetResponse.headers()["x-tehkne-asset-source-version"]).toBe("0.6.5-hero-candidate");
  expect(assetResponse.headers()["x-tehkne-asset-source-sha256"]).toBe(EXPECTED_SOURCE_SHA256);
  expect(assetResponse.headers()["x-tehkne-asset-socket-transform-patch"]).toBe("glb-json-v1");
  const assetBody = await assetResponse.body();
  expect(assetBody.byteLength).toBe(EXPECTED_BYTES);

  const glb = parseGlbDocument(assetBody);
  expect(Array.isArray(glb.nodes)).toBe(true);
  for (const [socketName, translation] of Object.entries(SOCKET_TRANSLATIONS)) {
    const matches = glb.nodes!.filter((node) => node.name === socketName);
    expect(matches, `${socketName} must be unique`).toHaveLength(1);
    expectVector(matches[0]!.translation, translation);
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/asset-forge/af001/pbr", { waitUntil: "networkidle" });

  const review = page.getByLabel("AF-001I Golden Motor LOD0 PBR Runtime Review");
  await expect(review).toBeVisible();
  await expect(review).toHaveAttribute("data-runtime-ready", "true", { timeout: 20_000 });
  await expect(review).toHaveAttribute("data-node-gate", "pass", { timeout: 20_000 });
  await expect(review).toHaveAttribute("data-benchmark-ready", "true", { timeout: 20_000 });
  await expect(page.getByTestId("node-gate-verdict")).toHaveText("PASS");

  // Preserve all six visual views before enforcing the performance verdict.
  // A PERF FAIL is still useful evidence for AF-001K and must not erase art review.
  const canvasShell = page.getByTestId("pbr-canvas-shell");
  const cameraViews = [
    "three-quarter",
    "front",
    "side",
    "rear",
    "bearing",
    "terminals"
  ] as const;

  for (const cameraView of cameraViews) {
    await page.getByTestId(`camera-view-${cameraView}`).click();
    await expect(canvasShell).toHaveAttribute("data-camera-view", cameraView);
    await page.waitForTimeout(180);
    const screenshotPath = resolve(EVIDENCE_DIR, `af001i-${cameraView}.png`);
    await canvasShell.screenshot({ path: screenshotPath });
    await testInfo.attach(`AF001I ${cameraView}`, { path: screenshotPath, contentType: "image/png" });
  }

  const sampleText = await page.getByTestId("benchmark-samples-i").innerText();
  const averageText = await page.getByTestId("average-frame-ms-i").innerText();
  const p95Text = await page.getByTestId("p95-frame-ms-i").innerText();
  const samples = Number.parseInt(sampleText, 10);
  const averageFrameMs = Number.parseFloat(averageText);
  const p95FrameMs = Number.parseFloat(p95Text);

  const runtimeContext = await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio
    }
  }));

  const runtimeEvidence = {
    gate: "AF001I",
    asset: "TS_ELEC_MOTOR_DC_A",
    version: "0.6.6-hero-candidate",
    sourceVersion: "0.6.5-hero-candidate",
    lod: "LOD0",
    triangles: Number(EXPECTED_TRIANGLES),
    bytes: EXPECTED_BYTES,
    sha256: EXPECTED_SHA256,
    sourceSha256: EXPECTED_SOURCE_SHA256,
    transportSha256: EXPECTED_TRANSPORT_SHA256,
    socketTranslations: SOCKET_TRANSLATIONS,
    samples,
    averageFrameMs,
    p95FrameMs,
    ...runtimeContext
  };

  const runtimeEvidencePath = resolve(EVIDENCE_DIR, "af001i-runtime-context.json");
  await writeFile(runtimeEvidencePath, JSON.stringify(runtimeEvidence, null, 2), "utf8");
  await testInfo.attach("AF001I runtime context", { path: runtimeEvidencePath, contentType: "application/json" });

  console.log(
    `AF001I_METRICS average_frame_ms=${averageFrameMs} p95_frame_ms=${p95FrameMs} samples=${samples} ` +
    `triangles=${EXPECTED_TRIANGLES} bytes=${EXPECTED_BYTES} sha256=${EXPECTED_SHA256}`
  );

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