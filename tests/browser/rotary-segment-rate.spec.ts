import { expect, test } from "@playwright/test";

test("S2.25 derives segment-average rotary rate only from explicit command duration and restores evidence", async ({ page }) => {
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

  const joint = page.getByTestId("rotary-joint-invention-connection-1");
  await expect(page.getByTestId("mechanical-constraint-invention-connection-1")).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });
  await expect(joint).toHaveAttribute("data-rate-mode", "unresolved-no-duration");
  await expect(joint).toHaveAttribute("data-rate-source", "session-events-explicit-duration");
  await expect(joint).toHaveAttribute("data-rpm", "");
  await expect(joint.getByLabel("Rotary segment rate evidence")).toContainText("RATE UNRESOLVED");

  const duration = joint.getByLabel("Rotary command duration seconds");
  await duration.fill("0.5");
  await joint.getByRole("button", { name: "JOINT +", exact: true }).click();
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-1");
  await expect(joint).toHaveAttribute("data-rate-command-id", "mechanical-cmd-1");
  await expect(joint).toHaveAttribute("data-rate-mode", "segment-average");
  await expect(joint).toHaveAttribute("data-duration-seconds", "0.500");
  await expect(joint).toHaveAttribute("data-angular-velocity-rad-s", "0.524");
  await expect(joint).toHaveAttribute("data-rpm", "5.000");
  await expect(joint.getByLabel("Rotary segment rate evidence")).toContainText("5.00 RPM");

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

  await workbench.getByRole("button", { name: "Guardar 3D" }).click();
  await workbench.getByRole("button", { name: "Fechar 3D Invention Workbench", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();
  const restored = page.getByTestId("rotary-joint-invention-connection-1");
  await expect(restored).toHaveAttribute("data-rate-command-id", "mechanical-cmd-2", { timeout: 20_000 });
  await expect(restored).toHaveAttribute("data-rate-mode", "segment-average");
  await expect(restored).toHaveAttribute("data-duration-seconds", "2.000");
  await expect(restored).toHaveAttribute("data-rpm", "5.000");

  await restored.getByRole("button", { name: "JOINT +", exact: true }).click();
  await expect(restored).toHaveAttribute("data-command-id", "mechanical-cmd-3");
  await expect(restored).toHaveAttribute("data-rate-command-id", "mechanical-cmd-3");
  await expect(restored).toHaveAttribute("data-rate-mode", "unresolved-no-duration");
  await expect(restored).toHaveAttribute("data-duration-seconds", "");
  await expect(restored).toHaveAttribute("data-rpm", "");
  await expect(restored.getByLabel("Rotary segment rate evidence")).toContainText("RATE UNRESOLVED");

  expect(errors).toEqual([]);
});
