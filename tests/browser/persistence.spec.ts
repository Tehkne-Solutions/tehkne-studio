import { expect, test } from "@playwright/test";

async function resetBrowserProjectStorage(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
}

test("S2.2 Desktop project survives browser reload with graph state and semantic history", async ({ page }) => {
  await resetBrowserProjectStorage(page);

  await page.getByRole("button", { name: "Chamar Desktop PC" }).click();
  const command = page.getByLabel("Comando para o Tehkné Studio");
  await command.fill("Abra o computador");
  await page.getByRole("button", { name: "Executar", exact: true }).click();

  await expect(page.getByText(/DESKTOP-PC-001 · \d+ COMPONENTES · OPEN/)).toBeVisible();
  await expect(page.getByText("HISTORY · 1", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Guardar projeto" }).click();
  await expect(page.getByText("THE FIRST WORKBENCH", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restaurar Desktop salvo" })).toBeVisible();

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Restaurar Desktop salvo" })).toBeVisible();
  await page.getByRole("button", { name: "Restaurar Desktop salvo" }).click();

  await expect(page.getByText(/DESKTOP-PC-001 · \d+ COMPONENTES · OPEN/)).toBeVisible();
  await expect(page.getByText("HISTORY · 1", { exact: true })).toBeVisible();
  await expect(page.getByText(/Desktop PC restaurado de/)).toBeVisible();
});

test("S2.2 ARM failure, variant and Prototype Package survive browser reload without losing provenance", async ({ page }) => {
  await resetBrowserProjectStorage(page);

  await page.getByRole("button", { name: "Chamar ARM-01" }).click();
  const runtime = page.getByLabel("ARM-01 Robotics Runtime");
  await expect(runtime).toBeVisible();

  await runtime.getByRole("button", { name: "1,60 kg", exact: true }).click();
  await expect(runtime.getByText("FAULT", { exact: true }).first()).toBeVisible();
  await runtime.getByRole("button", { name: "Criar variante High Torque" }).click();
  await expect(runtime.getByLabel("ARM-01 Variant Comparison")).toContainText("VALIDATED");
  await runtime.getByRole("button", { name: "Preparar Prototype Package" }).click();
  await expect(runtime.getByLabel("ARM-01 Virtual Factory")).toContainText("PROTOTYPE PLAN");
  await expect(runtime.getByText("NOT FABRICATION READY", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Guardar projeto" }).click();
  await expect(page.getByRole("button", { name: "Restaurar ARM-01 salvo" })).toBeVisible();

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Restaurar ARM-01 salvo" }).click();

  const restoredRuntime = page.getByLabel("ARM-01 Robotics Runtime");
  await expect(restoredRuntime.getByLabel("ARM-01 Variant Comparison")).toContainText("VALIDATED");
  await expect(restoredRuntime.getByLabel("ARM-01 Virtual Factory")).toContainText("PROTOTYPE PLAN");
  await expect(restoredRuntime.getByText("NOT FABRICATION READY", { exact: true })).toBeVisible();
  await expect(page.getByText(/ARM-01 restaurado de/)).toBeVisible();
});
