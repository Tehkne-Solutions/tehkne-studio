import test from "node:test";
import assert from "node:assert/strict";
import { resolveStudioIntent } from "../../dist/packages/intelligence-runtime/src/index.js";

const entities = [
  { id: "pc.root", type: "Computer", name: "Desktop PC", state: "open", capabilityIds: ["open", "powerOn", "explode"] },
  { id: "pc.ram.01", type: "MemoryModule", name: "RAM Module A", state: "connected", capabilityIds: ["remove", "insert", "inspect", "explain"] },
  { id: "pc.cpu", type: "Processor", name: "CPU", state: "mounted", capabilityIds: ["inspect", "explain"] },
  { id: "pc.boot", type: "BootProcess", name: "Boot Process", state: "fault", capabilityIds: ["why"] }
];

test("S1.6 resolves Portuguese commands to real capabilities and entities", () => {
  const open = resolveStudioIntent("Abra o computador", { entities });
  assert.equal(open.status, "resolved");
  assert.equal(open.targetEntityId, "pc.root");
  assert.equal(open.capabilityId, "open");

  const remove = resolveStudioIntent("Tire a RAM", { entities });
  assert.equal(remove.status, "resolved");
  assert.equal(remove.targetEntityId, "pc.ram.01");
  assert.equal(remove.capabilityId, "remove");

  const why = resolveStudioIntent("Por que não iniciou?", { entities });
  assert.equal(why.status, "resolved");
  assert.equal(why.targetEntityId, "pc.boot");
  assert.equal(why.capabilityId, "why");
});

test("S1.6 resolves deictic commands against current spatial selection", () => {
  const result = resolveStudioIntent("Tire isso", {
    entities,
    selectedEntityId: "pc.ram.01"
  });
  assert.equal(result.status, "resolved");
  assert.equal(result.targetEntityId, "pc.ram.01");
  assert.equal(result.capabilityId, "remove");
});

test("S1.6 remains fail-closed when a command is ambiguous", () => {
  const result = resolveStudioIntent("Remova a memoria", {
    entities: [
      ...entities,
      { id: "pc.ram.02", type: "MemoryModule", name: "RAM Module B", state: "connected", capabilityIds: ["remove", "insert"] }
    ]
  });
  assert.equal(result.status, "ambiguous");
  assert.deepEqual(new Set(result.candidates), new Set(["pc.ram.01", "pc.ram.02"]));
});

test("S1.6 focus resolves an entity without inventing a capability", () => {
  const result = resolveStudioIntent("Mostre a CPU", { entities });
  assert.equal(result.status, "resolved");
  assert.equal(result.action, "focus");
  assert.equal(result.targetEntityId, "pc.cpu");
  assert.equal(result.capabilityId, undefined);
});
