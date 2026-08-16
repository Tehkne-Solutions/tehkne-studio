import { expect, test } from "@playwright/test";

test("S2.23 routes rotary UI through the session CommandBus and resumes command IDs after restore", async ({ page }) => {
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

  await definition.selectOption("actuation.motor.dc-brushed-v1");
  await add.click();
  await definition.selectOption("mechanical.wheel.drive-v1");
  await add.click();
  await workbench.getByLabel("Origem 3D").selectOption({ label: "Brushed DC Motor · shaft-out" });
  await workbench.getByLabel("Destino 3D").selectOption({ label: "Drive Wheel · hub-in" });
  await workbench.getByRole("button", { name: "Conectar no 3D" }).click();

  const joint = page.getByTestId("rotary-joint-invention-connection-1");
  const constraint = page.getByTestId("mechanical-constraint-invention-connection-1");
  await expect(constraint).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });
  await expect(joint).toHaveAttribute("data-command-bus", "session");

  await joint.getByLabel("Rotary joint target angle degrees").fill("90");
  await joint.getByRole("button", { name: "SET ANGLE", exact: true }).click();
  await expect(joint).toHaveAttribute("data-angle-rad", "1.571");
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-1");
  await expect(joint).toHaveAttribute("data-command-source", "ui");
  await expect(joint).toHaveAttribute("data-command-mode", "principal-shortest");

  await joint.getByRole("button", { name: "JOINT +", exact: true }).click();
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-2");
  await expect(joint).toHaveAttribute("data-command-mode", "incremental");

  await workbench.getByRole("button", { name: "Guardar 3D" }).click();
  await workbench.getByRole("button", { name: "Fechar 3D Invention Workbench", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();

  const restored = page.getByTestId("rotary-joint-invention-connection-1");
  await restored.getByLabel("Rotary joint target angle degrees").fill("0");
  await restored.getByRole("button", { name: "SET ANGLE", exact: true }).click();
  await expect(restored).toHaveAttribute("data-angle-rad", "0.000");
  await expect(restored).toHaveAttribute("data-command-id", "mechanical-cmd-3");
  await expect(restored).toHaveAttribute("data-command-source", "ui");
  await expect(page.getByTestId("mechanical-constraint-invention-connection-1")).toHaveAttribute("data-state", "snapped");

  expect(errors).toEqual([]);
});
