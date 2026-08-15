import { expect, test } from "@playwright/test";

test("S2.15 snaps a proxy wheel to the real AF-001 shaft socket and moves the connected assembly as one", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("invention-3d-trigger").click();

  const workspace = page.getByRole("region", { name: "3D Invention Workbench" });
  const definition = workspace.getByLabel("Definição 3D");
  const add = workspace.getByRole("button", { name: "Adicionar ao 3D" });
  const status = page.getByTestId("invention-3d-status");

  const motorResponse = page.waitForResponse((response) =>
    response.url().includes("/api/asset-forge/af001/motor/lod0") && response.status() === 200
  );
  await definition.selectOption("actuation.motor.dc-brushed-v1");
  await add.click();
  await motorResponse;

  await definition.selectOption("mechanical.wheel.drive-v1");
  await add.click();
  await workspace.getByRole("button", { name: /Drive Wheel/ }).click();
  const visual = page.getByTestId("invention-3d-visual-source");
  await expect(visual).toHaveAttribute("data-source", "proxy");
  await expect(visual).toHaveAttribute("data-proxy-kind", "wheel");
  await expect(visual).toHaveAttribute("data-anchor-count", "1");
  await expect(visual).toHaveAttribute("data-anchors", "PROXY_HUB_CENTER");

  await workspace.getByLabel("Origem 3D").selectOption({ label: "Brushed DC Motor · shaft-out" });
  await workspace.getByLabel("Destino 3D").selectOption({ label: "Drive Wheel · hub-in" });
  await workspace.getByRole("button", { name: "Conectar / Montar" }).click();

  const constraint = page.getByTestId("mechanical-constraint-invention-connection-1");
  await expect(constraint).toHaveAttribute("data-driver-port", "shaft-out");
  await expect(constraint).toHaveAttribute("data-follower-port", "hub-in");
  await expect(constraint).toHaveAttribute("data-driver-endpoint", "SOCKET_MECH_AXIS_OUT", { timeout: 20_000 });
  await expect(constraint).toHaveAttribute("data-driver-endpoint-source", "asset-socket");
  await expect(constraint).toHaveAttribute("data-follower-endpoint", "PROXY_HUB_CENTER");
  await expect(constraint).toHaveAttribute("data-follower-endpoint-source", "proxy-anchor");
  await expect(constraint).toHaveAttribute("data-state", "snapped", { timeout: 20_000 });
  await expect(status).toHaveAttribute("data-mechanical-assemblies", "1");

  const wire = page.getByTestId("invention-3d-wire-invention-connection-1");
  await expect(wire).toHaveAttribute("data-mechanical", "true");
  await expect(wire).toHaveAttribute("data-source-socket", "SOCKET_MECH_AXIS_OUT");
  await expect(wire).toHaveAttribute("data-target-socket", "PROXY_HUB_CENTER");
  await expect(wire).toHaveAttribute("data-source-endpoint-source", "asset-socket");
  await expect(wire).toHaveAttribute("data-target-endpoint-source", "proxy-anchor");

  await expect.poll(async () => {
    const driver = [
      Number(await constraint.getAttribute("data-driver-x")),
      Number(await constraint.getAttribute("data-driver-y")),
      Number(await constraint.getAttribute("data-driver-z"))
    ];
    const follower = [
      Number(await constraint.getAttribute("data-follower-x")),
      Number(await constraint.getAttribute("data-follower-y")),
      Number(await constraint.getAttribute("data-follower-z"))
    ];
    return Math.max(...driver.map((value, index) => Math.abs(value - follower[index]!)));
  }).toBeLessThanOrEqual(0.001);

  await workspace.getByRole("button", { name: /Brushed DC Motor/ }).click();
  const selected = page.getByTestId("invention-3d-selected");
  const motorZBefore = Number(await selected.getAttribute("data-z"));
  const endpointZBefore = Number(await constraint.getAttribute("data-driver-z"));

  await workspace.getByRole("button", { name: /Drive Wheel/ }).click();
  const wheelZBefore = Number(await selected.getAttribute("data-z"));
  await workspace.getByRole("button", { name: "Z +" }).click();
  await expect(selected).toHaveAttribute("data-z", (wheelZBefore + 0.05).toFixed(3));

  await workspace.getByRole("button", { name: /Brushed DC Motor/ }).click();
  await expect(selected).toHaveAttribute("data-z", (motorZBefore + 0.05).toFixed(3));
  await expect.poll(async () => Number(await constraint.getAttribute("data-driver-z"))).toBeCloseTo(endpointZBefore + 0.05, 3);
  await expect(constraint).toHaveAttribute("data-state", "snapped");

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
