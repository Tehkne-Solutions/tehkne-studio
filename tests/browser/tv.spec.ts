import { expect, test } from "@playwright/test";

async function command(page: import("@playwright/test").Page, text: string) {
  const input = page.getByLabel("Comando para o Tehkné Studio");
  await input.fill(text);
  await page.getByRole("button", { name: "Executar", exact: true }).click();
}

test("S2.7 TV 01 runs AC/DC causal teardown, recovery and persistence", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Chamar TV 01" }).click();
  await expect(page.getByText(/TV-01 · 13 COMPONENTES · CLOSED/)).toBeVisible();
  await expect(page.getByText(/POWER OFF · BOOT IDLE/)).toBeVisible();

  await command(page, "Abra a TV");
  await expect(page.getByText(/TV-01 · 13 COMPONENTES · OPEN/)).toBeVisible();

  await command(page, "Inspecione a fonte");
  await expect(page.getByText("TV AC/DC Power Supply", { exact: true })).toBeVisible();
  await expect(page.getByText(/tv.psu · connected/)).toBeVisible();

  await command(page, "Remova a fonte");
  await expect(page.getByText(/tv.psu · removed/)).toBeVisible();

  await command(page, "Ligue a TV");
  await expect(page.getByText(/POWER FAULT · BOOT [A-Z_]+/)).toBeVisible();
  await expect(page.getByLabel("Timeline do boot")).toBeVisible();

  await command(page, "Por que não iniciou?");
  await expect(page.getByLabel("Rastreamento causal")).toContainText("TV AC/DC Power Supply");

  await command(page, "Reinstale a fonte");
  await expect(page.getByText(/tv.psu · connected/)).toBeVisible();

  await command(page, "Ligue a TV");
  await expect(page.getByText(/POWER ON · BOOT RUNNING/)).toBeVisible();
  await expect(page.getByLabel("Timeline do boot")).toContainText("RUNNING");

  await page.getByRole("button", { name: "Guardar projeto" }).click();
  await expect(page.getByRole("button", { name: "Restaurar TV salva" })).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Restaurar TV salva" }).click();

  await expect(page.getByText(/TV-01 · 13 COMPONENTES · OPEN/)).toBeVisible();
  await expect(page.getByText(/POWER ON · BOOT RUNNING/)).toBeVisible();
  await expect(page.getByText(/TV 01 restaurado de/)).toBeVisible();

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});

test("S2.7 empty Workbench routes an explicit TV command to TV 01", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  await command(page, "Abra a TV");
  await expect(page.getByText(/TV-01 · 13 COMPONENTES · OPEN/)).toBeVisible();
  await expect(page.getByLabel("Studio Intelligence").getByText("Aberto: TV 01", { exact: true })).toBeVisible();
});

test("S2.7 Component Library exposes display-system extension and reused universal components", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /COMPONENT LIBRARY · \d+/ }).click();
  const library = page.getByLabel("Universal Component Library");

  await library.getByLabel("Filtrar família de produto").selectOption("display-system");
  await expect(library.getByRole("button", { name: /Display AC\/DC Power Supply/ })).toBeVisible();
  await expect(library.getByRole("button", { name: /Media Processing SoC/ })).toBeVisible();
  await expect(library.getByRole("button", { name: /Stereo Audio Amplifier/ })).toBeVisible();
  await expect(library.getByRole("button", { name: /Stereo Speaker Pair/ })).toBeVisible();
  await expect(library.getByRole("button", { name: /DC Power Regulator/ })).toBeVisible();

  await library.getByRole("button", { name: /Stereo Audio Amplifier/ }).click();
  await expect(library.getByText("audio", { exact: true })).toBeVisible();
  await expect(library.getByText("audio.digital-pcm", { exact: true })).toBeVisible();
  await expect(library.getByText("audio.speaker-level", { exact: true })).toBeVisible();
  await expect(library.getByText("CATALOG EXTENSION · DISPLAY-SYSTEM-V1", { exact: true })).toBeVisible();
});
