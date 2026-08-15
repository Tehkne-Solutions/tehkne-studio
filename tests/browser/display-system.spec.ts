import { expect, test } from "@playwright/test";

async function command(page: import("@playwright/test").Page, text: string) {
  const input = page.getByLabel("Comando para o Tehkné Studio");
  await input.fill(text);
  await page.getByRole("button", { name: "Executar", exact: true }).click();
}

test("S2.7 TV 01 runs AC/DC PSU causal teardown, HDMI inspection and persistence", async ({ page }) => {
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
  await expect(page.getByText(/TV-01 · 11 COMPONENTES · CLOSED/)).toBeVisible();
  await expect(page.getByText(/POWER OFF · BOOT IDLE/)).toBeVisible();

  await command(page, "Abra a TV");
  await expect(page.getByText(/TV-01 · 11 COMPONENTES · OPEN/)).toBeVisible();

  await command(page, "Inspecione o HDMI");
  await expect(page.getByText("TV HDMI Input", { exact: true })).toBeVisible();
  await expect(page.getByText(/tv.hdmi · available/)).toBeVisible();
  await expect(page.getByText(/versionLabel/)).toBeVisible();

  await command(page, "Tire a fonte");
  await expect(page.getByText("TV AC/DC Power Supply", { exact: true })).toBeVisible();
  await expect(page.getByText(/tv.psu · removed/)).toBeVisible();

  await command(page, "Ligue a TV");
  await expect(page.getByText(/POWER FAULT · BOOT POST/)).toBeVisible();
  await expect(page.getByLabel("Timeline do boot")).toBeVisible();

  await command(page, "Por que não iniciou?");
  await expect(page.getByLabel("Rastreamento causal")).toContainText("TV AC/DC Power Supply");

  await command(page, "Reinstale a fonte");
  await expect(page.getByText(/tv.psu · connected/)).toBeVisible();

  await command(page, "Ligue o televisor");
  await expect(page.getByText(/POWER ON · BOOT RUNNING/)).toBeVisible();
  await expect(page.getByLabel("Timeline do boot")).toContainText("RUNNING");

  await page.getByRole("button", { name: "Guardar projeto" }).click();
  await expect(page.getByRole("button", { name: "Restaurar TV salva" })).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Restaurar TV salva" }).click();

  await expect(page.getByText(/TV-01 · 11 COMPONENTES · OPEN/)).toBeVisible();
  await expect(page.getByText(/POWER ON · BOOT RUNNING/)).toBeVisible();
  await expect(page.getByText(/TV 01 restaurado de/)).toBeVisible();
  await expect(page.getByText(/HISTORY · \d+/)).toBeVisible();

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});

test("S2.7 empty Workbench routes a television command to TV 01", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  await command(page, "Abra a televisão");
  await expect(page.getByText(/TV-01 · 11 COMPONENTES · OPEN/)).toBeVisible();
  await expect(page.getByLabel("Studio Intelligence").getByText("Aberto: TV 01", { exact: true })).toBeVisible();
});

test("S2.7 Component Library exposes canonical display-system extension and preserves earlier families", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /COMPONENT LIBRARY · \d+/ }).click();
  const library = page.getByLabel("Universal Component Library");

  await library.getByLabel("Filtrar família de produto").selectOption("display-system");
  await expect(library.getByRole("button", { name: /Display Media System-on-Chip/ })).toBeVisible();
  await expect(library.getByRole("button", { name: /AC\/DC Power Supply/ })).toBeVisible();
  await expect(library.getByRole("button", { name: /Large Display Panel/ })).toBeVisible();
  await expect(library.getByRole("button", { name: /HDMI Input Interface/ })).toBeVisible();
  await expect(library.getByRole("button", { name: /Stereo Speaker Assembly/ })).toBeVisible();
  await expect(library.getByRole("button", { name: /General Microcontroller/ })).toBeVisible();
  await expect(library.getByRole("button", { name: /Wireless Connectivity Module/ })).toBeVisible();

  await library.getByRole("button", { name: /HDMI Input Interface/ }).click();
  await expect(library.getByText("video.hdmi.external", { exact: true })).toBeVisible();
  await expect(library.getByText("video.hdmi", { exact: true })).toBeVisible();

  await library.getByRole("button", { name: /Display Media System-on-Chip/ }).click();
  await expect(library.getByText("audio.line-level", { exact: true })).toBeVisible();
  await expect(library.getByText("usb.usb-c", { exact: true })).toBeVisible();

  await library.getByLabel("Filtrar família de produto").selectOption("notebook");
  await expect(library.getByRole("button", { name: /General Microcontroller/ })).toBeVisible();
  await library.getByLabel("Filtrar família de produto").selectOption("smartphone");
  await expect(library.getByRole("button", { name: /Mobile System-on-Chip/ })).toBeVisible();
});
