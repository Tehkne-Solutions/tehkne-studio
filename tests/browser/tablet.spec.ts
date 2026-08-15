import { expect, test } from "@playwright/test";

async function command(page: import("@playwright/test").Page, text: string) {
  const input = page.getByLabel("Comando para o Tehkné Studio");
  await input.fill(text);
  await page.getByRole("button", { name: "Executar", exact: true }).click();
}

test("S2.6 Tablet 01 runs battery causal teardown, touch-controller inspection and persistence", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Chamar Tablet 01" }).click();
  await expect(page.getByText(/TABLET-01 · 12 COMPONENTES · CLOSED/)).toBeVisible();
  await expect(page.getByText(/POWER OFF · BOOT IDLE/)).toBeVisible();

  await command(page, "Abra o tablet");
  await expect(page.getByText(/TABLET-01 · 12 COMPONENTES · OPEN/)).toBeVisible();

  await command(page, "Inspecione a caneta");
  await expect(page.getByText("Touch & Pen Controller", { exact: true })).toBeVisible();
  await expect(page.getByText(/tablet.input · ready/)).toBeVisible();
  await expect(page.getByText(/clockMHz/)).toBeVisible();

  await command(page, "Tire a bateria");
  await expect(page.getByText("Tablet Battery", { exact: true })).toBeVisible();
  await expect(page.getByText(/tablet.battery · removed/)).toBeVisible();

  await command(page, "Ligue o tablet");
  await expect(page.getByText(/POWER FAULT · BOOT POST/)).toBeVisible();
  await expect(page.getByLabel("Timeline do boot")).toBeVisible();

  await command(page, "Por que não iniciou?");
  await expect(page.getByLabel("Rastreamento causal")).toContainText("Tablet Battery");

  await command(page, "Reinstale a bateria");
  await expect(page.getByText(/tablet.battery · connected/)).toBeVisible();

  await command(page, "Ligue o tablete");
  await expect(page.getByText(/POWER ON · BOOT RUNNING/)).toBeVisible();
  await expect(page.getByLabel("Timeline do boot")).toContainText("RUNNING");

  await page.getByRole("button", { name: "Guardar projeto" }).click();
  await expect(page.getByRole("button", { name: "Restaurar Tablet salvo" })).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Restaurar Tablet salvo" }).click();

  await expect(page.getByText(/TABLET-01 · 12 COMPONENTES · OPEN/)).toBeVisible();
  await expect(page.getByText(/POWER ON · BOOT RUNNING/)).toBeVisible();
  await expect(page.getByText(/Tablet 01 restaurado de/)).toBeVisible();
  await expect(page.getByText(/HISTORY · [7-9]/)).toBeVisible();

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});

test("S2.6 empty Workbench routes a tablet command to Tablet 01", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  await command(page, "Abra o tablet");
  await expect(page.getByText(/TABLET-01 · 12 COMPONENTES · OPEN/)).toBeVisible();
  await expect(page.getByLabel("Studio Intelligence").getByText("Aberto: Tablet 01", { exact: true })).toBeVisible();
});

test("S2.6 Component Library exposes Tablet controller overlay while Notebook and Smartphone remain available", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /COMPONENT LIBRARY · \d+/ }).click();
  const library = page.getByLabel("Universal Component Library");

  await library.getByLabel("Filtrar família de produto").selectOption("tablet");
  await expect(library.getByRole("button", { name: /General Microcontroller/ })).toBeVisible();
  await expect(library.getByRole("button", { name: /OLED Touch Display/ })).toBeVisible();
  await expect(library.getByRole("button", { name: /Mobile System-on-Chip/ })).toBeVisible();

  await library.getByLabel("Filtrar família de produto").selectOption("notebook");
  await expect(library.getByRole("button", { name: /General Microcontroller/ })).toBeVisible();
  await expect(library.getByRole("button", { name: /OLED Touch Display/ })).toBeVisible();

  await library.getByLabel("Filtrar família de produto").selectOption("smartphone");
  await expect(library.getByRole("button", { name: /Mobile System-on-Chip/ })).toBeVisible();
  await expect(library.getByRole("button", { name: /OLED Touch Display/ })).toBeVisible();
});