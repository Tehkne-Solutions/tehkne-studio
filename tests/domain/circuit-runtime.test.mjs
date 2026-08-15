import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { createElectronicsWorkbenchProject } from "../../dist/packages/electronics-runtime/src/index.js";
import { CIRCUIT_RUNTIME_SIGNATURE, CircuitBuilder } from "../../dist/packages/circuit-runtime/src/index.js";

async function runtime() {
  const profile = JSON.parse(await readFile("presets/electronics-workbench-01/profile.json", "utf8"));
  const session = new EngineeringSession(createElectronicsWorkbenchProject(profile));
  return { session, builder: new CircuitBuilder(session) };
}

test("S2.9 Circuit Builder starts as a signed editable Engineering Graph without replacing S2.8 preset", async () => {
  const { session, builder } = await runtime();
  assert.equal(session.getEntity("electronics.resistor").name, "Resistor Limitador");
  const root = session.getEntity("circuit.root");
  assert.equal(root.type, "CircuitProject");
  assert.equal(root.metadata.signature, "Tehkné Solutions");
  assert.equal(builder.document().signature, CIRCUIT_RUNTIME_SIGNATURE);
  assert.equal(builder.components().length, 0);
  assert.equal(builder.wires().length, 0);
  assert.ok(session.graph.snapshot().relationships.some((relationship) => relationship.source === "electronics.root" && relationship.target === "circuit.root"));
});

test("S2.9 components and wires are real Engineering Entities and connectedTo relationships", async () => {
  const { session, builder } = await runtime();
  const source = builder.addComponent("dc-source");
  const switchEntity = builder.addComponent("switch");
  const resistor = builder.addComponent("resistor", { resistanceOhm: 470 });
  const led = builder.addComponent("led");
  builder.connect({ entityId: source.id, portId: "positive" }, { entityId: switchEntity.id, portId: "input" });
  builder.connect({ entityId: switchEntity.id, portId: "output" }, { entityId: resistor.id, portId: "input" });
  builder.connect({ entityId: resistor.id, portId: "output" }, { entityId: led.id, portId: "anode" });
  builder.connect({ entityId: led.id, portId: "cathode" }, { entityId: source.id, portId: "negative" });

  assert.equal(builder.components().length, 4);
  assert.equal(builder.wires().length, 4);
  assert.equal(session.getEntity(resistor.id).properties.resistanceOhm.value, 470);
  assert.ok(builder.wires().every((wire) => wire.type === "connectedTo" && wire.metadata.circuitBuilder === true));
  assert.deepEqual(builder.availableOutputs(), []);
  assert.deepEqual(builder.availableInputs(), []);
});

test("S2.9 series solver remains fail closed for incomplete or incompatible topology", async () => {
  const { builder } = await runtime();
  const source = builder.addComponent("dc-source");
  const resistor = builder.addComponent("resistor");
  const incomplete = builder.simulate();
  assert.equal(incomplete.status, "incomplete");
  assert.match(incomplete.message, /Circuito incompleto/);

  assert.throws(
    () => builder.connect({ entityId: source.id, portId: "negative" }, { entityId: resistor.id, portId: "input" }),
    /Incompatible circuit terminals/
  );

  builder.reset();
  const source2 = builder.addComponent("dc-source");
  const resistor2 = builder.addComponent("resistor");
  const led = builder.addComponent("led");
  const switchEntity = builder.addComponent("switch");
  builder.connect({ entityId: source2.id, portId: "positive" }, { entityId: resistor2.id, portId: "input" });
  builder.connect({ entityId: resistor2.id, portId: "output" }, { entityId: switchEntity.id, portId: "input" });
  builder.connect({ entityId: switchEntity.id, portId: "output" }, { entityId: led.id, portId: "anode" });
  // Deliberately missing LED return to source negative.
  const unsupported = builder.simulate();
  assert.equal(unsupported.status, "incomplete");
  assert.ok(unsupported.issues.length > 0);
});

