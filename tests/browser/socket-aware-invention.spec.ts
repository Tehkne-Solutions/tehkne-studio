import { expect, test } from "@playwright/test";

test("S2.14 attaches invention wiring to real Asset Forge socket nodes and follows spatial movement", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Abrir Electronics Workbench" }).click();
  await expect(page.getByLabel("Tehkné Electronics Workbench")).toBeVisible();
  await page.getByRole("button", { name: "Voltar ao First Workbench" }).click();
  await expect(page.getByRole("button", { name: "Abrir Electronics Workbench" })).toBeVisible();

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

  await workspace.getByRole("button", { name: /Brushed DC Motor/ }).click();
  const visual = page.getByTestId("invention-3d-visual-source");
  await expect(visual).toHaveAttribute("data-source", "asset");
  await expect(visual).toHaveAttribute("data-socket-count", "4");
  await expect(visual).toHaveAttribute("data-sockets", /SOCKET_ELEC_POWER_POS/);
  await expect(visual).toHaveAttribute("data-sockets", /SOCKET_ELEC_POWER_NEG/);
  await expect(visual).toHaveAttribute("data-sockets", /SOCKET_MECH_AXIS_OUT/);
  await expect(visual).toHaveAttribute("data-sockets", /SOCKET_MECH_MOUNT_FRONT/);

  await definition.selectOption("energy.battery.lithium-ion-v1");
  await add.click();

  await workspace.getByLabel("Origem 3D").selectOption({ label: "Lithium-Ion Battery Pack · dc-output" });
  await workspace.getByLabel("Destino 3D").selectOption({ label: "Brushed DC Motor · power-pos" });
  await workspace.getByRole("button", { name: "Conectar no 3D" }).click();

  const wire = page.getByTestId("invention-3d-wire-invention-connection-1");
  await expect(wire).toHaveAttribute("data-source-port", "dc-output");
  await expect(wire).toHaveAttribute("data-target-port", "power-pos");
  await expect(wire).toHaveAttribute("data-source-socket", "");
  await expect(wire).toHaveAttribute("data-target-socket", "SOCKET_ELEC_POWER_POS", { timeout: 20_000 });
  await expect(wire).toHaveAttribute("data-socket-aware", "true");
  await expect(status).toHaveAttribute("data-socket-aware-wires", "1");

  await workspace.getByRole("button", { name: /Brushed DC Motor/ }).click();
  const selected = page.getByTestId("invention-3d-selected");
  const centerBefore = {
    x: Number(await selected.getAttribute("data-x")),
    y: Number(await selected.getAttribute("data-y")),
    z: Number(await selected.getAttribute("data-z"))
  };
  const endpointBefore = {
    x: Number(await wire.getAttribute("data-target-x")),
    y: Number(await wire.getAttribute("data-target-y")),
    z: Number(await wire.getAttribute("data-target-z"))
  };
  expect(
    Math.abs(endpointBefore.x - centerBefore.x) > 0.0001 ||
    Math.abs(endpointBefore.y - centerBefore.y) > 0.0001 ||
    Math.abs(endpointBefore.z - centerBefore.z) > 0.0001
  ).toBe(true);

  await workspace.getByRole("button", { name: "Z +" }).click();
  await expect(selected).toHaveAttribute("data-z", (centerBefore.z + 0.05).toFixed(3));
  await expect.poll(async () => Number(await wire.getAttribute("data-target-z"))).toBeCloseTo(endpointBefore.z + 0.05, 3);
  await expect(wire).toHaveAttribute("data-target-socket", "SOCKET_ELEC_POWER_POS");

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});