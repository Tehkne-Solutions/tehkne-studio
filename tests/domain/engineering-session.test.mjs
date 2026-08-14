import test from "node:test";
import assert from "node:assert/strict";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";

const project = {
  schemaVersion: "0.1",
  projectId: "s1-3-test",
  name: "S1.3 Test",
  projectType: "teardown",
  rootEntityId: "pc.root",
  entities: [
    {
      id: "pc.root",
      type: "Computer",
      name: "Desktop PC",
      state: "closed",
      properties: {},
      ports: {},
      capabilities: [
        { id: "inspect", label: "Inspect" },
        { id: "open", label: "Open" }
      ],
      metadata: { simpleExplanation: "Um computador modular de bancada." }
    },
    {
      id: "pc.ram.01",
      type: "MemoryModule",
      name: "RAM Module",
      parentId: "pc.root",
      state: "connected",
      properties: {
        connected: { id: "connected", value: true, source: "studio" },
        capacity: { id: "capacity", value: 16, unit: "GB", source: "manufacturer", confidence: 1 }
      },
      ports: {
        "memory-bus": {
          id: "memory-bus",
          kind: "data",
          direction: "bidirectional",
          compatibility: ["ddr-memory-slot"],
          state: "connected"
        }
      },
      capabilities: [
        { id: "inspect", label: "Inspect" },
        { id: "explain", label: "Explain" },
        { id: "remove", label: "Remove" }
      ],
      metadata: { simpleExplanation: "A RAM mantém dados de trabalho temporários." }
    }
  ],
  relationships: [
    { id: "contains", source: "pc.root", target: "pc.ram.01", type: "contains", metadata: {} }
  ],
  metadata: { signature: "Tehkné Solutions" }
};

test("S1.3 inspect exposes value and provenance without mutating entity", async () => {
  const session = new EngineeringSession(project);
  const result = await session.executeCapability("pc.ram.01", "inspect");
  assert.equal(result.ok, true);
  assert.equal(result.result.changed, false);
  assert.equal(result.result.inspection.find((property) => property.id === "capacity").source, "manufacturer");
  assert.equal(session.getEntity("pc.ram.01").state, "connected");
  assert.equal(session.events.list("EntityInspected").length, 1);
  assert.equal(session.history().length, 1);
});

test("S1.3 capability command mutates real entity, port and semantic history", async () => {
  const session = new EngineeringSession(project);
  const result = await session.executeCapability("pc.ram.01", "remove");
  assert.equal(result.ok, true);
  assert.equal(result.result.changed, true);

  const ram = session.getEntity("pc.ram.01");
  assert.equal(ram.state, "removed");
  assert.equal(ram.properties.connected.value, false);
  assert.equal(ram.ports["memory-bus"].state, "available");
  assert.equal(session.events.list("EntityRemoved").length, 1);
  assert.equal(session.history()[0].label, "Removido: RAM Module");
});

test("capability runtime rejects actions that are not exposed or not yet executable", async () => {
  const session = new EngineeringSession({
    ...project,
    entities: project.entities.map((entity) =>
      entity.id === "pc.root"
        ? { ...entity, capabilities: [...entity.capabilities, { id: "powerOn", label: "Power On" }] }
        : entity
    )
  });

  const future = await session.executeCapability("pc.root", "powerOn");
  assert.equal(future.ok, false);
  assert.match(future.error, /not executable in S1.4/);

  const missing = await session.executeCapability("pc.root", "remove");
  assert.equal(missing.ok, false);
  assert.match(missing.error, /does not expose capability/);
});
