import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import {
  ElectronicsBench,
  createElectronicsWorkbenchProject,
  validateElectronicsWorkbenchProfile
} from "../../dist/packages/electronics-runtime/src/index.js";
import { validateProject } from "../../dist/packages/project-format/src/index.js";

async function profile() {
  return JSON.parse(await readFile("presets/electronics-workbench-01/profile.json", "utf8"));
}

test("S2.8 Electronics Workbench creates a signed experiment with a closed-loop DC learning circuit", async () => {
  const input = await profile();
  assert.deepEqual(validateElectronicsWorkbenchProfile(input), []);
  const project = createElectronicsWorkbenchProject(input);
  assert.equal(project.projectId, "electronics-workbench-01");
  assert.equal(project.projectType, "experiment");
  assert.equal(project.rootEntityId, "electronics.root");
  assert.equal(project.metadata.signature, "Tehkné Solutions");
  assert.equal(project.entities.length, 6);
  assert.equal(project.relationships.filter((relationship) => relationship.type === "connectedTo").length, 4);
  assert.deepEqual(validateProject(project), []);
});

test("S2.8 open switch produces zero current without reporting a false electrical fault", async () => {
  const project = createElectronicsWorkbenchProject(await profile());
  const session = new EngineeringSession(project);
  const bench = new ElectronicsBench(session);
  const result = bench.simulate();
  assert.equal(result.status, "open");
  assert.equal(result.circuitCurrentA, 0);
  assert.equal(session.getEntity("electronics.led").state, "off");
  assert.equal(result.provenance, "calculated");
});

test("S2.8 5 V with 330 ohm resistor drives the LED inside its current envelope", async () => {
  const session = new EngineeringSession(createElectronicsWorkbenchProject(await profile()));
  const bench = new ElectronicsBench(session);
  bench.setSwitchClosed(true);
  const result = bench.simulate();

  assert.equal(result.status, "pass");
  assert.ok(Math.abs(result.circuitCurrentA - 0.009091) < 0.00001);
  assert.ok(Math.abs(result.resistorVoltageV - 3) < 0.001);
  assert.equal(result.ledVoltageV, 2);
  assert.ok(result.currentMarginPercent > 50);
  assert.equal(session.getEntity("electronics.led").state, "on");
});

test("S2.8 reducing resistance exposes an overcurrent fault instead of clamping the simulated truth", async () => {
  const session = new EngineeringSession(createElectronicsWorkbenchProject(await profile()));
  const bench = new ElectronicsBench(session);
  bench.setResistance(100);
  bench.setSwitchClosed(true);
  const result = bench.simulate();

  assert.equal(result.status, "fault");
  assert.ok(result.circuitCurrentA > 0.02);
  assert.match(result.message, /Sobrecorrente/);
  assert.equal(session.getEntity("electronics.led").state, "fault");
  assert.equal(session.getEntity("electronics.root").properties.circuitStatus.value, "fault");
});

test("S2.8 multimeter measurements are derived from the latest simulation with calculated provenance", async () => {
  const session = new EngineeringSession(createElectronicsWorkbenchProject(await profile()));
  const bench = new ElectronicsBench(session);
  bench.setSwitchClosed(true);
  const result = bench.simulate();
  const current = bench.measure("circuit-current");
  const resistorVoltage = bench.measure("resistor-voltage");
  const ledPower = bench.measure("led-power");

  assert.equal(current.value, result.circuitCurrentA);
  assert.equal(current.unit, "A");
  assert.equal(current.source, "calculated");
  assert.equal(resistorVoltage.value, result.resistorVoltageV);
  assert.equal(resistorVoltage.unit, "V");
  assert.equal(ledPower.value, result.ledPowerW);
  assert.equal(ledPower.unit, "W");
  assert.equal(session.getEntity("electronics.multimeter").properties.lastUnit.value, "W");
});

test("S2.8 source voltage and resistance edits remain bounded and recover from a fault", async () => {
  const session = new EngineeringSession(createElectronicsWorkbenchProject(await profile()));
  const bench = new ElectronicsBench(session);
  assert.throws(() => bench.setSourceVoltage(25), /entre 0 e 24 V/);
  assert.throws(() => bench.setResistance(0), /entre 1 Ω e 1 MΩ/);

  bench.setResistance(100);
  bench.setSwitchClosed(true);
  assert.equal(bench.simulate().status, "fault");
  bench.setResistance(470);
  const recovered = bench.simulate();
  assert.equal(recovered.status, "pass");
  assert.equal(session.getEntity("electronics.led").state, "on");
});

test("S2.8 restored ElectronicsBench keeps simulation evidence without replaying it", async () => {
  const session = new EngineeringSession(createElectronicsWorkbenchProject(await profile()));
  const bench = new ElectronicsBench(session);
  bench.setSwitchClosed(true);
  bench.simulate();
  const eventCount = session.events.list().length;
  const restored = new ElectronicsBench(session, { records: bench.records() });
  assert.equal(restored.records().length, 1);
  assert.equal(session.events.list().length, eventCount, "restore must not synthesize a new simulation event");
});
