import { test, expect } from "@playwright/test";

test("S2.11 moves the authored invention spatially, keeps wiring attached and restores layout without replay", async ({ page }) => {
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
  const search = workspace.getByLabel("Buscar tecnologia");
  const addDefinition = async (query: string, expectedName: string) => {
    await search.fill(query);
    await expect(workspace.getByText(expectedName, { exact: true }).first()).toBeVisible();
    await workspace.getByRole("button", { name: "Adicionar ao projeto" }).click();
  };

  await addDefinition("energy.battery.lithium-ion-v1", "Lithium-Ion Battery Pack");
  await addDefinition("power.regulator.dc-v1", "DC Power Regulator");

  const battery = page.getByTestId("invention-spatial-node-invention.component.1");
  const regulator = page.getByTestId("invention-spatial-node-invention.component.2");
  await expect(battery).toBeVisible();
  await expect(regulator).toBeVisible();
  await expect(page.getByTestId("invention-status")).toContainText("2 SPATIAL BINDINGS");

  const source = workspace.getByLabel("Porta de origem");
  const target = workspace.getByLabel("Porta compatível de destino");
  await source.selectOption({ label: "Lithium-Ion Battery Pack · dc-output · electrical" });
  await target.selectOption({ label: "DC Power Regulator · dc-input · electrical" });
  await workspace.getByRole("button", { name: "Conectar interfaces" }).click();

  const wire = page.getByTestId("invention-spatial-wire-invention-connection-1");
  await expect(wire).toHaveAttribute("data-interfaces", "power.dc.source");
  const initialX = await battery.getAttribute("data-x");
  const initialWireX = await wire.getAttribute("x1");
  expect(initialX).not.toBeNull();
  expect(initialWireX).not.toBeNull();

  const box = await battery.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error("Battery spatial handle has no browser bounds");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 55, { steps: 6 });
  await page.mouse.up();

  await expect(battery).not.toHaveAttribute("data-x", initialX ?? "");
  const movedX = await battery.getAttribute("data-x");
  const movedY = await battery.getAttribute("data-y");
  const movedWireX = await wire.getAttribute("x1");
  expect(movedX).not.toBe(initialX);
  expect(movedWireX).not.toBe(initialWireX);
  await expect(page.getByTestId("invention-spatial-selection")).toContainText("Lithium-Ion Battery Pack");

  await workspace.getByRole("button", { name: "Guardar invenção" }).click();
  await expect(page.getByTestId("invention-feedback")).toContainText("2 bindings");
  await workspace.getByRole("button", { name: "Fechar Blank Invention" }).click();

  await page.reload();
  await page.getByTestId("blank-invention-trigger").click();
  await page.getByRole("button", { name: "Restaurar invenção" }).click();

  const restoredBattery = page.getByTestId("invention-spatial-node-invention.component.1");
  const restoredWire = page.getByTestId("invention-spatial-wire-invention-connection-1");
  await expect(restoredBattery).toHaveAttribute("data-x", movedX ?? "");
  await expect(restoredBattery).toHaveAttribute("data-y", movedY ?? "");
  await expect(restoredWire).toHaveAttribute("x1", movedWireX ?? "");
  await expect(restoredWire).toHaveAttribute("data-interfaces", "power.dc.source");
  await expect(page.getByTestId("invention-feedback")).toContainText("2 bindings · sem replay");

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
