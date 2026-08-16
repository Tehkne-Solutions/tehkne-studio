import { expect, test } from "@playwright/test";

test("S2.26 authors persists enforces and clears rotary travel limits without parallel state", async ({ page }) => {
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
  await expect(joint).toHaveAttribute("data-travel-limited", "false");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "0.000");
  await expect(joint).toHaveAttribute("data-kinematics-evidence", "0");

  await joint.getByLabel("Rotary joint minimum travel degrees").fill("-180");
  await joint.getByLabel("Rotary joint maximum travel degrees").fill("540");
  await joint.getByRole("button", { name: "SET LIMITS", exact: true }).click();
  await expect(joint).toHaveAttribute("data-travel-limited", "true");
  await expect(joint).toHaveAttribute("data-travel-limit-mode", "continuous");
  await expect(joint).toHaveAttribute("data-travel-min-rad", "-3.142");
  await expect(joint).toHaveAttribute("data-travel-max-rad", "9.425");
  await expect(joint).toHaveAttribute("data-limit-command-id", "mechanical-cmd-1");
  await expect(joint).toHaveAttribute("data-limit-command-action", "set");
  await expect(joint).toHaveAttribute("data-kinematics-evidence", "0");

  const continuous = joint.getByLabel("Rotary joint continuous target degrees");
  await continuous.fill("360");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-2");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "6.283");
  await expect(joint).toHaveAttribute("data-revolutions", "1");
  await expect(joint).toHaveAttribute("data-kinematics-evidence", "1");

  await continuous.fill("720");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await expect(page.getByTestId("invention-3d-feedback")).toContainText("travel limit exceeded");
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-2");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "6.283");
  await expect(joint).toHaveAttribute("data-kinematics-evidence", "1");

  const principal = joint.getByLabel("Rotary joint target angle degrees");
  await principal.fill("170");
  await joint.getByRole("button", { name: "SET ANGLE", exact: true }).click();
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-4");
  await expect(joint).toHaveAttribute("data-angle-rad", "2.967");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "9.250");
  await expect(joint).toHaveAttribute("data-kinematics-evidence", "2");

  await principal.fill("-170");
  await joint.getByRole("button", { name: "SET ANGLE", exact: true }).click();
  await expect(page.getByTestId("invention-3d-feedback")).toContainText("travel limit exceeded");
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-4");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "9.250");
  await expect(joint).toHaveAttribute("data-kinematics-evidence", "2");

  await joint.getByRole("button", { name: "JOINT +", exact: true }).click();
  await expect(page.getByTestId("invention-3d-feedback")).toContainText("travel limit exceeded");
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-4");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "9.250");

  await workbench.getByRole("button", { name: "Guardar 3D" }).click();
  await workbench.getByRole("button", { name: "Fechar 3D Invention Workbench", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();
  const restored = page.getByTestId(`rotary-joint-${relationshipId}`);
  await expect(restored).toHaveAttribute("data-travel-limited", "true", { timeout: 20_000 });
  await expect(restored).toHaveAttribute("data-travel-min-rad", "-3.142");
  await expect(restored).toHaveAttribute("data-travel-max-rad", "9.425");
  await expect(restored).toHaveAttribute("data-continuous-angle-rad", "9.250");
  await expect(restored).toHaveAttribute("data-kinematics-evidence", "2");

  const restoredContinuous = restored.getByLabel("Rotary joint continuous target degrees");
  await restoredContinuous.fill("720");
  await restored.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await expect(page.getByTestId("invention-3d-feedback")).toContainText("travel limit exceeded");
  await expect(restored).toHaveAttribute("data-continuous-angle-rad", "9.250");

  await restored.getByRole("button", { name: "CLEAR LIMITS", exact: true }).click();
  await expect(restored).toHaveAttribute("data-travel-limited", "false");
  await expect(restored).toHaveAttribute("data-limit-command-action", "clear");
  await expect(restored).toHaveAttribute("data-limit-command-id", "mechanical-cmd-6");
  await expect(restored).toHaveAttribute("data-kinematics-evidence", "2");

  await restoredContinuous.fill("720");
  await restored.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await expect(restored).toHaveAttribute("data-command-id", "mechanical-cmd-7");
  await expect(restored).toHaveAttribute("data-command-mode", "continuous-absolute");
  await expect(restored).toHaveAttribute("data-continuous-angle-rad", "12.566");
  await expect(restored).toHaveAttribute("data-revolutions", "2");
  await expect(restored).toHaveAttribute("data-kinematics-evidence", "3");

  expect(errors).toEqual([]);
});
