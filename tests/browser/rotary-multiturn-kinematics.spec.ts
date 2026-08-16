import { expect, test } from "@playwright/test";

test("S2.24 derives continuous multi-turn angle across repeated steps targets and restore", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/"); await page.evaluate(() => window.localStorage.clear()); await page.reload({ waitUntil: "networkidle" }); await page.getByTestId("invention-3d-trigger").click();
  const workbench = page.getByRole("region", { name: "3D Invention Workbench" }); const definition = workbench.getByLabel("Definição 3D"); const add = workbench.getByRole("button", { name: "Adicionar ao 3D" });
  await definition.selectOption("actuation.motor.dc-brushed-v1"); await add.click(); await definition.selectOption("mechanical.wheel.drive-v1"); await add.click();
  await workbench.getByLabel("Origem 3D").selectOption({ label: "Brushed DC Motor · shaft-out" }); await workbench.getByLabel("Destino 3D").selectOption({ label: "Drive Wheel · hub-in" }); await workbench.getByRole("button", { name: "Conectar no 3D" }).click();
  const joint = page.getByTestId("rotary-joint-invention-connection-1"); await expect(page.getByTestId("mechanical-constraint-invention-connection-1")).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "0.000"); await expect(joint).toHaveAttribute("data-revolutions", "0"); await expect(joint).toHaveAttribute("data-kinematics-source", "session-events+spatial");
  const plus = joint.getByRole("button", { name: "JOINT +", exact: true }); for (let index = 0; index < 24; index += 1) await plus.click();
  await expect(joint).toHaveAttribute("data-angle-rad", "0.000"); await expect(joint).toHaveAttribute("data-continuous-angle-rad", "6.283"); await expect(joint).toHaveAttribute("data-revolutions", "1"); await expect(joint).toHaveAttribute("data-kinematics-evidence", "24");
  const target = joint.getByLabel("Rotary joint target angle degrees"); await target.fill("170"); await joint.getByRole("button", { name: "SET ANGLE", exact: true }).click();
  await expect(joint).toHaveAttribute("data-angle-rad", "2.967"); await expect(joint).toHaveAttribute("data-continuous-angle-rad", "9.250"); await expect(joint).toHaveAttribute("data-revolutions", "1");
  await target.fill("-170"); await joint.getByRole("button", { name: "SET ANGLE", exact: true }).click();
  await expect(joint).toHaveAttribute("data-angle-rad", "-2.967"); await expect(joint).toHaveAttribute("data-continuous-angle-rad", "9.599"); await expect(joint).toHaveAttribute("data-revolutions", "2"); await expect(joint).toHaveAttribute("data-kinematics-evidence", "26");
  await workbench.getByRole("button", { name: "Guardar 3D" }).click(); await workbench.getByRole("button", { name: "Fechar 3D Invention Workbench", exact: true }).click(); await page.reload({ waitUntil: "networkidle" }); await page.getByTestId("invention-3d-trigger").click();
  const restored = page.getByTestId("rotary-joint-invention-connection-1"); await expect(restored).toHaveAttribute("data-angle-rad", "-2.967", { timeout: 20_000 }); await expect(restored).toHaveAttribute("data-continuous-angle-rad", "9.599"); await expect(restored).toHaveAttribute("data-revolutions", "2"); await expect(restored).toHaveAttribute("data-kinematics-evidence", "26");
  await restored.getByRole("button", { name: "JOINT +", exact: true }).click(); await expect(restored).toHaveAttribute("data-command-id", "mechanical-cmd-27"); await expect(restored).toHaveAttribute("data-continuous-angle-rad", "9.861");
  expect(errors).toEqual([]);
});
