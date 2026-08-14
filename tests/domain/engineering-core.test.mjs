import test from "node:test";
import assert from "node:assert/strict";
import { createEngineeringEntity, hasCapability, setEngineeringProperty } from "../../dist/packages/engineering-core/src/index.js";

test("EngineeringEntity validates identity and capabilities", () => {
  const ram = createEngineeringEntity({
    id: "pc.ram.01",
    type: "MemoryModule",
    name: "RAM 01",
    capabilities: [{ id: "remove", label: "Remove" }],
    properties: { connected: { id: "connected", value: true, source: "studio" } }
  });
  assert.equal(hasCapability(ram, "remove"), true);
  const disconnected = setEngineeringProperty(ram, "connected", false);
  assert.equal(disconnected.properties.connected?.value, false);
  assert.equal(ram.properties.connected?.value, true);
});
