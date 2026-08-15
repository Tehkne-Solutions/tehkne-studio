import { expect, test } from "@playwright/test";

test("S2.13 materializes Asset Forge GLB when declared and keeps proxy explicit when art is absent", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await page.evaluate(() => window.localStorage.removeItem("tehkne-studio:s2.2:project:invention"));
  await page.getByTestId("invention-3d-trigger").click();

  const workspace = page.getByRole("region", { name: "3D Invention Workbench" });
  const definition = workspace.getByLabel("Definição 3D");
  const add = workspace.getByRole("button", { name: "Adicionar ao 3D" });
  const status = page.getByTestId("invention-3d-status");
  const visualSource = page.getByTestId("invention-3d-visual-source");

  const motorResponse = page.waitForResponse((response) =>
    response.url().includes("/api/asset-forge/af001/motor/lod0") && response.status() === 200
  );
  await definition.selectOption("actuation.motor.dc-brushed-v1");
  await add.click();
  const response = await motorResponse;

  expect(response.headers()["content-type"]).toContain("model/gltf-binary");
  expect(response.headers()["x-tehkne-asset-id"]).toBe("TS_ELEC_MOTOR_DC_A");
  expect(response.headers()["x-tehkne-asset-version"]).toBe("0.6.6-hero-candidate");
  expect(response.headers()["x-tehkne-asset-lod"]).toBe("LOD0");
  expect(response.headers()["x-tehkne-asset-triangles"]).toBe("3292");
  expect(response.headers()["x-tehkne-asset-socket-transform-patch"]).toBe("glb-json-v1");

  await expect(status).toHaveAttribute("data-real-assets", "1");
  await expect(status).toHaveAttribute("data-proxies", "0");
  await expect(visualSource).toHaveAttribute("data-source", "asset");
  await expect(visualSource).toHaveAttribute("data-asset-id", "TS_ELEC_MOTOR_DC_A");
  await expect(visualSource).toHaveAttribute("data-asset-version", "0.6.6-hero-candidate");
  await expect(visualSource).toHaveAttribute("data-asset-lod", "LOD0");
  await expect(page.getByTestId("invention-3d-feedback")).toContainText("ASSET TS_ELEC_MOTOR_DC_A");

  await definition.selectOption("energy.battery.lithium-ion-v1");
  await add.click();
  await expect(status).toHaveAttribute("data-real-assets", "1");
  await expect(status).toHaveAttribute("data-proxies", "1");
  await expect(visualSource).toHaveAttribute("data-source", "proxy");
  await expect(visualSource).toContainText("PROXY EXPLÍCITO");

  await workspace.getByRole("button", { name: /Brushed DC Motor/ }).click();
  await expect(visualSource).toHaveAttribute("data-source", "asset");
  await workspace.getByRole("button", { name: "Z +" }).click();
  await expect(page.getByTestId("invention-3d-feedback")).toContainText("Transform 3D");

  await workspace.getByRole("button", { name: "Guardar 3D" }).click();
  await workspace.getByRole("button", { name: "Fechar 3D Invention Workbench" }).click();
  await page.reload();
  await page.getByTestId("invention-3d-trigger").click();
  await workspace.getByRole("button", { name: /Brushed DC Motor/ }).click();
  await expect(page.getByTestId("invention-3d-visual-source")).toHaveAttribute("data-asset-id", "TS_ELEC_MOTOR_DC_A");
  await expect(page.getByTestId("invention-3d-visual-source")).toHaveAttribute("data-asset-version", "0.6.6-hero-candidate");
  await expect(page.getByTestId("invention-3d-feedback")).toContainText("Projeto salvo carregado no 3D");

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});