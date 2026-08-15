import { expect, test } from "@playwright/test";

type Rect = { x: number; y: number; width: number; height: number };

function overlaps(a: Rect, b: Rect): boolean {
  const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
  const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
  return overlapX && overlapY;
}

test("Workbench launchers clear the persistent footer, occupy separate slots and remain clickable", async ({ page }) => {
  await page.goto("/");

  const electronicsLauncher = page.getByRole("button", { name: "Abrir Electronics Workbench" });
  const inventionLauncher = page.getByTestId("invention-3d-trigger");
  const footer = page.locator(".studio-footer");

  await expect(electronicsLauncher).toBeVisible();
  await expect(inventionLauncher).toBeVisible();
  await expect(footer).toBeVisible();

  const electronicsBox = await electronicsLauncher.boundingBox();
  const inventionBox = await inventionLauncher.boundingBox();
  const footerBox = await footer.boundingBox();
  expect(electronicsBox).not.toBeNull();
  expect(inventionBox).not.toBeNull();
  expect(footerBox).not.toBeNull();

  if (!electronicsBox || !inventionBox || !footerBox) throw new Error("Workbench launcher/footer bounds unavailable");
  expect(overlaps(electronicsBox, inventionBox), "Electronics and 3D launcher hit areas must not overlap").toBe(false);
  expect(overlaps(electronicsBox, footerBox), "Electronics launcher must clear the persistent footer").toBe(false);
  expect(overlaps(inventionBox, footerBox), "3D launcher must clear the persistent footer").toBe(false);

  await electronicsLauncher.click();
  await expect(page.getByRole("region", { name: "Tehkné Electronics Workbench" })).toBeVisible();
  await page.getByRole("button", { name: "Voltar ao First Workbench" }).click();

  await inventionLauncher.click();
  await expect(page.getByRole("region", { name: "3D Invention Workbench" })).toBeVisible();
  await page.getByRole("button", { name: "Fechar 3D Invention Workbench" }).click();
});
