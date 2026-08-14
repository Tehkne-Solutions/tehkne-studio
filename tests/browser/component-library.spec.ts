import { expect, test } from "@playwright/test";

test("S2.3 Universal Component Library is searchable and exposes engineering interfaces", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /COMPONENT LIBRARY · \d+/ }).click();

  const library = page.getByLabel("Universal Component Library");
  await expect(library).toBeVisible();
  await expect(library.getByText("Biblioteca tecnológica v1", { exact: true })).toBeVisible();

  const search = library.getByLabel("Buscar componentes");
  await search.fill("battery");
  await expect(library.getByRole("button", { name: /Lithium-Ion Battery Pack/ })).toBeVisible();
  await library.getByRole("button", { name: /Lithium-Ion Battery Pack/ }).click();
  await expect(library.getByRole("heading", { name: "Lithium-Ion Battery Pack" })).toBeVisible();
  await expect(library.getByText("power.dc.source", { exact: true })).toBeVisible();

  await search.fill("");
  await library.getByLabel("Filtrar família de produto").selectOption("smartphone");
  await expect(library.getByRole("button", { name: /Mobile System-on-Chip/ })).toBeVisible();
  await expect(library.getByRole("button", { name: /OLED Touch Display/ })).toBeVisible();
  await expect(library.getByRole("button", { name: /Rotary Servo Actuator/ })).toHaveCount(0);

  await search.fill("bluetooth");
  await library.getByRole("button", { name: /Wireless Connectivity Module/ }).click();
  await expect(library.getByRole("heading", { name: "Wireless Connectivity Module" })).toBeVisible();
  await expect(library.getByText("bus.sdio-pcie", { exact: true })).toBeVisible();
  await expect(library.getByText("Tehkné Solutions", { exact: true })).toBeVisible();

  await library.getByRole("button", { name: "Fechar biblioteca" }).click();
  await expect(library).toHaveCount(0);
  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
