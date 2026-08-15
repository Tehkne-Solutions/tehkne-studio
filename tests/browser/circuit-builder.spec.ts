import { expect, test } from "@playwright/test";

function circuitBuilderPanel(page: import("@playwright/test").Page) {
  return page.getByRole("complementary", { name: "Circuit Builder", exact: true });
}

async function command(page: import("@playwright/test").Page, text: string) {
  const studio = page.getByLabel("Electronics Studio Intelligence");
  const input = studio.getByLabel("Comando para a bancada eletrônica");
  await input.fill(text);
  await studio.getByRole("button", { name: "Executar", exact: true }).click();
}

async function connect(page: import("@playwright/test").Page, from: string, to: string) {
  const panel = circuitBuilderPanel(page);
  await panel.getByLabel("Terminal de saída do fio").selectOption({ label: from });
  await panel.getByLabel("Terminal de entrada do fio").selectOption({ label: to });
  await panel.getByRole("button", { name: "Conectar fio", exact: true }).click();
}

test("S2.9 Circuit Builder creates, wires, simulates, probes, faults and restores a circuit", async ({ page }) => {
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
  await expect(page.getByText("Electronics Workbench · Preset DC S2.8", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Abrir Circuit Builder S2.9" }).click();
  const builder = circuitBuilderPanel(page);
  await expect(builder).toBeVisible();
  await expect(builder.getByText(/S2.9 · CIRCUIT CREATION & MEASUREMENT/)).toBeVisible();

  await builder.getByRole("button", { name: "Novo circuito" }).click();
  await builder.getByRole("button", { name: "+ Fonte", exact: true }).click();
  await builder.getByRole("button", { name: "+ Chave", exact: true }).click();
  await builder.getByRole("button", { name: "+ Resistor", exact: true }).click();
  await builder.getByRole("button", { name: "+ LED", exact: true }).click();
  await expect(builder.getByText("CIRCUIT GRAPH · 4 COMPONENTES · 0 FIOS", { exact: true })).toBeVisible();

  await connect(page, "Fonte DC 1 · positive", "Chave 1 · input");
  await connect(page, "Chave 1 · output", "Resistor 1 · input");
  await connect(page, "Resistor 1 · output", "LED 1 · anode");
  await connect(page, "LED 1 · cathode", "Fonte DC 1 · negative");
  await expect(builder.getByText("CIRCUIT GRAPH · 4 COMPONENTES · 4 FIOS", { exact: true })).toBeVisible();

  await builder.getByRole("button", { name: "Alternar chave" }).click();
  await expect(builder.getByText("PASS", { exact: true })).toBeVisible();
  await expect(builder.getByText(/9\.09 mA/)).toBeVisible();

  await builder.getByRole("button", { name: "Probe do resistor" }).click();
  await expect(builder.getByLabel("Última medição do Circuit Builder")).toContainText("3 V");
  await expect(page.getByLabel("Componente eletrônico selecionado")).toContainText("VoltageProbe");

  await builder.getByLabel("Resistência do Circuit Builder").fill("100");
  await builder.getByRole("button", { name: "Aplicar Ω" }).click();
  await builder.getByRole("button", { name: "Simular", exact: true }).click();
  await expect(builder.getByText("FAULT", { exact: true })).toBeVisible();
  await expect(builder).toContainText("Sobrecorrente");

  await page.getByRole("button", { name: "Guardar experimento" }).click();
  await expect(page.getByText(/simulações S2\.9/)).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Restaurar bancada eletrônica" }).click();

  const restoredBuilder = circuitBuilderPanel(page);
  await expect(restoredBuilder).toBeVisible();
  await expect(restoredBuilder.getByText("CIRCUIT GRAPH · 4 COMPONENTES · 4 FIOS", { exact: true })).toBeVisible();
  await expect(restoredBuilder.getByText("FAULT", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Electronics Studio Intelligence")).toContainText(/0 simulações S2\.8 · 2 simulações S2\.9 · sem replay/);

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});

test("S2.9 Studio Intelligence can build and measure the supported circuit by natural language", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Abrir Electronics Workbench" }).click();
  await page.getByRole("button", { name: "Abrir Circuit Builder S2.9" }).click();

  await command(page, "monte circuito série com LED");
  await expect(circuitBuilderPanel(page).getByText("CIRCUIT GRAPH · 4 COMPONENTES · 4 FIOS", { exact: true })).toBeVisible();
  await command(page, "feche a chave");
  await expect(circuitBuilderPanel(page).getByText("PASS", { exact: true })).toBeVisible();
  await command(page, "meça tensão no resistor");
  await expect(page.getByLabel("Electronics Studio Intelligence")).toContainText(/Resistor 1: 3 V · calculated/);
});
