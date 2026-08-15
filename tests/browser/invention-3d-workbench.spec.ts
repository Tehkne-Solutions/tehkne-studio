import { test, expect } from "@playwright/test";

test("S2.12 materializes the same invention graph in 3D, moves depth, keeps wiring attached and restores without replay", async ({ page }) => {
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
  await expect(workspace).toBeVisible();
  await expect(page.getByTestId("invention-3d-workbench")).toBeVisible();
  await expect(page.getByTestId("invention-3d-status")).toContainText("SIMULAÇÃO NOT-REQUESTED");

  const definition = workspace.getByLabel("Definição 3D");
  const add = workspace.getByRole("button", { name: "Adicionar ao 3D" });

  await definition.selectOption("energy.battery.lithium-ion-v1");
  await add.click();
  await definition.selectOption("power.regulator.dc-v1");
  await add.click();

  await expect(page.getByTestId("invention-3d-status")).toContainText("2 COMPONENTES");
  await workspace.getByRole("button", { name: /Lithium-Ion Battery Pack/ }).click();
  const selected = page.getByTestId("invention-3d-selected");
  await expect(selected).toContainText("Lithium-Ion Battery Pack");
  const initialZ = await selected.getAttribute("data-z");

  const source = workspace.getByLabel("Origem 3D");
  const target = workspace.getByLabel("Destino 3D");
  await source.selectOption({ label: "Lithium-Ion Battery Pack · dc-output" });
  await target.selectOption({ label: "DC Power Regulator · dc-input" });
  await workspace.getByRole("button", { name: "Conectar / Montar" }).click();

  const wire = page.getByTestId("invention-3d-wire-invention-connection-1");
  await expect(wire).toContainText("power.dc.source");
  const initialWireZ = await wire.getAttribute("data-source-z");
  expect(initialWireZ).toBe(initialZ);

  await workspace.getByRole("button", { name: "Z +" }).click();
  await expect(selected).not.toHaveAttribute("data-z", initialZ ?? "");
  const movedZ = await selected.getAttribute("data-z");
  await expect(wire).toHaveAttribute("data-source-z", movedZ ?? "");
  await expect(page.getByTestId("invention-3d-feedback")).toContainText("Transform 3D");

  await workspace.getByRole("button", { name: "Superior" }).click();
  await workspace.getByRole("button", { name: "Guardar 3D" }).click();
  await expect(page.getByTestId("invention-3d-feedback")).toContainText("sem simulação implícita");
  await workspace.getByRole("button", { name: "Fechar 3D Invention Workbench" }).click();

  await page.reload();
  await page.getByTestId("invention-3d-trigger").click();
  await expect(page.getByTestId("invention-3d-selected")).toHaveCount(0);
  await workspace.getByRole("button", { name: /Lithium-Ion Battery Pack/ }).click();
  await expect(page.getByTestId("invention-3d-selected")).toHaveAttribute("data-z", movedZ ?? "");
  await expect(page.getByTestId("invention-3d-wire-invention-connection-1")).toHaveAttribute("data-source-z", movedZ ?? "");
  await expect(page.getByTestId("invention-3d-feedback")).toContainText("Projeto salvo carregado no 3D");

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
