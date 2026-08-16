import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const CANDIDATE = path.resolve("tools/asset_forge/af002_v04/generated/AF-002_TS_MECH_SHAFT_COUPLER_A_v0.4.0-visual-quality.glb");

test("AF-002 v0.3 baseline and v0.4 candidate render side by side in Chromium", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

  expect(fs.existsSync(CANDIDATE)).toBe(true);
  const candidate = fs.readFileSync(CANDIDATE);
  expect(candidate.byteLength).toBe(59_436);

  await page.route("**/api/asset-forge/af002/coupler-v040-candidate", async (route) => {
    await route.fulfill({ status: 200, contentType: "model/gltf-binary", body: candidate });
  });

  await page.goto("/asset-forge/af002/compare", { waitUntil: "networkidle" });
  const state = page.getByTestId("af002-visual-compare-state");
  await expect(state).toHaveAttribute("data-baseline-ready", "true", { timeout: 20_000 });
  await expect(state).toHaveAttribute("data-candidate-ready", "true", { timeout: 20_000 });
  await expect(state).toHaveAttribute("data-runtime-promoted", "false");
  await expect(page.locator("canvas")).toHaveCount(2);

  await page.screenshot({ path: "test-results/af002-v03-v04-visual-compare.png", fullPage: true });
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
