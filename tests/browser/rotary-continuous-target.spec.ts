import { expect, test } from "@playwright/test";

test("S2.25 commands absolute multi-turn rotary targets through the session CommandBus and restores them", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();
  const workbench = page.getByRole("region", { name: "3D Invention Workbench" });
  const definition = workbench.getByLabel("Definição 3D");
  const add = workbench.getByRole("button", { name: "Adicionar ao 3D" });
  await definition.selectOption("actuation.motor.dc-brushed-v1"); await add.click();
  await definition.selectOption("mechanical.wheel.drive-v1"); await add.click();
  await workbench.getByLabel("Origem 3D").selectOption({ label: "Brushed DC Motor · shaft-out" });
  await workbench.getByLabel("Destino 3D").selectOption({ label: "Drive Wheel · hub-in" });
  await workbench.getByRole("button", { name: "Conectar no 3D" }).click();

  const relationshipId = "invention-connection-1";
  await expect(page.getByTestId(`mechanical-constraint-${relationshipId}`)).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });
  const joint = page.getByTestId(`rotary-joint-${relationshipId}`);
  await expect(joint).toHaveAttribute("data-continuous-target-mode", "continuous-absolute");
  await expect(joint).toHaveAttribute("data-command-bus", "session");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "0.000");
  await expect(joint).toHaveAttribute("data-revolutions", "0");

  const target = joint.getByLabel("Rotary joint continuous target degrees");
  await target.fill("720");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-1");
  await expect(joint).toHaveAttribute("data-command-source", "ui");
  await expect(joint).toHaveAttribute("data-command-mode", "continuous-absolute");
  await expect(joint).toHaveAttribute("data-angle-rad", "0.000");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "12.566");
  await expect(joint).toHaveAttribute("data-revolutions", "2");
  await expect(joint).toHaveAttribute("data-kinematics-evidence", "1");

  await target.fill("-450");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-2");
  await expect(joint).toHaveAttribute("data-command-mode", "continuous-absolute");
  await expect(joint).toHaveAttribute("data-angle-rad", "-1.571");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "-7.854");
  await expect(joint).toHaveAttribute("data-revolutions", "-1");
  await expect(joint).toHaveAttribute("data-kinematics-evidence", "2");

  await workbench.getByRole("button", { name: "Guardar 3D" }).click();
  await workbench.getByRole("button", { name: "Fechar 3D Invention Workbench", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();
  const restored = page.getByTestId(`rotary-joint-${relationshipId}`);
  await expect(restored).toHaveAttribute("data-angle-rad", "-1.571", { timeout: 20_000 });
  await expect(restored).toHaveAttribute("data-continuous-angle-rad", "-7.854");
  await expect(restored).toHaveAttribute("data-revolutions", "-1");
  await expect(restored).toHaveAttribute("data-kinematics-evidence", "2");

  const restoredTarget = restored.getByLabel("Rotary joint continuous target degrees");
  await restoredTarget.fill("810");
  await restored.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await expect(restored).toHaveAttribute("data-command-id", "mechanical-cmd-3");
  await expect(restored).toHaveAttribute("data-angle-rad", "1.571");
  await expect(restored).toHaveAttribute("data-continuous-angle-rad", "14.137");
  await expect(restored).toHaveAttribute("data-revolutions", "2");
  await expect(restored).toHaveAttribute("data-kinematics-evidence", "3");

  expect(errors).toEqual([]);
});
