import { expect, test } from "@playwright/test";

test("S2.33 attests the consumed plan against S2.32 execution evidence and preserves history after bookmark edits", async ({ page }) => {
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

  await expect(sequence).toHaveAttribute("data-sequence-attestation-status", "");
  await sequence.getByRole("button", { name: "RUN SEQUENCE", exact: true }).click();
  await expect(sequence).toHaveAttribute("data-sequence-run-steps", "2");
  await expect(sequence).toHaveAttribute("data-sequence-final-movement-id", "mechanical-cmd-5");
  await expect(sequence).toHaveAttribute("data-sequence-attestation-status", "verified");
  await expect(sequence).toHaveAttribute("data-sequence-attestation-command-id", "mechanical-sequence-attestation-cmd-1");
  await expect(sequence).toHaveAttribute("data-sequence-attestation-run-id", "mechanical-sequence-cmd-2");
  await expect(sequence).toHaveAttribute("data-sequence-attestation-derived-from", "consumed-plan+s2.32-execution-evidence");
  await expect(sequence).toHaveAttribute("data-sequence-attestation-plan-delta-rad", "6.283");
  await expect(sequence).toHaveAttribute("data-sequence-attestation-actual-delta-rad", "6.283");
  await expect(sequence).toHaveAttribute("data-sequence-attestation-match", "true");
  const summary = sequence.getByLabel("Rotary waypoint plan execution attestation summary", { exact: true });
  await expect(summary).toContainText("ATTESTED");
  await expect(summary).toContainText("S2.32 actual");
  const segments = sequence.getByLabel("Rotary waypoint plan execution attestation segments", { exact: true });
  await expect(segments).toContainText("Inspect");
  await expect(segments).toContainText("mechanical-cmd-4");
  await expect(segments).toContainText("90.0°");
  await expect(segments).toContainText("Load");
  await expect(segments).toContainText("mechanical-cmd-5");
  await expect(segments).toContainText("MATCH");

  // Live planning changes; historical plan-to-execution attestation does not.
  await continuous.fill("120");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await positionName.fill("Inspect");
  await joint.getByRole("button", { name: "SAVE POSITION", exact: true }).click();
  await continuous.fill("0");
  await joint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await sequence.getByRole("button", { name: "PREVIEW SEQUENCE", exact: true }).click();
  await expect(sequence.getByLabel("Rotary waypoint sequence plan segments", { exact: true })).toContainText("120.0°");
  await expect(segments).toContainText("90.0°");
  await expect(sequence).toHaveAttribute("data-sequence-attestation-command-id", "mechanical-sequence-attestation-cmd-1");

  await workbench.getByRole("button", { name: "Guardar 3D" }).click();
  await workbench.getByRole("button", { name: "Fechar 3D Invention Workbench", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();
  const restoredSequence = page.getByTestId(`rotary-waypoint-sequence-${relationshipId}`);
  await expect(restoredSequence).toHaveAttribute("data-waypoint-sequence-count", "1", { timeout: 20_000 });
  await restoredSequence.getByLabel("Rotary waypoint sequence", { exact: true }).selectOption("inspection cycle");
  await expect(restoredSequence).toHaveAttribute("data-sequence-attestation-status", "verified");
  await expect(restoredSequence).toHaveAttribute("data-sequence-attestation-command-id", "mechanical-sequence-attestation-cmd-1");
  await expect(restoredSequence).toHaveAttribute("data-sequence-attestation-run-id", "mechanical-sequence-cmd-2");
  await expect(restoredSequence.getByLabel("Rotary waypoint plan execution attestation segments", { exact: true })).toContainText("90.0°");

  expect(errors).toEqual([]);
});
