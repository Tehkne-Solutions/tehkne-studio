import { expect, test } from "@playwright/test";

function parseAxis(value: string | null): number[] {
  return String(value ?? "").split(",").map(Number);
}

function maxAxisDelta(left: number[], right: number[]): number {
  return Math.max(...left.map((value, index) => Math.abs(value - (right[index] ?? Number.NaN))));
}

test("S2.18 atomically aligns a misoriented wheel hub to the real AF-001 rotary shaft and preserves the joint through rigid rotation", async ({ page }) => {
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
  await workspace.getByRole("button", { name: /Drive Wheel/ }).click();
  await expect(selected).toHaveAttribute("data-ry", "0.000");
  await workspace.getByRole("button", { name: "RY +", exact: true }).click();
  await expect(selected).toHaveAttribute("data-ry", "0.262");

  await workspace.getByLabel("Origem 3D").selectOption({ label: "Brushed DC Motor · shaft-out" });
  await workspace.getByLabel("Destino 3D").selectOption({ label: "Drive Wheel · hub-in" });
  await workspace.getByRole("button", { name: "Conectar no 3D" }).click();

  const constraint = page.getByTestId("mechanical-constraint-invention-connection-1");
  const wire = page.getByTestId("invention-3d-wire-invention-connection-1");
  await expect(constraint).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });
  await expect(constraint).toHaveAttribute("data-axial-state", "aligned");
  await expect(constraint).toHaveAttribute("data-derived-from", "engineering-graph");
  await expect(constraint).toHaveAttribute("data-driver-port", "shaft-out");
  await expect(constraint).toHaveAttribute("data-follower-port", "hub-in");
  await expect(status).toHaveAttribute("data-mechanical-assemblies", "1");
  await expect(status).toHaveAttribute("data-mechanical-axial-joints", "1");
  await expect(status).toHaveAttribute("data-rigid-assembly-rotation", "enabled");
  await expect(wire).toHaveAttribute("data-source-socket", "SOCKET_MECH_AXIS_OUT");
  await expect(wire).toHaveAttribute("data-target-socket", "PROXY_HUB_CENTER");

  await workspace.getByRole("button", { name: /Drive Wheel/ }).click();
  await expect.poll(async () => Math.abs(Number(await selected.getAttribute("data-ry")))).toBeLessThan(0.001);
  await expect.poll(async () => {
    const driver = parseAxis(await constraint.getAttribute("data-driver-axis"));
    const follower = parseAxis(await constraint.getAttribute("data-follower-axis"));
    return maxAxisDelta(driver, follower);
  }).toBeLessThanOrEqual(0.0001);
  await expect.poll(async () => {
    const driver = [Number(await constraint.getAttribute("data-driver-x")), Number(await constraint.getAttribute("data-driver-y")), Number(await constraint.getAttribute("data-driver-z"))];
    const follower = [Number(await constraint.getAttribute("data-follower-x")), Number(await constraint.getAttribute("data-follower-y")), Number(await constraint.getAttribute("data-follower-z"))];
    return maxAxisDelta(driver, follower);
  }).toBeLessThanOrEqual(0.001);

  await workspace.getByRole("button", { name: /Brushed DC Motor/ }).click();
  await workspace.getByRole("button", { name: "RY +", exact: true }).click();
  await expect(selected).toHaveAttribute("data-ry", "0.262");
  await expect(constraint).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });
  await expect(constraint).toHaveAttribute("data-axial-state", "aligned");
  await expect.poll(async () => {
    const driver = parseAxis(await constraint.getAttribute("data-driver-axis"));
    const follower = parseAxis(await constraint.getAttribute("data-follower-axis"));
    return maxAxisDelta(driver, follower);
  }).toBeLessThanOrEqual(0.0001);
  await expect.poll(async () => parseAxis(await constraint.getAttribute("data-driver-axis"))[0] ?? 0).toBeCloseTo(Math.sin(Math.PI / 12), 3);

  await workspace.getByRole("button", { name: /Drive Wheel/ }).click();
  await expect(selected).toHaveAttribute("data-ry", "0.262");

  await workspace.getByRole("button", { name: "Guardar 3D" }).click();
  await workspace.getByRole("button", { name: "Fechar 3D Invention Workbench", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();
  await workspace.getByRole("button", { name: /Drive Wheel/ }).click();
  await expect(selected).toHaveAttribute("data-ry", "0.262");
  const restoredConstraint = page.getByTestId("mechanical-constraint-invention-connection-1");
  await expect(restoredConstraint).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });
  await expect(restoredConstraint).toHaveAttribute("data-axial-state", "aligned");
  await expect(status).toHaveAttribute("data-mechanical-axial-joints", "1");

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
