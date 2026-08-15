import { expect, test } from "@playwright/test";

async function command(page: import("@playwright/test").Page, text: string) {
  const input = page.getByLabel("Comando para o Tehkné Studio");
  await input.fill(text);
  await page.getByRole("button", { name: "Executar", exact: true }).click();
}

test("S2.8 First Workbench launcher is driven by the six-preset signed registry", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  const launcher = page.locator('[data-preset-registry="tehkne-technology-presets-v1"]');
  await expect(launcher).toBeVisible();
  await expect(launcher).toHaveAttribute("data-preset-count", "6");
  await expect(launcher.locator("button[data-preset-id]")).toHaveCount(6);

  for (const [presetId, projectId, label] of [
    ["desktop-pc", "desktop-pc-001", "Chamar Desktop PC"],
    ["arm-01", "arm-01", "Chamar ARM-01"],
    ["smartphone-01", "smartphone-01", "Chamar Smartphone 01"],
    ["notebook-01", "notebook-01", "Chamar Notebook 01"],
    ["tablet-01", "tablet-01", "Chamar Tablet 01"],
    ["tv-01", "tv-01", "Chamar TV 01"]
  ] as const) {
    const button = launcher.locator(`button[data-preset-id="${presetId}"]`);
    await expect(button).toHaveAttribute("data-project-id", projectId);
    await expect(button).toHaveText(label);
  }

  await launcher.locator('button[data-preset-id="desktop-pc"]').click();
  await expect(page.getByText(/DESKTOP-PC-001 · \d+ COMPONENTES/)).toBeVisible();
  await page.getByRole("button", { name: "Guardar projeto" }).click();

  const restoredLauncher = page.locator('[data-preset-registry="tehkne-technology-presets-v1"]');
  await expect(restoredLauncher.locator('button[data-restore-preset-id="desktop-pc"]')).toHaveText("Restaurar Desktop salvo");

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});

test("S2.8 registry routes product names from the empty Workbench and generic component terms do not guess a family", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  await command(page, "Abra o computador");
  await expect(page.getByText(/DESKTOP-PC-001 · \d+ COMPONENTES · OPEN/)).toBeVisible();
  await page.getByRole("button", { name: "Voltar sem salvar" }).click();

  await command(page, "Abra a televisão");
  await expect(page.getByText(/TV-01 · 11 COMPONENTES · OPEN/)).toBeVisible();
  await page.getByRole("button", { name: "Voltar sem salvar" }).click();

  await command(page, "Abra o laptop");
  await expect(page.getByText(/NOTEBOOK-01 · 12 COMPONENTES · OPEN/)).toBeVisible();
  await page.getByRole("button", { name: "Voltar sem salvar" }).click();

  await command(page, "Inspecione a bateria");
  await expect(page.getByText("THE FIRST WORKBENCH", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar projeto" })).toHaveCount(0);
});
