import { expect, test } from "@playwright/test";

test("S2.28 authors multiple rotary named positions navigates them through continuous targets and persists them", async ({ page }) => {
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
  const name = joint.getByLabel("Rotary named position name");
  const selector = joint.getByLabel("Rotary named position", { exact: true });
  await expect(joint).toHaveAttribute("data-named-position-count", "0");
  await expect(selector).toBeDisabled();

  await continuous.fill("90");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "1.571");
  await name.fill("Inspect");
  await joint.getByRole("button", { name: "SAVE POSITION", exact: true }).click();
  await expect(joint).toHaveAttribute("data-named-position-count", "1");
  await expect(joint).toHaveAttribute("data-selected-position-key", "inspect");
  await expect(joint).toHaveAttribute("data-position-command-id", "mechanical-position-cmd-1");
  await expect(joint).toHaveAttribute("data-position-command-action", "created");
  await expect(selector).toHaveValue("inspect");
  await expect(selector.locator("option[value='inspect']")).toContainText("Inspect · 90.0°");
  await expect(joint).toHaveAttribute("data-kinematics-evidence", "1");

  await continuous.fill("360");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "6.283");
  await name.fill("Load");
  await joint.getByRole("button", { name: "SAVE POSITION", exact: true }).click();
  await expect(joint).toHaveAttribute("data-named-position-count", "2");
  await expect(selector).toHaveValue("load");
  await expect(selector.locator("option[value='load']")).toContainText("Load · 360.0°");
  await expect(joint).toHaveAttribute("data-position-command-id", "mechanical-position-cmd-2");
  await expect(joint).toHaveAttribute("data-kinematics-evidence", "2");

  await continuous.fill("0");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "0.000");
  await joint.getByLabel("Rotary joint minimum travel degrees").fill("-180");
  await joint.getByLabel("Rotary joint maximum travel degrees").fill("180");
  await joint.getByRole("button", { name: "SET LIMITS", exact: true }).click();
  await joint.getByRole("button", { name: "GO POSITION", exact: true }).click();
  await expect(page.getByTestId("invention-3d-feedback")).toContainText("travel limit exceeded");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "0.000");
  await expect(joint).toHaveAttribute("data-position-command-id", "mechanical-position-cmd-2");
  await expect(joint).toHaveAttribute("data-kinematics-evidence", "3");

  await joint.getByRole("button", { name: "CLEAR LIMITS", exact: true }).click();
  await joint.getByRole("button", { name: "GO POSITION", exact: true }).click();
  await expect(joint).toHaveAttribute("data-command-mode", "continuous-absolute");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "6.283");
  await expect(joint).toHaveAttribute("data-revolutions", "1");
  await expect(joint).toHaveAttribute("data-kinematics-evidence", "4");

  await selector.selectOption("inspect");
  await joint.getByRole("button", { name: "GO POSITION", exact: true }).click();
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "1.571");
  await expect(joint).toHaveAttribute("data-kinematics-evidence", "5");
  await expect(joint).toContainText("POSIÇÕES 2");

  await workbench.getByRole("button", { name: "Guardar 3D" }).click();
  await workbench.getByRole("button", { name: "Fechar 3D Invention Workbench", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();
  const restored = page.getByTestId(`rotary-joint-${relationshipId}`);
  const restoredSelector = restored.getByLabel("Rotary named position", { exact: true });
  await expect(restored).toHaveAttribute("data-named-position-count", "2", { timeout: 20_000 });
  await expect(restored).toHaveAttribute("data-continuous-angle-rad", "1.571");
  await expect(restored).toHaveAttribute("data-kinematics-evidence", "5");
  await expect(restoredSelector.locator("option[value='inspect']")).toContainText("Inspect · 90.0°");
  await expect(restoredSelector.locator("option[value='load']")).toContainText("Load · 360.0°");

  await restoredSelector.selectOption("inspect");
  await restored.getByRole("button", { name: "DELETE POSITION", exact: true }).click();
  await expect(restored).toHaveAttribute("data-named-position-count", "1");
  await expect(restored).toHaveAttribute("data-position-command-id", "mechanical-position-cmd-6");
  await expect(restored).toHaveAttribute("data-position-command-action", "deleted");
  await expect(restoredSelector.locator("option[value='inspect']")).toHaveCount(0);
  await expect(restoredSelector.locator("option[value='load']")).toHaveCount(1);
  await expect(restored).toHaveAttribute("data-continuous-angle-rad", "1.571");
  await expect(restored).toHaveAttribute("data-kinematics-evidence", "5");

  expect(errors).toEqual([]);
});
