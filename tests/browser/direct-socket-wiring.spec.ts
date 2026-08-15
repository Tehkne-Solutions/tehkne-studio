import { expect, test } from "@playwright/test";

test("S2.15 authors a connectedTo wire directly from two real Asset Forge sockets", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();

  const workspace = page.getByRole("region", { name: "3D Invention Workbench" });
  const definition = workspace.getByLabel("Definição 3D");
  const add = workspace.getByRole("button", { name: "Adicionar ao 3D" });
  const status = page.getByTestId("invention-3d-status");
  const feedback = page.getByTestId("invention-3d-feedback");

  const motorResponse = page.waitForResponse((response) =>
    response.url().includes("/api/asset-forge/af001/motor/lod0") && response.status() === 200
  );
  await definition.selectOption("actuation.motor.dc-brushed-v1");
  await add.click();
  await motorResponse;
  await add.click();

  await expect(status).toHaveAttribute("data-real-assets", "2");
  await expect(status).toHaveAttribute("data-direct-socket-mode", "idle");

  await workspace.getByRole("button", { name: /invention\.component\.1 · REAL ASSET/ }).click();
  const sourceRail = page.getByTestId("invention-3d-socket-authoring");
  const sourceSocket = page.getByTestId("invention-3d-socket-invention.component.1-power-pos");
  await expect(sourceSocket).toHaveAttribute("data-socket-name", "SOCKET_ELEC_POWER_POS");
  await expect(sourceSocket).toHaveAttribute("data-socket-state", "ready");
  await sourceSocket.click();

  await expect(status).toHaveAttribute("data-direct-socket-mode", "armed");
  await expect(status).toHaveAttribute("data-direct-socket-source", "invention.component.1::power-pos");
  await expect(sourceRail).toHaveAttribute("data-source-key", "invention.component.1::power-pos");
  await expect(feedback).toContainText("Socket origem armado");

  await workspace.getByRole("button", { name: /invention\.component\.2 · REAL ASSET/ }).click();
  const targetSocket = page.getByTestId("invention-3d-socket-invention.component.2-power-pos");
  await expect(targetSocket).toHaveAttribute("data-socket-name", "SOCKET_ELEC_POWER_POS");
  await expect(targetSocket).toHaveAttribute("data-socket-state", "compatible");
  await targetSocket.click();

  await expect(status).toHaveAttribute("data-direct-socket-mode", "idle");
  await expect(status).toHaveAttribute("data-direct-socket-source", "");
  await expect(feedback).toContainText("Wire criado diretamente por sockets");
  await expect(feedback).toContainText("Engineering Graph permanece autoritativo");

  const wire = page.getByTestId("invention-3d-wire-invention-connection-1");
  await expect(wire).toHaveAttribute("data-source-port", "power-pos");
  await expect(wire).toHaveAttribute("data-target-port", "power-pos");
  await expect(wire).toHaveAttribute("data-source-socket", "SOCKET_ELEC_POWER_POS", { timeout: 20_000 });
  await expect(wire).toHaveAttribute("data-target-socket", "SOCKET_ELEC_POWER_POS", { timeout: 20_000 });
  await expect(wire).toHaveAttribute("data-socket-aware", "true");
  await expect(status).toHaveAttribute("data-socket-aware-wires", "1");

  await workspace.getByRole("button", { name: /invention\.component\.1 · REAL ASSET/ }).click();
  await expect(page.getByTestId("invention-3d-socket-invention.component.1-power-pos")).toBeDisabled();

  await workspace.getByRole("button", { name: "Guardar 3D" }).click();
  await expect(feedback).toContainText("1 conexões");
  await workspace.getByRole("button", { name: "Restaurar 3D" }).click();
  await expect(page.getByTestId("invention-3d-wire-invention-connection-1")).toHaveAttribute("data-source-socket", "SOCKET_ELEC_POWER_POS", { timeout: 20_000 });
  await expect(page.getByTestId("invention-3d-wire-invention-connection-1")).toHaveAttribute("data-target-socket", "SOCKET_ELEC_POWER_POS", { timeout: 20_000 });

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
