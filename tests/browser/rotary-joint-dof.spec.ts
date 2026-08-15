import { expect, test } from "@playwright/test";

function maxEndpointDelta(values: number[][]): number {
  const [left, right] = values;
  if (!left || !right) return Number.POSITIVE_INFINITY;
  return Math.max(...left.map((value, index) => Math.abs(value - (right[index] ?? Number.NaN))));
}

test("S2.19 rotates only the rotary follower around the shared shaft DOF and preserves snap, axial alignment, rigid motion and persistence", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();

  const workspace = page.getByRole("region", { name: "3D Invention Workbench" });
  const definition = workspace.getByLabel("Definição 3D");
  const add = workspace.getByRole("button", { name: "Adicionar ao 3D" });
  const selected = page.getByTestId("invention-3d-selected");
  const status = page.getByTestId("invention-3d-status");

  const motorResponse = page.waitForResponse((response) => response.url().includes("/api/asset-forge/af001/motor/lod0") && response.status() === 200);
  await definition.selectOption("actuation.motor.dc-brushed-v1");
  await add.click();
  const response = await motorResponse;
  expect(response.headers()["x-tehkne-asset-version"]).toBe("0.6.6-hero-candidate");
  await definition.selectOption("mechanical.wheel.drive-v1");
  await add.click();

  await workspace.getByLabel("Origem 3D").selectOption({ label: "Brushed DC Motor · shaft-out" });
  await workspace.getByLabel("Destino 3D").selectOption({ label: "Drive Wheel · hub-in" });
  await workspace.getByRole("button", { name: "Conectar no 3D" }).click();

  const constraint = page.getByTestId("mechanical-constraint-invention-connection-1");
  const joint = page.getByTestId("rotary-joint-invention-connection-1");
  await expect(constraint).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });
  await expect(constraint).toHaveAttribute("data-axial-state", "aligned");
  await expect(constraint).toHaveAttribute("data-rotary-dof", "enabled");
  await expect(joint).toHaveAttribute("data-dof", "rotary-follower");
  await expect(joint).toHaveAttribute("data-state", "ready");
  await expect(status).toHaveAttribute("data-mechanical-axial-joints", "1");
  await expect(status).toHaveAttribute("data-rotary-joint-dof", "1");

  await workspace.getByRole("button", { name: /Brushed DC Motor/ }).click();
  const motorBefore = {
    x: await selected.getAttribute("data-x"), y: await selected.getAttribute("data-y"), z: await selected.getAttribute("data-z"),
    rx: await selected.getAttribute("data-rx"), ry: await selected.getAttribute("data-ry"), rz: await selected.getAttribute("data-rz")
  };
  expect(motorBefore.rx).toBe("0.000"); expect(motorBefore.ry).toBe("0.000"); expect(motorBefore.rz).toBe("0.000");

  await workspace.getByRole("button", { name: /Drive Wheel/ }).click();
  await expect(selected).toHaveAttribute("data-rx", "0.000");
  await expect(selected).toHaveAttribute("data-ry", "0.000");
  await expect(selected).toHaveAttribute("data-rz", "0.000");
  const endpointBefore = [
    Number(await constraint.getAttribute("data-driver-x")),
    Number(await constraint.getAttribute("data-driver-y")),
    Number(await constraint.getAttribute("data-driver-z"))
  ];

  await joint.getByRole("button", { name: "JOINT +", exact: true }).click();
  await expect(page.getByTestId("invention-3d-feedback")).toContainText("Joint Rotate 3D");
  await expect(selected).toHaveAttribute("data-rx", "0.000");
  await expect(selected).toHaveAttribute("data-ry", "0.000");
  await expect(selected).toHaveAttribute("data-rz", "0.262");
  await expect(constraint).toHaveAttribute("data-state", "snapped");
  await expect(constraint).toHaveAttribute("data-axial-state", "aligned");
  await expect(joint).toHaveAttribute("data-state", "ready");
  await expect.poll(async () => maxEndpointDelta([
    [Number(await constraint.getAttribute("data-driver-x")), Number(await constraint.getAttribute("data-driver-y")), Number(await constraint.getAttribute("data-driver-z"))],
    [Number(await constraint.getAttribute("data-follower-x")), Number(await constraint.getAttribute("data-follower-y")), Number(await constraint.getAttribute("data-follower-z"))]
  ])).toBeLessThanOrEqual(0.001);
  await expect.poll(async () => Math.max(...[
    Number(await constraint.getAttribute("data-driver-x")), Number(await constraint.getAttribute("data-driver-y")), Number(await constraint.getAttribute("data-driver-z"))
  ].map((value, index) => Math.abs(value - endpointBefore[index]!)))).toBeLessThanOrEqual(0.001);

  await workspace.getByRole("button", { name: /Brushed DC Motor/ }).click();
  await expect(selected).toHaveAttribute("data-x", motorBefore.x ?? "");
  await expect(selected).toHaveAttribute("data-y", motorBefore.y ?? "");
  await expect(selected).toHaveAttribute("data-z", motorBefore.z ?? "");
  await expect(selected).toHaveAttribute("data-rx", motorBefore.rx ?? "");
  await expect(selected).toHaveAttribute("data-ry", motorBefore.ry ?? "");
  await expect(selected).toHaveAttribute("data-rz", motorBefore.rz ?? "");

  await workspace.getByRole("button", { name: "RY +", exact: true }).click();
  await expect(selected).toHaveAttribute("data-ry", "0.262");
  await expect(selected).toHaveAttribute("data-rz", "0.000");
  await expect(constraint).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });
  await expect(constraint).toHaveAttribute("data-axial-state", "aligned");

  await workspace.getByRole("button", { name: /Drive Wheel/ }).click();
  await expect(selected).toHaveAttribute("data-ry", "0.262");
  await expect(selected).toHaveAttribute("data-rz", "0.262");
  const persistedRotation = {
    rx: await selected.getAttribute("data-rx"),
    ry: await selected.getAttribute("data-ry"),
    rz: await selected.getAttribute("data-rz")
  };

  await workspace.getByRole("button", { name: "Guardar 3D" }).click();
  await workspace.getByRole("button", { name: "Fechar 3D Invention Workbench", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();
  await workspace.getByRole("button", { name: /Drive Wheel/ }).click();
  await expect(selected).toHaveAttribute("data-rx", persistedRotation.rx ?? "");
  await expect(selected).toHaveAttribute("data-ry", persistedRotation.ry ?? "");
  await expect(selected).toHaveAttribute("data-rz", persistedRotation.rz ?? "");
  const restoredConstraint = page.getByTestId("mechanical-constraint-invention-connection-1");
  const restoredJoint = page.getByTestId("rotary-joint-invention-connection-1");
  await expect(restoredConstraint).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });
  await expect(restoredConstraint).toHaveAttribute("data-axial-state", "aligned");
  await expect(restoredJoint).toHaveAttribute("data-state", "ready");

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
