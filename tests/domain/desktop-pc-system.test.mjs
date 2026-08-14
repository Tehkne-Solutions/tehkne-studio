import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";

const preset = JSON.parse(await readFile(new URL("../../presets/desktop-pc/project.json", import.meta.url), "utf8"));

const requiredPhysicalIds = [
  "pc.motherboard",
  "pc.cpu",
  "pc.ram.01",
  "pc.gpu",
  "pc.psu",
  "pc.storage",
  "pc.cooling"
];

test("S1.4 Desktop preset exposes the canonical physical subsystems", () => {
  const ids = new Set(preset.entities.map((entity) => entity.id));
  for (const id of requiredPhysicalIds) assert.equal(ids.has(id), true, `missing ${id}`);

  for (const id of requiredPhysicalIds) {
    const entity = preset.entities.find((candidate) => candidate.id === id);
    assert.ok(entity.metadata?.spatial, `${id} missing spatial metadata`);
    assert.ok(entity.metadata?.simpleExplanation, `${id} missing learning explanation`);
  }
});

test("S1.4 Engineering Graph carries containment, power, data, mount and boot dependencies", () => {
  const relationshipTypes = new Set(preset.relationships.map((relationship) => relationship.type));
  for (const type of ["contains", "poweredBy", "connectedTo", "mountedTo", "dependsOn"]) {
    assert.equal(relationshipTypes.has(type), true, `missing ${type}`);
  }

  const session = new EngineeringSession(preset);
  const contained = session.graph.getDependencies("pc.root", "contains").map((entity) => entity.id);
  for (const id of requiredPhysicalIds) assert.equal(contained.includes(id), true, `root does not contain ${id}`);

  const bootDependencies = session.graph.getDependencies("pc.boot", "dependsOn").map((entity) => entity.id);
  for (const id of ["pc.cpu", "pc.ram.01", "pc.storage", "pc.motherboard"]) {
    assert.equal(bootDependencies.includes(id), true, `boot does not depend on ${id}`);
  }
});

test("S1.4 explode fails closed until open, then separates graph-contained entities", async () => {
  const session = new EngineeringSession(preset);

  const blocked = await session.executeCapability("pc.root", "explode");
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /must be open before explode/);
  assert.equal(session.getEntity("pc.root").state, "closed");

  const opened = await session.executeCapability("pc.root", "open");
  assert.equal(opened.ok, true);
  assert.equal(session.getEntity("pc.root").state, "open");

  const exploded = await session.executeCapability("pc.root", "explode");
  assert.equal(exploded.ok, true);
  assert.equal(exploded.result.changed, true);
  assert.equal(session.getEntity("pc.root").state, "exploded");
  for (const id of requiredPhysicalIds) {
    assert.equal(exploded.result.affectedEntityIds.includes(id), true, `explode did not affect ${id}`);
  }
  assert.equal(session.events.list("EntityExploded").length, 1);
  assert.equal(session.history().at(-1).label, "Explodido: Desktop PC");
});
