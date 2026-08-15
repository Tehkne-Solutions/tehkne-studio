import { expect, test } from "@playwright/test";

async function electronicsCommand(page: import("@playwright/test").Page, text: string) {
  const input = page.getByLabel("Comando para a bancada eletrônica");
  await input.fill(text);
  await page.getByLabel("Electronics Studio Intelligence").getByRole("button", { name: "Executar", exact: true }).click();
}

test("S2.8 Electronics Workbench teaches safe circuit, measurement, fault and persistent recovery evidence", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Abrir Electronics Workbench" }).click();
  const workbench = page.getByLabel("Tehkné Electronics Workbench");
  const panel = page.getByLabel("Electronics Workbench");
  await expect(workbench).toBeVisible();
  await expect(panel.getByText(/Fonte → Chave → Resistor → LED/)).toBeVisible();
  await expect(panel.getByText("OPEN", { exact: true })).toBeVisible();

  await panel.getByRole("button", { name: "Preset seguro · 330 Ω" }).click();
  await expect(panel.getByText("PASS", { exact: true })).toBeVisible();
  await expect(panel).toContainText(/9\.09 mA/);
  await expect(panel).toContainText("Circuito saudável");

  await panel.getByRole("button", { name: "Corrente", exact: true }).click();
  const measurement = page.getByLabel("Última medição do multímetro");
  await expect(measurement).toContainText("circuit-current");
  await expect(measurement).toContainText("calculated");

  await panel.getByRole("button", { name: "Teste de falha · 100 Ω" }).click();
  await expect(panel.getByText("FAULT", { exact: true })).toBeVisible();
  await expect(panel).toContainText("Sobrecorrente");
  await expect(page.getByLabel("Componente eletrônico selecionado").getByText(/electronics\.root/)).toBeVisible();

  await page.getByRole("button", { name: "Guardar experimento" }).click();
  await expect(page.getByLabel("Electronics Studio Intelligence")).toContainText(/Electronics Workbench salva/);
  await page.getByRole("button", { name: "Voltar ao First Workbench" }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Restaurar bancada eletrônica" }).click();

  await expect(page.getByLabel("Tehkné Electronics Workbench")).toBeVisible();
  await expect(page.getByLabel("Electronics Studio Intelligence")).toContainText(/restaurada · 2 simulações · sem replay/);
  await expect(page.getByLabel("Electronics Workbench").getByText("FAULT", { exact: true })).toBeVisible();

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});

test("S2.8 electronics natural-language controls change the same simulated circuit", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Abrir Electronics Workbench" }).click();

  await electronicsCommand(page, "Feche a chave do circuito");
  await expect(page.getByLabel("Electronics Studio Intelligence")).toContainText("Circuito saudável");
  await expect(page.getByLabel("Electronics Workbench").getByText("PASS", { exact: true })).toBeVisible();

  await electronicsCommand(page, "Resistor 100 ohms");
  await expect(page.getByLabel("Electronics Studio Intelligence")).toContainText("Sobrecorrente");
  await expect(page.getByLabel("Electronics Workbench").getByText("FAULT", { exact: true })).toBeVisible();

  await electronicsCommand(page, "Resistor 470 ohms");
  await expect(page.getByLabel("Electronics Studio Intelligence")).toContainText("Circuito saudável");
  await expect(page.getByLabel("Electronics Workbench").getByText("PASS", { exact: true })).toBeVisible();

  await electronicsCommand(page, "Meça corrente");
  await expect(page.getByLabel("Electronics Studio Intelligence")).toContainText(/Multímetro: .* A · calculated/);
});

test("S2.8 selected electronic components expose technical values and provenance without hiding beginner controls", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Abrir Electronics Workbench" }).click();

  await electronicsCommand(page, "Inspecione o resistor");
  const inspector = page.getByLabel("Componente eletrônico selecionado");
  await expect(inspector).toContainText("Resistor Limitador");
  await expect(inspector).toContainText("resistanceOhm");
  await expect(inspector).toContainText("330 Ω");
  await expect(inspector).toContainText("user");

  await electronicsCommand(page, "Inspecione o multímetro");
  await expect(inspector).toContainText("Multímetro Virtual");
  await expect(inspector).toContainText("lastValue");
  await expect(inspector).toContainText("calculated");
});
