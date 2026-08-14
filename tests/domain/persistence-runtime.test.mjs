import test from "node:test";
import assert from "node:assert/strict";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import {
  createSessionSnapshot,
  parseSessionSnapshot,
  restoreSessionSnapshot,
  serializeSessionSnapshot
} from "../../dist/packages/persistence-runtime/src/index.js";

const project = {
  schemaVersion: "0.1",
  projectId: "persistence-test",
  name: "Persistence Test",
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
      capabilities: [{ id: "open", label: "Open" }, { id: "inspect", label: "Inspect" }],
      metadata: {}
    },
    {
      id: "pc.ram",
      type: "MemoryModule",
      name: "RAM",
      state: "connected",
      properties: { connected: { id: "connected", value: true, source: "studio" } },
      ports: {},
      capabilities: [{ id: "remove", label: "Remove" }, { id: "inspect", label: "Inspect" }],
      metadata: {}
    }
  ],
  relationships: [{ id: "contains-ram", source: "pc.root", target: "pc.ram", type: "contains", metadata: {} }],
  metadata: { signature: "Tehkné Solutions" }
};

const behavior = {
  id: "behavior-persisted",
  name: "Persisted behavior",
  enabled: true,
  trigger: { kind: "propertyChanged", signal: { entityId: "pc.ram", propertyId: "connected" } },
  condition: { kind: "threshold", signal: { entityId: "pc.ram", propertyId: "connected" }, operator: "eq", threshold: 1 },
  action: { kind: "capability", targetEntityId: "pc.root", capabilityId: "inspect" },
  authoredBy: "intelligence",
  createdAt: "2026-08-14T20:00:00.000Z"
};

test("S2.2 saves current Engineering Graph, behaviors, history and events then restores them", async () => {
  const session = new EngineeringSession(project);
  await session.executeCapability("pc.root", "open");
  await session.executeCapability("pc.ram", "remove");

  const snapshot = createSessionSnapshot(session, {
    behaviors: [behavior],
    extensions: { workspace: { activeProduct: "desktop", selectedEntityId: "pc.ram" } },
    savedAt: "2026-08-14T20:05:00.000Z"
  });
  const serialized = serializeSessionSnapshot(snapshot);
  const parsed = parseSessionSnapshot(serialized);
  const restored = restoreSessionSnapshot(parsed);

  assert.equal(parsed.signature, "Tehkné Solutions");
  assert.equal(parsed.persistenceVersion, "1");
  assert.equal(parsed.project.behaviors.length, 1);
  assert.equal(parsed.extensions.workspace.activeProduct, "desktop");
  assert.equal(restored.getEntity("pc.root").state, "open");
  assert.equal(restored.getEntity("pc.ram").state, "removed");
  assert.equal(restored.getEntity("pc.ram").properties.connected.value, false);
  assert.equal(restored.history().length, 2);
  assert.equal(restored.events.list().length, 2);

  await restored.executeCapability("pc.ram", "inspect");
  assert.equal(restored.history().length, 3);
  assert.equal(new Set(restored.history().map((entry) => entry.id)).size, 3);
  assert.equal(restored.events.list("EntityInspected").length, 1);
});

test("S2.2 persistence rejects invalid signature, schema and dangling engineering state", async () => {
  const session = new EngineeringSession(project);
  const snapshot = createSessionSnapshot(session, { savedAt: "2026-08-14T20:06:00.000Z" });

  assert.throws(
    () => parseSessionSnapshot(JSON.stringify({ ...snapshot, signature: "Other" })),
    /Invalid Tehkné Studio persistence signature/
  );
  assert.throws(
    () => parseSessionSnapshot(JSON.stringify({ ...snapshot, persistenceVersion: "999" })),
    /Unsupported persistenceVersion/
  );

  const dangling = {
    ...snapshot,
    project: {
      ...snapshot.project,
      relationships: [{ id: "broken", source: "pc.root", target: "missing.entity", type: "contains", metadata: {} }]
    }
  };
  assert.throws(() => parseSessionSnapshot(JSON.stringify(dangling)), /Missing relationship target/);
});

test("S2.2 persistence refuses malformed JSON instead of restoring partial state", () => {
  assert.throws(() => parseSessionSnapshot("{not-json"), /not valid JSON/);
});
