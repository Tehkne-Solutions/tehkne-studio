import { expect, test } from "@playwright/test";

test("S2.29 derives explicit segment-average rate when GO POSITION delegates to canonical continuous movement", async ({ page }) => {
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
  const duration = joint.getByLabel("Rotary joint command duration seconds");
  const name = joint.getByLabel("Rotary named position name");
  const selector = joint.getByLabel("Rotary named position", { exact: true });

  await continuous.fill("360");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await name.fill("Inspect");
  await joint.getByRole("button", { name: "SAVE POSITION", exact: true }).click();
  await expect(selector).toHaveValue("inspect");
  await expect(joint).toHaveAttribute("data-rate-mode", "unresolved-no-duration");

  await continuous.fill("180");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await duration.fill("6");
  await joint.getByRole("button", { name: "GO POSITION", exact: true }).click();
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-3");
  await expect(joint).toHaveAttribute("data-command-mode", "continuous-absolute");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "6.283");
  await expect(joint).toHaveAttribute("data-rate-command-id", "mechanical-cmd-3");
  await expect(joint).toHaveAttribute("data-rate-mode", "segment-average");
  await expect(joint).toHaveAttribute("data-duration-seconds", "6.000");
  await expect(joint).toHaveAttribute("data-angular-velocity-rad-s", "0.524");
  await expect(joint).toHaveAttribute("data-rpm", "5.000");
  await expect(joint).toContainText("5.00 RPM");

  await name.fill("Park");
  await joint.getByRole("button", { name: "SAVE POSITION", exact: true }).click();
  await expect(joint).toHaveAttribute("data-named-position-count", "2");
  await expect(joint).toHaveAttribute("data-rate-command-id", "mechanical-cmd-3");
  await expect(joint).toHaveAttribute("data-rpm", "5.000");
  await joint.getByRole("button", { name: "DELETE POSITION", exact: true }).click();
  await expect(joint).toHaveAttribute("data-named-position-count", "1");
  await expect(joint).toHaveAttribute("data-rate-command-id", "mechanical-cmd-3");

  await continuous.fill("180");
  await duration.fill("");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await expect(joint).toHaveAttribute("data-rate-mode", "unresolved-no-duration");
  await selector.selectOption("inspect");
  await joint.getByLabel("Rotary joint minimum travel degrees").fill("-90");
  await joint.getByLabel("Rotary joint maximum travel degrees").fill("270");
  await joint.getByRole("button", { name: "SET LIMITS", exact: true }).click();
  const commandBeforeBlocked = await joint.getAttribute("data-rate-command-id");
  await duration.fill("1");
  await joint.getByRole("button", { name: "GO POSITION", exact: true }).click();
  await expect(page.getByTestId("invention-3d-feedback")).toContainText("travel limit exceeded");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "3.142");
  await expect(joint).toHaveAttribute("data-rate-command-id", commandBeforeBlocked ?? "");
  await expect(joint).toHaveAttribute("data-rate-mode", "unresolved-no-duration");

  expect(errors).toEqual([]);
});
