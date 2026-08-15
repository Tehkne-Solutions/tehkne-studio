import { expect, test } from "@playwright/test";

test("S2.17 aligns the follower axis after driver rotation and preserves the same mechanical connectedTo relationship", async ({ page }) => {
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
  const status = page.getByTestId("invention-3d-status");
  const selected = page.getByTestId("invention-3d-selected");

  const motorResponse = page.waitForResponse((response) => response.url().includes("/api/asset-forge/af001/motor/lod0") && response.status() === 200);
  await definition.selectOption("actuation.motor.dc-brushed-v1");
  await add.click();
  const response = await motorResponse;
  expect(response.headers()["x-tehkne-asset-version"]).toBe("0.6.6-hero-candidate");

  await definition.selectOption("mechanical.wheel.drive-v1");
  await add.click();
  await workspace.getByLabel("Origem 3D").selectOption({ label: "Brushed DC Motor · shaft-out" });
  await workspace.getByLabel("Destino 3D").selectOption({ label: "Drive Wheel · hub-in" });
  await workspace.getByRole("button", { name: "Conectar no 3D" }).click();

  const positional = page.getByTestId("mechanical-constraint-invention-connection-1");
  const orientation = page.getByTestId("mechanical-orientation-invention-connection-1");
  const wire = page.getByTestId("invention-3d-wire-invention-connection-1");

  await expect(positional).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });
  await expect(orientation).toHaveAttribute("data-state", "aligned", { timeout: 20_000 });
  await expect(orientation).toHaveAttribute("data-derived-from", "engineering-graph");
  await expect(status).toHaveAttribute("data-mechanical-assemblies", "1");
  await expect(status).toHaveAttribute("data-mechanical-orientations", "1");
  await expect(wire).toHaveAttribute("data-mechanical", "true");
  await expect(wire).toHaveAttribute("data-source-port", "shaft-out");
  await expect(wire).toHaveAttribute("data-target-port", "hub-in");

  await workspace.getByRole("button", { name: /Brushed DC Motor/ }).click();
  await expect(selected).toHaveAttribute("data-ry", "0.000");
  await page.getByTestId("invention-3d-rotation-controls").getByRole("button", { name: "RY +" }).click();
  await expect(selected).toHaveAttribute("data-ry", "0.262");

  await expect(orientation).toHaveAttribute("data-state", "aligned", { timeout: 20_000 });
  await expect.poll(async () => await orientation.getAttribute("data-driver-axis")).toBe("0.2588,0.0000,0.9659");
  await expect.poll(async () => await orientation.getAttribute("data-follower-axis")).toBe("0.2588,0.0000,0.9659");
  await expect(positional).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });

  await workspace.getByRole("button", { name: /Drive Wheel/ }).click();
  await expect(selected).toHaveAttribute("data-ry", "0.262");
  await expect(status).toContainText("1 RELAÇÕES");
  await expect(wire).toHaveAttribute("data-source-socket", "SOCKET_MECH_AXIS_OUT");
  await expect(wire).toHaveAttribute("data-target-socket", "PROXY_HUB_CENTER");

  await workspace.getByRole("button", { name: /Brushed DC Motor/ }).click();
  await workspace.getByRole("button", { name: "Guardar 3D" }).click();
  await workspace.getByRole("button", { name: "Fechar 3D Invention Workbench", exact: true }).click();
  await page.getByTestId("invention-3d-trigger").click();
  await workspace.getByRole("button", { name: /Brushed DC Motor/ }).click();
  await expect(selected).toHaveAttribute("data-ry", "0.262");
  await expect(page.getByTestId("mechanical-orientation-invention-connection-1")).toHaveAttribute("data-state", "aligned", { timeout: 20_000 });
  await expect(page.getByTestId("mechanical-constraint-invention-connection-1")).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});