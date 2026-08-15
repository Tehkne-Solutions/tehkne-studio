import { expect, test } from "@playwright/test";

async function command(page: import("@playwright/test").Page, text: string) {
  const input = page.getByLabel("Comando para o Tehkné Studio");
  await input.fill(text);
  await page.getByRole("button", { name: "Executar", exact: true }).click();
}

test("S2.4 Smartphone 01 runs teardown, causal boot recovery and persistence through Studio Intelligence", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Chamar Smartphone 01" }).click();
  await expect(page.getByText(/SMARTPHONE-01 · 11 COMPONENTES · CLOSED/)).toBeVisible();
  await expect(page.getByText(/POWER OFF · BOOT IDLE/)).toBeVisible();

  await command(page, "Abra o celular");
  await expect(page.getByText(/SMARTPHONE-01 · 11 COMPONENTES · OPEN/)).toBeVisible();

  await command(page, "Tire a bateria");
  await expect(page.getByText("Battery Pack", { exact: true })).toBeVisible();
  await expect(page.getByText(/phone.battery · removed/)).toBeVisible();

  await command(page, "Ligue o celular");
  await expect(page.getByText(/POWER FAULT · BOOT POST/)).toBeVisible();
  await expect(page.getByLabel("Timeline do boot")).toBeVisible();

  await command(page, "Por que não iniciou?");
  await expect(page.getByLabel("Rastreamento causal")).toContainText("Battery Pack");

  await command(page, "Reinstale a bateria");
  await expect(page.getByText(/phone.battery · connected/)).toBeVisible();

  await command(page, "Ligue o smartphone");
  await expect(page.getByText(/POWER ON · BOOT RUNNING/)).toBeVisible();
  await expect(page.getByLabel("Timeline do boot")).toContainText("RUNNING");

  await page.getByRole("button", { name: "Guardar projeto" }).click();
  await expect(page.getByRole("button", { name: "Restaurar Smartphone salvo" })).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Restaurar Smartphone salvo" }).click();

  await expect(page.getByText(/SMARTPHONE-01 · 11 COMPONENTES · OPEN/)).toBeVisible();
  await expect(page.getByText(/POWER ON · BOOT RUNNING/)).toBeVisible();
  await expect(page.getByText(/Smartphone 01 restaurado de/)).toBeVisible();
  await expect(page.getByText(/HISTORY · [6-9]/)).toBeVisible();

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});

test("S2.4 empty Workbench routes a natural-language smartphone command to Smartphone 01", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  await command(page, "Abra o smartphone");
  await expect(page.getByText(/SMARTPHONE-01 · 11 COMPONENTES · OPEN/)).toBeVisible();
  await expect(page.getByText(/Smartphone 01 materializado|aberto/i)).toBeVisible();
});
