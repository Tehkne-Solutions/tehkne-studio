import { expect, test } from "@playwright/test";

test("S2.31 previews deterministic waypoint geometry rates and travel admissibility without movement", async ({ page }) => {
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
  const positionName = joint.getByLabel("Rotary named position name");

  await continuous.fill("90");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await positionName.fill("Inspect");
  await joint.getByRole("button", { name: "SAVE POSITION", exact: true }).click();
  await continuous.fill("360");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await positionName.fill("Load");
  await joint.getByRole("button", { name: "SAVE POSITION", exact: true }).click();
  await continuous.fill("0");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-3");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "0.000");

  const sequence = page.getByTestId(`rotary-waypoint-sequence-${relationshipId}`);
  await sequence.getByLabel("Rotary waypoint sequence name", { exact: true }).fill("Inspection Cycle");
  const waypoint = sequence.getByLabel("Rotary waypoint position", { exact: true });
  const duration = sequence.getByLabel("Rotary waypoint duration seconds", { exact: true });
  await waypoint.selectOption("inspect");
  await duration.fill("3");
  await sequence.getByRole("button", { name: "ADD WAYPOINT", exact: true }).click();
  await waypoint.selectOption("load");
  await duration.fill("9");
  await sequence.getByRole("button", { name: "ADD WAYPOINT", exact: true }).click();
  await sequence.getByRole("button", { name: "SAVE SEQUENCE", exact: true }).click();
  await expect(sequence).toHaveAttribute("data-sequence-command-id", "mechanical-sequence-cmd-1");

  await sequence.getByRole("button", { name: "PREVIEW SEQUENCE", exact: true }).click();
  await expect(sequence).toHaveAttribute("data-sequence-plan-status", "admissible");
  await expect(sequence).toHaveAttribute("data-sequence-plan-steps", "2");
  await expect(sequence).toHaveAttribute("data-sequence-plan-duration-mode", "complete-explicit");
  await expect(sequence).toHaveAttribute("data-sequence-plan-total-duration", "12.000");
  await expect(sequence).toHaveAttribute("data-sequence-plan-explicit-duration", "12.000");
  await expect(sequence).toHaveAttribute("data-sequence-plan-total-delta-rad", "6.283");
  await expect(sequence).toHaveAttribute("data-sequence-plan-absolute-travel-rad", "6.283");
  await expect(sequence).toHaveAttribute("data-sequence-plan-final-rad", "6.283");
  await expect(sequence).toHaveAttribute("data-sequence-plan-timed-steps", "2");
  await expect(sequence).toHaveAttribute("data-sequence-plan-untimed-steps", "0");
  await expect(sequence).toHaveAttribute("data-sequence-plan-mutation", "none");
  await expect(sequence.getByLabel("Rotary waypoint sequence plan summary", { exact: true })).toContainText("PLAN OK");
  await expect(sequence.getByLabel("Rotary waypoint sequence plan segments", { exact: true })).toContainText("Inspect");
  await expect(sequence.getByLabel("Rotary waypoint sequence plan segments", { exact: true })).toContainText("5.000 RPM");
  await expect(sequence.getByLabel("Rotary waypoint sequence plan segments", { exact: true })).toContainText("LIMIT OK");
  await expect(joint).toHaveAttribute("data-command-id", "mechanical-cmd-3", { timeout: 2_000 });
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "0.000");
  await expect(sequence).toHaveAttribute("data-sequence-command-id", "mechanical-sequence-cmd-1");

  await joint.getByLabel("Rotary joint minimum travel degrees").fill("-90");
  await joint.getByLabel("Rotary joint maximum travel degrees").fill("180");
  await joint.getByRole("button", { name: "SET LIMITS", exact: true }).click();
  await sequence.getByRole("button", { name: "PREVIEW SEQUENCE", exact: true }).click();
  await expect(sequence).toHaveAttribute("data-sequence-plan-status", "blocked");
  await expect(sequence.getByLabel("Rotary waypoint sequence plan summary", { exact: true })).toContainText("PLAN BLOCKED");
  await expect(sequence.getByLabel("Rotary waypoint sequence plan segments", { exact: true })).toContainText("LIMIT BLOCKED");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "0.000");

  await sequence.getByRole("button", { name: "RUN SEQUENCE", exact: true }).click();
  await expect(page.getByTestId("invention-3d-feedback")).toContainText("waypoint sequence travel limit exceeded");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "0.000");
  await expect(sequence).toHaveAttribute("data-sequence-command-id", "mechanical-sequence-cmd-1");

  await joint.getByRole("button", { name: "CLEAR LIMITS", exact: true }).click();
  await sequence.getByRole("button", { name: "PREVIEW SEQUENCE", exact: true }).click();
  await expect(sequence).toHaveAttribute("data-sequence-plan-status", "admissible");
  await sequence.getByRole("button", { name: "RUN SEQUENCE", exact: true }).click();
  await expect(sequence).toHaveAttribute("data-sequence-run-steps", "2");
  await expect(sequence).toHaveAttribute("data-sequence-final-movement-id", "mechanical-cmd-7");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "6.283");
  await expect(sequence).toHaveAttribute("data-sequence-plan-status", "");

  expect(errors).toEqual([]);
});
