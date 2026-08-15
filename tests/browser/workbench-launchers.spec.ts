import { expect, test } from "@playwright/test";

test("Workbench launchers occupy separate interactive slots and both remain clickable", async ({ page }) => {
  await page.goto("/");

  const electronicsLauncher = page.getByRole("button", { name: "Abrir Electronics Workbench" });
  const inventionLauncher = page.getByTestId("invention-3d-trigger");

  await expect(electronicsLauncher).toBeVisible();
  await expect(inventionLauncher).toBeVisible();

  const electronicsBox = await electronicsLauncher.boundingBox();
  const inventionBox = await inventionLauncher.boundingBox();
  expect(electronicsBox).not.toBeNull();
  expect(inventionBox).not.toBeNull();

  if (!electronicsBox || !inventionBox) throw new Error("Workbench launcher bounds unavailable");
  const overlapX = electronicsBox.x < inventionBox.x + inventionBox.width
    && electronicsBox.x + electronicsBox.width > inventionBox.x;
  const overlapY = electronicsBox.y < inventionBox.y + inventionBox.height
    && electronicsBox.y + electronicsBox.height > inventionBox.y;
  expect(overlapX && overlapY, "Electronics and 3D launcher hit areas must not overlap").toBe(false);

  await electronicsLauncher.click();
  await expect(page.getByRole("region", { name: "Tehkné Electronics Workbench" })).toBeVisible();
  await page.getByRole("button", { name: "Voltar ao First Workbench" }).click();

  await inventionLauncher.click();
  await expect(page.getByRole("region", { name: "3D Invention Workbench" })).toBeVisible();
  await page.getByRole("button", { name: "Fechar 3D Invention Workbench" }).click();
});
