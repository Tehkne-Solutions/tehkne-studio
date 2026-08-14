import { expect, test } from "@playwright/test";

test("Alpha 01 opens both golden workbenches without browser runtime errors", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "TEHKNÉ STUDIO" })).toBeVisible();
  await expect(page.getByText("ALPHA 01")).toBeVisible();
  await expect(page.getByText("THE FIRST WORKBENCH")).toBeVisible();

  await page.getByRole("button", { name: "Chamar Desktop PC" }).click();
  await expect(page.getByText(/DESKTOP-PC-001/)).toBeVisible();

  const command = page.getByLabel("Comando para o Tehkné Studio");
  await command.fill("Abra o computador");
  await page.getByRole("button", { name: "Executar", exact: true }).click();
  await expect(page.getByText(/HISTORY · [1-9]/)).toBeVisible();

  await page.getByRole("button", { name: "Guardar projeto" }).click();
  await expect(page.getByText("THE FIRST WORKBENCH")).toBeVisible();

  await page.getByRole("button", { name: "Chamar ARM-01" }).click();
  await expect(page.getByText(/ARM-01 · 3 JOINTS/)).toBeVisible();
  await expect(page.getByLabel("ARM-01 Robotics Runtime")).toBeVisible();

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
