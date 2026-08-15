import { expect, test } from "@playwright/test";

test("AF-001H Golden Motor loads the real GLB and completes the browser smoke gate", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/asset-forge/af001", { waitUntil: "networkidle" });

  const preview = page.getByLabel("AF-001H Golden Motor Runtime Preview");
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("data-runtime-ready", "true", { timeout: 20_000 });
  await expect(preview).toHaveAttribute("data-benchmark-ready", "true", { timeout: 20_000 });

  const verdict = page.getByTestId("runtime-smoke-verdict");
  await expect(verdict).toHaveText("SMOKE PASS", { timeout: 20_000 });

  const averageText = await page.getByTestId("average-frame-ms").innerText();
  const p95Text = await page.getByTestId("p95-frame-ms").innerText();
  const averageFrameMs = Number.parseFloat(averageText);
  const p95FrameMs = Number.parseFloat(p95Text);

  expect(Number.isFinite(averageFrameMs)).toBe(true);
  expect(Number.isFinite(p95FrameMs)).toBe(true);
  expect(averageFrameMs).toBeLessThan(100);
  expect(p95FrameMs).toBeLessThan(150);

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
