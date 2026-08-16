import { expect, test } from "@playwright/test";

test("S2.20 derives the principal rotary joint angle from transforms and preserves it through rigid rotation and reload", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();

  const workspace = page.getByRole("region", { name: "3D Invention Workbench" });
  const definition = workspace.getByLabel("Definição 3D");
  const add = workspace.getByRole("button", { name: "Adicionar ao 3D" });

  const motorResponse = page.waitForResponse((response) => response.url().includes("/api/asset-forge/af001/motor/lod0") && response.status() === 200);
  await definition.selectOption("actuation.motor.dc-brushed-v1");
  await add.click();
  const response = await motorResponse;
  expect(response.headers()["x-tehkne-asset-version"]).toBe("0.6.6-hero-candidate");
  await definition.selectOption("mechanical.wheel.drive-v1");
  await add.click();

  await workspace.getByLabel("Origem 3D").selectOption({ label: "Brushed DC Motor · shaft-out" });
  await workspace.getByLabel("Destino 3D").selectOption({ label: "Drive Wheel · hub-in" });
  await workspace.getByRole("button", { name: "Conectar no 3D" }).click();

  const constraint = page.getByTestId("mechanical-constraint-invention-connection-1");
  const joint = page.getByTestId("rotary-joint-invention-connection-1");
  await expect(constraint).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });
  await expect(constraint).toHaveAttribute("data-axial-state", "aligned");
  await expect(joint).toHaveAttribute("data-state", "ready");
  await expect(joint).toHaveAttribute("data-angle-mode", "principal-derived");
  await expect(joint).toHaveAttribute("data-angle-rad", "0.000");

  const plus = joint.getByRole("button", { name: "JOINT +", exact: true });
  await plus.click();
  await expect(joint).toHaveAttribute("data-angle-rad", "0.262");
  await expect(joint).toContainText("15.0°");
  await plus.click();
  await expect(joint).toHaveAttribute("data-angle-rad", "0.524");
  await expect(joint).toContainText("30.0°");
  await expect(constraint).toHaveAttribute("data-state", "snapped");
  await expect(constraint).toHaveAttribute("data-axial-state", "aligned");

  await workspace.getByRole("button", { name: /Brushed DC Motor/ }).click();
  await workspace.getByRole("button", { name: "RY +", exact: true }).click();
  await expect(constraint).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });
  await expect(constraint).toHaveAttribute("data-axial-state", "aligned");
  await expect(joint).toHaveAttribute("data-angle-rad", "0.524");

  await workspace.getByRole("button", { name: "Guardar 3D" }).click();
  await workspace.getByRole("button", { name: "Fechar 3D Invention Workbench", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();

  const restoredJoint = page.getByTestId("rotary-joint-invention-connection-1");
  const restoredConstraint = page.getByTestId("mechanical-constraint-invention-connection-1");
  await expect(restoredConstraint).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });
  await expect(restoredConstraint).toHaveAttribute("data-axial-state", "aligned");
  await expect(restoredJoint).toHaveAttribute("data-angle-mode", "principal-derived");
  await expect(restoredJoint).toHaveAttribute("data-angle-rad", "0.524");
  await expect(restoredJoint).toContainText("30.0°");

  await restoredJoint.getByRole("button", { name: "JOINT −", exact: true }).click();
  await expect(restoredJoint).toHaveAttribute("data-angle-rad", "0.262");
  await expect(restoredConstraint).toHaveAttribute("data-state", "snapped");
  await expect(restoredConstraint).toHaveAttribute("data-axial-state", "aligned");

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
