import { expect, test } from "@playwright/test";

test("S2.32 persists a verified plan-versus-execution receipt that survives later Named Position edits", async ({ page }) => {
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

  const sequence = page.getByTestId(`rotary-waypoint-sequence-${relationshipId}`);
  await sequence.getByLabel("Rotary waypoint sequence name", { exact: true }).fill("Inspection Cycle");
  const waypoint = sequence.getByLabel("Rotary waypoint position", { exact: true });
  const duration = sequence.getByLabel("Rotary waypoint duration seconds", { exact: true });
  await waypoint.selectOption("inspect"); await duration.fill("3");
  await sequence.getByRole("button", { name: "ADD WAYPOINT", exact: true }).click();
  await waypoint.selectOption("load"); await duration.fill("9");
  await sequence.getByRole("button", { name: "ADD WAYPOINT", exact: true }).click();
  await sequence.getByRole("button", { name: "SAVE SEQUENCE", exact: true }).click();

  await expect(sequence).toHaveAttribute("data-sequence-receipt-status", "");
  await sequence.getByRole("button", { name: "RUN SEQUENCE", exact: true }).click();
  await expect(sequence).toHaveAttribute("data-sequence-receipt-status", "verified");
  await expect(sequence).toHaveAttribute("data-sequence-receipt-command-id", "mechanical-sequence-receipt-cmd-1");
  await expect(sequence).toHaveAttribute("data-sequence-receipt-run-id", "mechanical-sequence-cmd-2");
  await expect(sequence).toHaveAttribute("data-sequence-receipt-steps", "2");
  await expect(sequence).toHaveAttribute("data-sequence-receipt-derived-from", "consumed-plan+movement-events");
  await expect(sequence).toHaveAttribute("data-sequence-receipt-duration-mode", "complete-explicit");
  await expect(sequence).toHaveAttribute("data-sequence-receipt-plan-delta-rad", "6.283");
  await expect(sequence).toHaveAttribute("data-sequence-receipt-actual-delta-rad", "6.283");
  await expect(sequence).toHaveAttribute("data-sequence-receipt-plan-travel-rad", "6.283");
  await expect(sequence).toHaveAttribute("data-sequence-receipt-actual-travel-rad", "6.283");
  await expect(sequence).toHaveAttribute("data-sequence-receipt-match", "true");
  await expect(sequence.getByLabel("Rotary waypoint execution receipt summary", { exact: true })).toContainText("EXECUTION VERIFIED");
  const receiptSegments = sequence.getByLabel("Rotary waypoint execution receipt segments", { exact: true });
  await expect(receiptSegments).toContainText("Inspect");
  await expect(receiptSegments).toContainText("mechanical-cmd-4");
  await expect(receiptSegments).toContainText("90.0°");
  await expect(receiptSegments).toContainText("Load");
  await expect(receiptSegments).toContainText("mechanical-cmd-5");
  await expect(receiptSegments).toContainText("MATCH");

  // Re-author the live Inspect bookmark after execution. The new plan must move,
  // while the persisted receipt remains a historical snapshot of the consumed plan.
  await continuous.fill("120");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await positionName.fill("Inspect");
  await joint.getByRole("button", { name: "SAVE POSITION", exact: true }).click();
  await continuous.fill("0");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await sequence.getByRole("button", { name: "PREVIEW SEQUENCE", exact: true }).click();
  await expect(sequence.getByLabel("Rotary waypoint sequence plan segments", { exact: true })).toContainText("120.0°");
  await expect(receiptSegments).toContainText("90.0°");
  await expect(sequence).toHaveAttribute("data-sequence-receipt-command-id", "mechanical-sequence-receipt-cmd-1");

  await workbench.getByRole("button", { name: "Guardar 3D" }).click();
  await workbench.getByRole("button", { name: "Fechar 3D Invention Workbench", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();
  const restoredSequence = page.getByTestId(`rotary-waypoint-sequence-${relationshipId}`);
  await expect(restoredSequence).toHaveAttribute("data-waypoint-sequence-count", "1", { timeout: 20_000 });
  await restoredSequence.getByLabel("Rotary waypoint sequence", { exact: true }).selectOption("inspection cycle");
  await expect(restoredSequence).toHaveAttribute("data-sequence-receipt-status", "verified");
  await expect(restoredSequence).toHaveAttribute("data-sequence-receipt-command-id", "mechanical-sequence-receipt-cmd-1");
  await expect(restoredSequence).toHaveAttribute("data-sequence-receipt-run-id", "mechanical-sequence-cmd-2");
  await expect(restoredSequence.getByLabel("Rotary waypoint execution receipt segments", { exact: true })).toContainText("90.0°");

  expect(errors).toEqual([]);
});
