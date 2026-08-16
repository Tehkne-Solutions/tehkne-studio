import { expect, test } from "@playwright/test";

const AF002_BYTES = 22_600;
const AF002_SHA256 = "48e8363cdc38b5ae93ace0b975c42498663e03c922970fb2b60e80c65d26b50e";

test("AF-002 runtime review loads both real GLBs and proves zero-gap socket snap in Chromium", async ({ page }, testInfo) => {
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
  expect(couplerResponse.headers()["x-tehkne-asset-sha256"]).toBe(AF002_SHA256);
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
  await page.screenshot({ path: testInfo.outputPath("af002-runtime-snap.png"), fullPage: true });

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);

  console.log(`AF002_BROWSER_EVIDENCE bytes=${AF002_BYTES} sha256=${AF002_SHA256} topology=connectedTo motor_socket=SOCKET_MECH_AXIS_OUT coupler_socket=SOCKET_MECH_AXIS_IN endpoint_gap_m=0.000000`);
});
