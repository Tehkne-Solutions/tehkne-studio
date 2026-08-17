import { expect, test } from "@playwright/test";

const AF002_BYTES = 138_120;
const AF002_SHA256 = "2eda04ec02fb31c65c2d1ecb342c18bc4d7eaedd02af9a93b676b8a66d1fc6e6";

test("AF-002 v0.5 HERO_CANDIDATE runtime loads both real GLBs and proves zero-gap socket snap in Chromium", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const [motorResponse, couplerResponse] = await Promise.all([
    page.request.get("/api/asset-forge/af001/motor/lod0"),
    page.request.get("/api/asset-forge/af002/coupler")
  ]);

  expect(motorResponse.status()).toBe(200);
  expect(motorResponse.headers()["content-type"]).toContain("model/gltf-binary");
  expect((await motorResponse.body()).byteLength).toBeGreaterThan(0);

  expect(couplerResponse.status()).toBe(200);
  expect(couplerResponse.headers()["content-type"]).toContain("model/gltf-binary");
  expect(couplerResponse.headers()["x-tehkne-asset-version"]).toBe("0.5.0-hero-quality");
  expect(couplerResponse.headers()["x-tehkne-asset-stage"]).toBe("HERO_CANDIDATE");
  expect(couplerResponse.headers()["x-tehkne-asset-triangles"]).toBe("19520");
  expect(couplerResponse.headers()["x-tehkne-asset-sha256"]).toBe(AF002_SHA256);
  expect(couplerResponse.headers()["x-tehkne-runtime-promoted"]).toBe("true");
  expect(couplerResponse.headers()["x-tehkne-hero-promoted"]).toBe("true");
  expect(couplerResponse.headers()["x-tehkne-golden-asset"]).toBe("false");
  expect(couplerResponse.headers()["x-tehkne-signature"]).toBe("Tehkné Solutions");
  expect((await couplerResponse.body()).byteLength).toBe(AF002_BYTES);

  await page.goto("/asset-forge/af002", { waitUntil: "networkidle" });

  await expect(page.getByText("AF-002 · Runtime Visual & Physical Snap Review")).toBeVisible();
  const evidence = page.getByTestId("af002-runtime-snap-evidence");
  await expect(evidence).toBeVisible();
  await expect(evidence).toHaveAttribute("data-topology", "connectedTo");
  await expect(evidence).toHaveAttribute("data-motor-socket", "SOCKET_MECH_AXIS_OUT");
  await expect(evidence).toHaveAttribute("data-coupler-socket", "SOCKET_MECH_AXIS_IN");
  await expect(evidence).toHaveAttribute("data-motor-runtime-url", "/api/asset-forge/af001/motor/lod0");
  await expect(evidence).toHaveAttribute("data-coupler-runtime-url", "/api/asset-forge/af002/coupler");
  await expect(evidence).toHaveAttribute("data-endpoint-gap-m", "0.000000");

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: testInfo.outputPath("af002-v05-hero-candidate-runtime-snap.png"), fullPage: true });

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);

  console.log(`AF002_BROWSER_EVIDENCE stage=HERO_CANDIDATE version=0.5.0-hero-quality bytes=${AF002_BYTES} triangles=19520 sha256=${AF002_SHA256} runtime_promoted=true hero_promoted=true golden_asset=false topology=connectedTo motor_socket=SOCKET_MECH_AXIS_OUT coupler_socket=SOCKET_MECH_AXIS_IN endpoint_gap_m=0.000000 signature=Tehkné Solutions`);
});
