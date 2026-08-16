import { expect, test } from "@playwright/test";

test("S2.30 authors persists and runs ordered Named Position waypoints with travel preflight", async ({ page }) => {
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
  await expect(joint).toHaveAttribute("data-named-position-count", "2");

  const sequence = page.getByTestId(`rotary-waypoint-sequence-${relationshipId}`);
  await expect(sequence).toHaveAttribute("data-waypoint-sequence-count", "0");
  await sequence.getByLabel("Rotary waypoint sequence name", { exact: true }).fill("Inspection Cycle");
  const waypoint = sequence.getByLabel("Rotary waypoint position", { exact: true });
  const waypointDuration = sequence.getByLabel("Rotary waypoint duration seconds", { exact: true });
  await waypoint.selectOption("inspect");
  await waypointDuration.fill("3");
  await sequence.getByRole("button", { name: "ADD WAYPOINT", exact: true }).click();
  await waypoint.selectOption("load");
  await waypointDuration.fill("9");
  await sequence.getByRole("button", { name: "ADD WAYPOINT", exact: true }).click();
  await expect(sequence).toHaveAttribute("data-waypoint-draft-count", "2");
  await expect(sequence.getByLabel("Rotary waypoint draft", { exact: true })).toContainText("Inspect · 3.000 s");
  await expect(sequence.getByLabel("Rotary waypoint draft", { exact: true })).toContainText("Load · 9.000 s");
  await sequence.getByRole("button", { name: "SAVE SEQUENCE", exact: true }).click();
  await expect(sequence).toHaveAttribute("data-waypoint-sequence-count", "1");
  await expect(sequence.getByLabel("Rotary waypoint sequence", { exact: true })).toHaveValue("inspection cycle");

  await sequence.getByRole("button", { name: "RUN SEQUENCE", exact: true }).click();
  await expect(sequence).toHaveAttribute("data-sequence-run-steps", "2");
  await expect(sequence).toHaveAttribute("data-sequence-final-movement-id", "mechanical-cmd-5");
  await expect(sequence).toHaveAttribute("data-sequence-final-rate-mode", "segment-average");
  await expect(joint).toHaveAttribute("data-continuous-angle-rad", "6.283");
  await expect(joint).toHaveAttribute("data-rate-command-id", "mechanical-cmd-5");
  await expect(joint).toHaveAttribute("data-duration-seconds", "9.000");
  await expect(joint).toHaveAttribute("data-rpm", "5.000");

  await workbench.getByRole("button", { name: "Guardar 3D" }).click();
  await workbench.getByRole("button", { name: "Fechar 3D Invention Workbench", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();
  const restoredJoint = page.getByTestId(`rotary-joint-${relationshipId}`);
  const restoredSequence = page.getByTestId(`rotary-waypoint-sequence-${relationshipId}`);
  await expect(restoredSequence).toHaveAttribute("data-waypoint-sequence-count", "1", { timeout: 20_000 });
  await restoredSequence.getByLabel("Rotary waypoint sequence", { exact: true }).selectOption("inspection cycle");

  const restoredContinuous = restoredJoint.getByLabel("Rotary joint continuous target degrees");
  await restoredContinuous.fill("0");
  await restoredJoint.getByRole("button", { name: "SET CONTINUOUS", exact: true }).click();
  await restoredJoint.getByLabel("Rotary joint minimum travel degrees").fill("-90");
  await restoredJoint.getByLabel("Rotary joint maximum travel degrees").fill("180");
  await restoredJoint.getByRole("button", { name: "SET LIMITS", exact: true }).click();
  const movementBeforeBlocked = await restoredJoint.getAttribute("data-command-id");
  const rateBeforeBlocked = await restoredJoint.getAttribute("data-rate-command-id");
  await restoredSequence.getByRole("button", { name: "RUN SEQUENCE", exact: true }).click();
  await expect(page.getByTestId("invention-3d-feedback")).toContainText("waypoint sequence travel limit exceeded");
  await expect(restoredJoint).toHaveAttribute("data-continuous-angle-rad", "0.000");
  await expect(restoredJoint).toHaveAttribute("data-command-id", movementBeforeBlocked ?? "");
  await expect(restoredJoint).toHaveAttribute("data-rate-command-id", rateBeforeBlocked ?? "");

  await restoredSequence.getByRole("button", { name: "DELETE SEQUENCE", exact: true }).click();
  await expect(restoredSequence).toHaveAttribute("data-waypoint-sequence-count", "0");

  expect(errors).toEqual([]);
});