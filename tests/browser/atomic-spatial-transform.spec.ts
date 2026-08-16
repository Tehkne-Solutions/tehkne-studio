import { expect, test } from "@playwright/test";

function numberAttribute(value: string | null, label: string): number {
  if (value === null) throw new Error(`Missing numeric attribute: ${label}`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric attribute ${label}: ${value}`);
  return parsed;
}

test("S2.22 commits mechanical translation rotation alignment and rotary target through atomic spatial batches", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();

  const workspace = page.getByRole("region", { name: "3D Invention Workbench" });
  const status = page.getByTestId("invention-3d-status");
  const definition = workspace.getByLabel("Definição 3D");
  const add = workspace.getByRole("button", { name: "Adicionar ao 3D" });
  const selected = page.getByTestId("invention-3d-selected");

  await expect(status).toHaveAttribute("data-spatial-transform-mode", "atomic-batch");

  const motorResponse = page.waitForResponse((response) => response.url().includes("/api/asset-forge/af001/motor/lod0") && response.status() === 200);
  await definition.selectOption("actuation.motor.dc-brushed-v1");
  await add.click();
  await motorResponse;
  await definition.selectOption("mechanical.wheel.drive-v1");
  await add.click();

  await workspace.getByLabel("Origem 3D").selectOption({ label: "Brushed DC Motor · shaft-out" });
  await workspace.getByLabel("Destino 3D").selectOption({ label: "Drive Wheel · hub-in" });
  await workspace.getByRole("button", { name: "Conectar no 3D" }).click();

  const constraint = page.getByTestId("mechanical-constraint-invention-connection-1");
  const joint = page.getByTestId("rotary-joint-invention-connection-1");
  await expect(constraint).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });
  await expect(constraint).toHaveAttribute("data-axial-state", "aligned");
  await expect(joint).toHaveAttribute("data-transform-mode", "atomic-batch");

  await workspace.getByRole("button", { name: /Brushed DC Motor/ }).click();
  const motorZBefore = numberAttribute(await selected.getAttribute("data-z"), "motor z before");
  await workspace.getByRole("button", { name: /Drive Wheel/ }).click();
  const wheelZBefore = numberAttribute(await selected.getAttribute("data-z"), "wheel z before");

  await workspace.getByRole("button", { name: /Brushed DC Motor/ }).click();
  await workspace.getByRole("button", { name: "Z +", exact: true }).click();
  await expect(page.getByTestId("invention-3d-feedback")).toContainText("atomic batch");
  const motorZAfter = numberAttribute(await selected.getAttribute("data-z"), "motor z after");
  expect(motorZAfter - motorZBefore).toBeCloseTo(0.05, 3);

  await workspace.getByRole("button", { name: /Drive Wheel/ }).click();
  const wheelZAfter = numberAttribute(await selected.getAttribute("data-z"), "wheel z after");
  expect(wheelZAfter - wheelZBefore).toBeCloseTo(0.05, 3);
  await expect(constraint).toHaveAttribute("data-state", "snapped");
  await expect(constraint).toHaveAttribute("data-axial-state", "aligned");

  await workspace.getByRole("button", { name: /Brushed DC Motor/ }).click();
  await workspace.getByRole("button", { name: "RY +", exact: true }).click();
  await expect(page.getByTestId("invention-3d-feedback")).toContainText("atomic batch");
  await expect(constraint).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });
  await expect(constraint).toHaveAttribute("data-axial-state", "aligned");
  await expect(joint).toHaveAttribute("data-angle-rad", "0.000");

  await workspace.getByRole("button", { name: /Drive Wheel/ }).click();
  await joint.getByLabel("Rotary joint target angle degrees").fill("45");
  await joint.getByRole("button", { name: "SET ANGLE", exact: true }).click();
  await expect(joint).toHaveAttribute("data-angle-rad", "0.785");
  await expect(joint).toHaveAttribute("data-transform-mode", "atomic-batch");
  await expect(constraint).toHaveAttribute("data-state", "snapped");
  await expect(constraint).toHaveAttribute("data-axial-state", "aligned");

  await workspace.getByRole("button", { name: "Guardar 3D" }).click();
  await workspace.getByRole("button", { name: "Fechar 3D Invention Workbench", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();

  const restoredStatus = page.getByTestId("invention-3d-status");
  const restoredConstraint = page.getByTestId("mechanical-constraint-invention-connection-1");
  const restoredJoint = page.getByTestId("rotary-joint-invention-connection-1");
  await expect(restoredStatus).toHaveAttribute("data-spatial-transform-mode", "atomic-batch");
  await expect(restoredConstraint).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });
  await expect(restoredConstraint).toHaveAttribute("data-axial-state", "aligned");
  await expect(restoredJoint).toHaveAttribute("data-angle-rad", "0.785");
  await expect(restoredJoint).toHaveAttribute("data-transform-mode", "atomic-batch");

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
