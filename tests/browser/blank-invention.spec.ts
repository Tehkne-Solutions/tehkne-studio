import { test, expect } from "@playwright/test";

test("S2.10 creates a blank invention from canonical components, validates ports and restores without replay", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await page.evaluate(() => window.localStorage.removeItem("tehkne-studio:s2.2:project:invention"));
  await page.getByTestId("blank-invention-trigger").click();

  const workspace = page.getByRole("region", { name: "Blank Invention Workspace" });
  await expect(workspace).toBeVisible();
  await expect(page.getByTestId("invention-status")).toContainText("BLANK INVENTION · 0 COMPONENTES · 0 CONEXÕES");
  await expect(page.getByTestId("invention-status")).toContainText("PRESET false");
  await expect(workspace.getByText("ENGINEERING GRAPH VAZIO")).toBeVisible();

  const search = workspace.getByLabel("Buscar tecnologia");
  const addDefinition = async (query: string, expectedName: string) => {
    await search.fill(query);
    await expect(workspace.getByText(expectedName, { exact: true }).first()).toBeVisible();
    await workspace.getByRole("button", { name: "Adicionar ao projeto" }).click();
  };

  await addDefinition("energy.battery.lithium-ion-v1", "Lithium-Ion Battery Pack");
  await addDefinition("power.regulator.dc-v1", "DC Power Regulator");
  await addDefinition("compute.soc.mobile-v1", "Mobile System-on-Chip");
  await addDefinition("display.oled.touch-v1", "OLED Touch Display");
  await expect(page.getByTestId("invention-status")).toContainText("BLANK INVENTION · 4 COMPONENTES · 0 CONEXÕES");

  const source = workspace.getByLabel("Porta de origem");
  const target = workspace.getByLabel("Porta compatível de destino");
  const connect = workspace.getByRole("button", { name: "Conectar interfaces" });

  await source.selectOption({ label: "Lithium-Ion Battery Pack · dc-output · electrical" });
  await target.selectOption({ label: "DC Power Regulator · dc-input · electrical" });
  await connect.click();
  await expect(page.getByTestId("invention-feedback")).toContainText("power.dc.source");

  await source.selectOption({ label: "DC Power Regulator · regulated-output · electrical" });
  await target.selectOption({ label: "Mobile System-on-Chip · power-in · electrical" });
  await connect.click();
  await expect(page.getByTestId("invention-feedback")).toContainText("power.dc.low-voltage");

  await source.selectOption({ label: "Mobile System-on-Chip · display-out · data" });
  await target.selectOption({ label: "OLED Touch Display · display-in · data" });
  await connect.click();
  await expect(page.getByTestId("invention-feedback")).toContainText("display.mipi-dsi");
  await expect(page.getByTestId("invention-status")).toContainText("BLANK INVENTION · 4 COMPONENTES · 3 CONEXÕES");

  await page.getByTestId("invention-component-invention.component.1").getByRole("button", { name: "Remover componente" }).click();
  await expect(page.getByTestId("invention-feedback")).toContainText("Disconnect 1 invention connection");
  await expect(page.getByTestId("invention-status")).toContainText("4 COMPONENTES · 3 CONEXÕES");

  await workspace.getByRole("button", { name: "Guardar invenção" }).click();
  await expect(page.getByTestId("invention-feedback")).toContainText("sem simulação implícita");
  await workspace.getByRole("button", { name: "Fechar Blank Invention" }).click();

  await page.reload();
  await page.getByTestId("blank-invention-trigger").click();
  await page.getByRole("button", { name: "Restaurar invenção" }).click();
  await expect(page.getByTestId("invention-status")).toContainText("BLANK INVENTION · 4 COMPONENTES · 3 CONEXÕES");
  await expect(page.getByTestId("invention-feedback")).toContainText("sem replay");
  await expect(page.getByText("power.dc.source", { exact: true })).toBeVisible();
  await expect(page.getByText("power.dc.low-voltage", { exact: true })).toBeVisible();
  await expect(page.getByText("display.mipi-dsi", { exact: true })).toBeVisible();

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
