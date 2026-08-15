import { expect, test } from "@playwright/test";

test("S2.17 rotates a snapped motor-wheel assembly rigidly around the selected pivot and persists orientation", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();

  const workspace = page.getByRole("region", { name: "3D Invention Workbench" });
  const definition = workspace.getByLabel("Definição 3D");
  const add = workspace.getByRole("button", { name: "Adicionar ao 3D" });
  const selected = page.getByTestId("invention-3d-selected");

  const motorResponse = page.waitForResponse((response) => response.url().includes("/api/asset-forge/af001/motor/lod0") && response.status() === 200);
  await definition.selectOption("actuation.motor.dc-brushed-v1");
  await add.click();
  await motorResponse;
  await definition.selectOption("mechanical.wheel.drive-v1");
  await add.click();

  await workspace.getByLabel("Origem 3D").selectOption({ label: "Brushed DC Motor · shaft-out" });
  await workspace.getByLabel("Destino 3D").selectOption({ label: "Drive Wheel · hub-in" });
  await workspace.getByRole("button", { name: "Conectar no 3D" }).click();

  const constraint = page.getByTestId("mechanical-constraint-invention-connection-1");
  await expect(constraint).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });

  await workspace.getByRole("button", { name: /Brushed DC Motor/ }).click();
  const motorBefore = {
    x: Number(await selected.getAttribute("data-x")),
    y: Number(await selected.getAttribute("data-y")),
    z: Number(await selected.getAttribute("data-z")),
    ry: Number(await selected.getAttribute("data-ry"))
  };

  await workspace.getByRole("button", { name: /Drive Wheel/ }).click();
  const wheelBefore = {
    x: Number(await selected.getAttribute("data-x")),
    y: Number(await selected.getAttribute("data-y")),
    z: Number(await selected.getAttribute("data-z"))
  };

  await workspace.getByRole("button", { name: /Brushed DC Motor/ }).click();
  await workspace.getByRole("button", { name: "RY +" }).click();
  await expect(page.getByTestId("invention-3d-feedback")).toContainText("Rotate 3D");
  await expect(selected).toHaveAttribute("data-x", motorBefore.x.toFixed(3));
  await expect(selected).toHaveAttribute("data-y", motorBefore.y.toFixed(3));
  await expect(selected).toHaveAttribute("data-z", motorBefore.z.toFixed(3));
  await expect.poll(async () => Number(await selected.getAttribute("data-ry"))).toBeCloseTo(motorBefore.ry + Math.PI / 12, 2);

  await workspace.getByRole("button", { name: /Drive Wheel/ }).click();
  const wheelAfter = {
    x: Number(await selected.getAttribute("data-x")),
    y: Number(await selected.getAttribute("data-y")),
    z: Number(await selected.getAttribute("data-z")),
    ry: Number(await selected.getAttribute("data-ry"))
  };
  expect(Math.abs(wheelAfter.x - wheelBefore.x) + Math.abs(wheelAfter.z - wheelBefore.z)).toBeGreaterThan(0.001);
  expect(wheelAfter.y).toBeCloseTo(wheelBefore.y, 3);
  expect(wheelAfter.ry).toBeCloseTo(Math.PI / 12, 2);

  await expect(constraint).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });
  await expect.poll(async () => {
    const driver = [
      Number(await constraint.getAttribute("data-driver-x")),
      Number(await constraint.getAttribute("data-driver-y")),
      Number(await constraint.getAttribute("data-driver-z"))
    ];
    const follower = [
      Number(await constraint.getAttribute("data-follower-x")),
      Number(await constraint.getAttribute("data-follower-y")),
      Number(await constraint.getAttribute("data-follower-z"))
    ];
    return Math.max(...driver.map((value, index) => Math.abs(value - follower[index]!)));
  }).toBeLessThanOrEqual(0.001);

  await workspace.getByRole("button", { name: "Guardar 3D" }).click();
  await workspace.getByRole("button", { name: "Fechar 3D Invention Workbench" }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();
  await workspace.getByRole("button", { name: /Brushed DC Motor/ }).click();
  await expect.poll(async () => Number(await selected.getAttribute("data-ry"))).toBeCloseTo(motorBefore.ry + Math.PI / 12, 2);
  await expect(page.getByTestId("invention-3d-feedback")).toContainText("Projeto salvo carregado no 3D");

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
