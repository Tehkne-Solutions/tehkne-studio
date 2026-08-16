import { expect, test } from "@playwright/test";

test("S2.27 derives explicit segment-average rotary rate across step principal continuous targets limits and restore", async ({ page }) => {
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
  await expect(joint).toHaveAttribute("data-rate-mode", "unresolved-no-duration");
  await expect(joint).toHaveAttribute("data-rate-source", "session-events-explicit-duration");
  await expect(joint).toHaveAttribute("data-rpm", "");
  await expect(joint).toContainText("RATE UNRESOLVED");

  const duration = joint.getByLabel("Rotary joint command duration seconds");
  await duration.fill("0.5");
  await joint.getByRole("button", { name: "JOINT +", exact: true }).click();
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-1");
  await expect(joint).toHaveAttribute("data-rate-command-id", "mechanical-cmd-1");
  await expect(joint).toHaveAttribute("data-rate-mode", "segment-average");
  await expect(joint).toHaveAttribute("data-duration-seconds", "0.500");
  await expect(joint).toHaveAttribute("data-angular-velocity-rad-s", "0.524");
  await expect(joint).toHaveAttribute("data-rpm", "5.000");
  await expect(joint).toContainText("5.00 RPM");

  const target = joint.getByLabel("Rotary joint target angle degrees");
  await target.fill("75");
  await duration.fill("2");
  await joint.getByRole("button", { name: "SET ANGLE", exact: true }).click();
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-2");
  await expect(joint).toHaveAttribute("data-rate-command-id", "mechanical-cmd-2");
  await expect(joint).toHaveAttribute("data-angle-rad", "1.309");
  await expect(joint).toHaveAttribute("data-duration-seconds", "2.000");
  await expect(joint).toHaveAttribute("data-angular-velocity-rad-s", "0.524");
  await expect(joint).toHaveAttribute("data-rpm", "5.000");

  await joint.getByRole("button", { name: "SET LIMITS", exact: true }).click();
  await expect(joint).toHaveAttribute("data-limit-command-id", "mechanical-cmd-3");
  await expect(joint).toHaveAttribute("data-travel-limited", "true");
  await expect(joint).toHaveAttribute("data-rate-command-id", "mechanical-cmd-2");
  await expect(joint).toHaveAttribute("data-rpm", "5.000");

  const continuous = joint.getByLabel("Rotary joint continuous target degrees");
  await continuous.fill("435");
  await duration.fill("12");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-4");
  await expect(joint).toHaveAttribute("data-command-mode", "continuous-absolute");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "7.592");
  await expect(joint).toHaveAttribute("data-rate-command-id", "mechanical-cmd-4");
  await expect(joint).toHaveAttribute("data-duration-seconds", "12.000");
  await expect(joint).toHaveAttribute("data-angular-velocity-rad-s", "0.524");
  await expect(joint).toHaveAttribute("data-rpm", "5.000");

  await continuous.fill("720");
  await duration.fill("1");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "7.592");
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-4");
  await expect(joint).toHaveAttribute("data-rate-command-id", "mechanical-cmd-4");
  await expect(joint).toHaveAttribute("data-rpm", "5.000");

  await workbench.getByRole("button", { name: "Guardar 3D" }).click();
  await workbench.getByRole("button", { name: "Fechar 3D Invention Workbench", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();
  const restored = page.getByTestId(`rotary-joint-${relationshipId}`);
  await expect(restored).toHaveAttribute("data-rate-command-id", "mechanical-cmd-4", { timeout: 20_000 });
  await expect(restored).toHaveAttribute("data-rate-mode", "segment-average");
  await expect(restored).toHaveAttribute("data-duration-seconds", "12.000");
  await expect(restored).toHaveAttribute("data-rpm", "5.000");
  await expect(restored).toHaveAttribute("data-travel-limited", "true");

  await restored.getByRole("button", { name: "JOINT +", exact: true }).click();
  await expect(restored).toHaveAttribute("data-command-id", "mechanical-cmd-5");
  await expect(restored).toHaveAttribute("data-rate-command-id", "mechanical-cmd-5");
  await expect(restored).toHaveAttribute("data-rate-mode", "unresolved-no-duration");
  await expect(restored).toHaveAttribute("data-duration-seconds", "");
  await expect(restored).toHaveAttribute("data-rpm", "");
  await expect(restored).toContainText("RATE UNRESOLVED");

  expect(errors).toEqual([]);
});