test("S2.9 created circuit solves series current, supports multiple resistors and detects overcurrent", async () => {
  const { builder } = await runtime();
  builder.createSeriesLedCircuit();
  const switchEntity = builder.components().find((entity) => entity.metadata.circuitKind === "switch");
  assert.ok(switchEntity);
  builder.setSwitchClosed(switchEntity.id, true);
  const safe = builder.simulate();
  assert.equal(safe.status, "pass");
  assert.equal(safe.totalResistanceOhm, 330);
  assert.ok(Math.abs(safe.circuitCurrentA - 0.009091) < 0.000002);
  assert.equal(safe.orderedComponentIds.length, 3);

  builder.reset();
  const source = builder.addComponent("dc-source", { voltageV: 5 });
  const first = builder.addComponent("resistor", { resistanceOhm: 100 });
  const second = builder.addComponent("resistor", { resistanceOhm: 100 });
  const led = builder.addComponent("led", { maxCurrentA: 0.02 });
  builder.connect({ entityId: source.id, portId: "positive" }, { entityId: first.id, portId: "input" });
  builder.connect({ entityId: first.id, portId: "output" }, { entityId: second.id, portId: "input" });
  builder.connect({ entityId: second.id, portId: "output" }, { entityId: led.id, portId: "anode" });
  builder.connect({ entityId: led.id, portId: "cathode" }, { entityId: source.id, portId: "negative" });
  const twoResistors = builder.simulate();
  assert.equal(twoResistors.totalResistanceOhm, 200);
  assert.equal(twoResistors.status, "pass");

  builder.setComponentValue(first.id, "resistanceOhm", 50);
  builder.setComponentValue(second.id, "resistanceOhm", 50);
  const fault = builder.simulate();
  assert.equal(fault.status, "fault");
  assert.ok(fault.circuitCurrentA > 0.02);
});

test("S2.9 voltage probes are project entities and measure solved terminal potentials", async () => {
  const { session, builder } = await runtime();
  builder.createSeriesLedCircuit();
  const switchEntity = builder.components().find((entity) => entity.metadata.circuitKind === "switch");
  const resistor = builder.components().find((entity) => entity.metadata.circuitKind === "resistor");
  const source = builder.components().find((entity) => entity.metadata.circuitKind === "dc-source");
  assert.ok(switchEntity && resistor && source);
  builder.setSwitchClosed(switchEntity.id, true);
  const simulation = builder.simulate();
  assert.equal(simulation.status, "pass");

  const probe = builder.placeVoltageProbe(
    "Probe do resistor",
    { entityId: resistor.id, portId: "input" },
    { entityId: resistor.id, portId: "output" }
  );
  const measured = builder.measureProbe(probe.id);
  assert.ok(Math.abs(measured.valueV - simulation.resistors[0].voltageDropV) < 0.000001);
  assert.equal(measured.source, "calculated");
  assert.equal(session.getEntity(probe.entityId).type, "VoltageProbe");
  assert.equal(session.getEntity(probe.entityId).properties.lastValueV.value, measured.valueV);

  const sourceProbe = builder.placeVoltageProbe(
    "Probe da fonte",
    { entityId: source.id, portId: "positive" },
    { entityId: source.id, portId: "negative" }
  );
  assert.equal(builder.measureProbe(sourceProbe.id).valueV, 5);
});

test("S2.9 Circuit Builder restores records and probes without replaying simulations", async () => {
  const { session, builder } = await runtime();
  builder.createSeriesLedCircuit();
  const switchEntity = builder.components().find((entity) => entity.metadata.circuitKind === "switch");
  const source = builder.components().find((entity) => entity.metadata.circuitKind === "dc-source");
  assert.ok(switchEntity && source);
  builder.setSwitchClosed(switchEntity.id, true);
  builder.simulate();
  const probe = builder.placeVoltageProbe("Fonte", { entityId: source.id, portId: "positive" }, { entityId: source.id, portId: "negative" });
  builder.measureProbe(probe.id);
  const eventCount = session.events.list().length;

  const restored = new CircuitBuilder(session, { records: builder.records(), probes: builder.probes() });
  assert.equal(restored.records().length, 1);
  assert.equal(restored.probes().length, 1);
  assert.equal(session.events.list().length, eventCount, "rehydration must not replay simulation or measurement events");
});
