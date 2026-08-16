import { expect, test } from "@playwright/test";

test("S2.27 authors persists and executes rotary HOME through the canonical continuous target path", async ({ page }) => {
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
  const continuous = joint.getByLabel("Rotary joint continuous target degrees");
  await expect(joint).toHaveAttribute("data-home-authored", "false");
  await expect(joint.getByRole("button", { name: "GO HOME", exact: true })).toBeDisabled();

  await continuous.fill("360");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-1");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "6.283");
  await expect(joint).toHaveAttribute("data-kinematics-evidence", "1");

  await joint.getByRole("button", { name: "SET HOME", exact: true }).click();
  await expect(joint).toHaveAttribute("data-home-authored", "true");
  await expect(joint).toHaveAttribute("data-home-mode", "continuous");
  await expect(joint).toHaveAttribute("data-home-rad", "6.283");
  await expect(joint).toHaveAttribute("data-home-command-id", "mechanical-home-cmd-1");
  await expect(joint).toHaveAttribute("data-home-command-action", "set");
  await expect(joint).toHaveAttribute("data-kinematics-evidence", "1");

  await continuous.fill("0");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-2");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "0.000");

  await joint.getByLabel("Rotary joint minimum travel degrees").fill("-90");
  await joint.getByLabel("Rotary joint maximum travel degrees").fill("90");
  await joint.getByRole("button", { name: "SET LIMITS", exact: true }).click();
  await expect(joint).toHaveAttribute("data-travel-limited", "true");
  await joint.getByRole("button", { name: "GO HOME", exact: true }).click();
  await expect(page.getByTestId("invention-3d-feedback")).toContainText("travel limit exceeded");
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-2");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "0.000");
  await expect(joint).toHaveAttribute("data-kinematics-evidence", "2");

  await joint.getByRole("button", { name: "CLEAR LIMITS", exact: true }).click();
  await joint.getByRole("button", { name: "GO HOME", exact: true }).click();
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-6");
  await expect(joint).toHaveAttribute("data-command-mode", "continuous-absolute");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "6.283");
  await expect(joint).toHaveAttribute("data-revolutions", "1");
  await expect(joint).toHaveAttribute("data-kinematics-evidence", "3");
  await expect(joint).toContainText("HOME +6.283 rad");

  await workbench.getByRole("button", { name: "Guardar 3D" }).click();
  await workbench.getByRole("button", { name: "Fechar 3D Invention Workbench", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();
  const restored = page.getByTestId(`rotary-joint-${relationshipId}`);
  await expect(restored).toHaveAttribute("data-home-authored", "true", { timeout: 20_000 });
  await expect(restored).toHaveAttribute("data-home-rad", "6.283");
  await expect(restored).toHaveAttribute("data-continuous-angle-rad", "6.283");
  await expect(restored).toHaveAttribute("data-kinematics-evidence", "3");

  await restored.getByRole("button", { name: "CLEAR HOME", exact: true }).click();
  await expect(restored).toHaveAttribute("data-home-authored", "false");
  await expect(restored).toHaveAttribute("data-home-command-id", "mechanical-home-cmd-4");
  await expect(restored).toHaveAttribute("data-home-command-action", "clear");
  await expect(restored.getByRole("button", { name: "GO HOME", exact: true })).toBeDisabled();
  await expect(restored).toHaveAttribute("data-kinematics-evidence", "3");

  expect(errors).toEqual([]);
});
