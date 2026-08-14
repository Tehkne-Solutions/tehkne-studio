import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ComponentRegistry,
  parseComponentCatalog,
  portsAreCompatible,
  validateComponentCatalog
} from "../../dist/packages/component-library/src/index.js";

async function catalog() {
  return parseComponentCatalog(JSON.parse(await readFile("library/components/catalog.json", "utf8")));
}

test("S2.3 universal catalog is signed, versioned and covers reusable technology domains", async () => {
  const manifest = await catalog();
  const registry = new ComponentRegistry(manifest);

  assert.equal(manifest.catalogId, "tehkne-universal-components-v1");
  assert.equal(manifest.catalogVersion, "1");
  assert.equal(manifest.signature, "Tehkné Solutions");
  assert.ok(manifest.components.length >= 16);
  assert.equal(registry.list().length, manifest.components.length);

  const domains = new Set(manifest.components.map((definition) => definition.domain));
  for (const domain of ["compute", "memory", "storage", "power", "energy", "display", "sensing", "actuation", "control", "thermal", "communication", "structural", "interface"]) {
    assert.ok(domains.has(domain), `missing domain ${domain}`);
  }
  for (const definition of manifest.components) {
    assert.ok(definition.capabilities.some((capability) => capability.id === "inspect"), `${definition.definitionId} lacks inspect`);
    assert.ok(definition.capabilities.some((capability) => capability.id === "explain"), `${definition.definitionId} lacks explain`);
    assert.equal(definition.metadata.provenance, "authored-template");
  }
});

test("S2.3 registry searches by product family, domain, tags and human text", async () => {
  const registry = new ComponentRegistry(await catalog());

  const smartphone = registry.list({ productFamily: "smartphone" });
  assert.ok(smartphone.length >= 8);
  assert.ok(smartphone.some((definition) => definition.definitionId === "compute.soc.mobile-v1"));
  assert.ok(smartphone.some((definition) => definition.definitionId === "energy.battery.lithium-ion-v1"));

  const sensing = registry.list({ domain: "sensing" });
  assert.ok(sensing.some((definition) => definition.definitionId === "sensing.imu.6dof-v1"));
  assert.ok(sensing.some((definition) => definition.definitionId === "sensing.camera.rgb-v1"));

  assert.equal(registry.list({ tags: ["lpddr"] }).at(0)?.definitionId, "memory.lpddr.package-v1");
  assert.equal(registry.list({ query: "bluetooth" }).at(0)?.definitionId, "communication.wireless.combo-v1");
  assert.ok(registry.list({ query: "smartphone" }).length >= 8);
});

test("S2.3 component instantiation creates independent Engineering Entities with validated overrides and provenance", async () => {
  const registry = new ComponentRegistry(await catalog());
  const soc = registry.instantiate("compute.soc.mobile-v1", "phone.soc", {
    name: "Prototype SoC",
    parentId: "phone.root",
    propertyValues: { cpuCores: 12 },
    portStates: { "power-in": "connected" },
    metadata: { designRole: "main-compute" }
  });

  assert.equal(soc.id, "phone.soc");
  assert.equal(soc.parentId, "phone.root");
  assert.equal(soc.name, "Prototype SoC");
  assert.equal(soc.properties.cpuCores.value, 12);
  assert.equal(soc.ports["power-in"].state, "connected");
  assert.equal(soc.metadata.componentDefinitionId, "compute.soc.mobile-v1");
  assert.equal(soc.metadata.componentLibraryVersion, "1");
  assert.equal(soc.metadata.provenance, "component-library");
  assert.equal(soc.metadata.signature, "Tehkné Solutions");
  assert.equal(soc.metadata.designRole, "main-compute");

  const second = registry.instantiate("compute.soc.mobile-v1", "phone.soc.backup");
  assert.equal(second.properties.cpuCores.value, 8, "instance override must not mutate catalog definition");
  assert.throws(() => registry.instantiate("compute.soc.mobile-v1", "bad", { propertyValues: { missing: 1 } }), /Unknown component property override/);
  assert.throws(() => registry.instantiate("compute.soc.mobile-v1", "bad", { propertyValues: { cpuCores: 99 } }), /above maximum/);
  assert.throws(() => registry.instantiate("compute.soc.mobile-v1", "bad", { portStates: { missing: "connected" } }), /Unknown component port override/);
});

test("S2.3 interface compatibility composes a mobile architecture without product-specific glue", async () => {
  const registry = new ComponentRegistry(await catalog());
  const battery = registry.get("energy.battery.lithium-ion-v1");
  const regulator = registry.get("power.regulator.dc-v1");
  const soc = registry.get("compute.soc.mobile-v1");
  const memory = registry.get("memory.lpddr.package-v1");
  const storage = registry.get("storage.solid-state.general-v1");
  const display = registry.get("display.oled.touch-v1");
  const imu = registry.get("sensing.imu.6dof-v1");
  const camera = registry.get("sensing.camera.rgb-v1");
  const wireless = registry.get("communication.wireless.combo-v1");

  assert.equal(portsAreCompatible(battery.ports["dc-output"], regulator.ports["dc-input"]), true);
  assert.equal(portsAreCompatible(regulator.ports["regulated-output"], soc.ports["power-in"]), true);
  assert.equal(portsAreCompatible(soc.ports.memory, memory.ports["memory-bus"]), true);
  assert.equal(portsAreCompatible(soc.ports.storage, storage.ports["storage-bus"]), true);
  assert.equal(portsAreCompatible(soc.ports["display-out"], display.ports["display-in"]), true);
  assert.equal(portsAreCompatible(soc.ports["sensor-bus"], imu.ports["sensor-data"]), true);
  assert.equal(portsAreCompatible(soc.ports["camera-in"], camera.ports["video-out"]), true);
  assert.equal(portsAreCompatible(soc.ports["wireless-bus"], wireless.ports["host-data"]), true);
  assert.equal(portsAreCompatible(battery.ports["dc-output"], camera.ports["video-out"]), false);

  const compatiblePower = registry.compatibleWithPort(soc.ports["power-in"]);
  assert.ok(compatiblePower.some((match) => match.definition.definitionId === "power.regulator.dc-v1" && match.portId === "regulated-output"));
});

test("S2.3 robotics uses the same interface compatibility model", async () => {
  const registry = new ComponentRegistry(await catalog());
  const controller = registry.get("control.robot-controller-v1");
  const actuator = registry.get("actuation.servo.rotary-v1");
  const imu = registry.get("sensing.imu.6dof-v1");

  assert.equal(portsAreCompatible(controller.ports["motion-control"], actuator.ports["control-in"]), true);
  assert.equal(portsAreCompatible(controller.ports["sensor-bus"], imu.ports["sensor-data"]), true);
});

test("S2.3 malformed or unsigned catalogs remain fail closed", async () => {
  const manifest = await catalog();
  assert.throws(() => parseComponentCatalog({ ...manifest, signature: "Other" }), /signature must be Tehkné Solutions/);
  const duplicate = { ...manifest, components: [...manifest.components, manifest.components[0]] };
  assert.ok(validateComponentCatalog(duplicate).some((error) => error.includes("definition IDs must be unique")));
  assert.throws(() => new ComponentRegistry(duplicate), /Invalid component catalog/);
});
