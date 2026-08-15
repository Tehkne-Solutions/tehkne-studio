import { expect, test } from "@playwright/test";

async function command(page: import("@playwright/test").Page, text: string) {
  const input = page.getByLabel("Comando para o Tehkné Studio");
  await input.fill(text);
  await page.getByRole("button", { name: "Executar", exact: true }).click();
}

test("S2.5 Notebook 01 runs DDR causal teardown, recovery and persistence", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Chamar Notebook 01" }).click();
  await expect(page.getByText(/NOTEBOOK-01 · 12 COMPONENTES · CLOSED/)).toBeVisible();
  await expect(page.getByText(/POWER OFF · BOOT IDLE/)).toBeVisible();

  await command(page, "Abra o notebook");
  await expect(page.getByText(/NOTEBOOK-01 · 12 COMPONENTES · OPEN/)).toBeVisible();

  await command(page, "Tire a RAM");
  await expect(page.getByText("DDR Memory", { exact: true })).toBeVisible();
  await expect(page.getByText(/notebook.memory · removed/)).toBeVisible();

  await command(page, "Ligue o notebook");
  await expect(page.getByText(/POWER FAULT · BOOT MEMORY_CHECK/)).toBeVisible();
  await expect(page.getByLabel("Timeline do boot")).toBeVisible();

  await command(page, "Por que não iniciou?");
  await expect(page.getByLabel("Rastreamento causal")).toContainText("DDR Memory");

  await command(page, "Reinstale a RAM");
  await expect(page.getByText(/notebook.memory · connected/)).toBeVisible();

  await command(page, "Ligue o laptop");
  await expect(page.getByText(/POWER ON · BOOT RUNNING/)).toBeVisible();
  await expect(page.getByLabel("Timeline do boot")).toContainText("RUNNING");

  await page.getByRole("button", { name: "Guardar projeto" }).click();
  await expect(page.getByRole("button", { name: "Restaurar Notebook salvo" })).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Restaurar Notebook salvo" }).click();

  await expect(page.getByText(/NOTEBOOK-01 · 12 COMPONENTES · OPEN/)).toBeVisible();
  await expect(page.getByText(/POWER ON · BOOT RUNNING/)).toBeVisible();
  await expect(page.getByText(/Notebook 01 restaurado de/)).toBeVisible();
  await expect(page.getByText(/HISTORY · [6-9]/)).toBeVisible();

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});

test("S2.5 empty Workbench routes a notebook command to Notebook 01", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  await command(page, "Abra o notebook");
  await expect(page.getByText(/NOTEBOOK-01 · 12 COMPONENTES · OPEN/)).toBeVisible();
  await expect(page.getByLabel("Studio Intelligence").getByText("Aberto: Notebook 01", { exact: true })).toBeVisible();
});

test("S2.5 Component Library exposes Notebook overlay capabilities without hiding Smartphone coverage", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /COMPONENT LIBRARY · \d+/ }).click();
  const library = page.getByLabel("Universal Component Library");

  await library.getByLabel("Filtrar família de produto").selectOption("notebook");
  await expect(library.getByRole("button", { name: /OLED Touch Display/ })).toBeVisible();
  await expect(library.getByRole("button", { name: /General Microcontroller/ })).toBeVisible();

  const search = library.getByLabel("Buscar componentes");
  await search.fill("Mobile System-on-Chip");
  await library.getByRole("button", { name: /Mobile System-on-Chip/ }).click();
  await expect(library.getByText("thermal.compute-spreader", { exact: true })).toBeVisible();
  await expect(library.getByText("usb.usb-c", { exact: true })).toBeVisible();
  await expect(library.getByText("memory.ddr", { exact: true })).toBeVisible();

  await search.fill("");
  await library.getByLabel("Filtrar família de produto").selectOption("smartphone");
  await expect(library.getByRole("button", { name: /Mobile System-on-Chip/ })).toBeVisible();
  await expect(library.getByRole("button", { name: /OLED Touch Display/ })).toBeVisible();
});
