import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { StudioIntelligence } from "../../dist/packages/studio-intelligence/src/index.js";

const preset = JSON.parse(await readFile(new URL("../../presets/desktop-pc/project.json", import.meta.url), "utf8"));

test("S1.6 Studio Intelligence drives the complete causal boot recovery through capabilities", async () => {
  const session = new EngineeringSession(preset);
  const intelligence = new StudioIntelligence(session);

  const opened = await intelligence.executeUtterance("Abra o computador");
  assert.equal(opened.executed, true);
  assert.equal(session.getEntity("pc.root").state, "open");

  const removed = await intelligence.executeUtterance("Tire a RAM", { source: "voice" });
  assert.equal(removed.executed, true);
  assert.equal(session.getEntity("pc.ram.01").state, "removed");

  const failed = await intelligence.executeUtterance("Ligue o computador", { source: "voice" });
  assert.equal(failed.executed, true);
  assert.equal(failed.result.bootRun.status, "failure");
  assert.equal(failed.targetEntityId, "pc.boot");

  const explained = await intelligence.executeUtterance("Por que não iniciou?", {
    selectedEntityId: failed.targetEntityId,
    source: "voice"
  });
  assert.equal(explained.executed, true);
  assert.match(explained.message, /RAM Module A/);
  assert.equal(explained.result.causalTrace[1].entityId, "pc.ram.01");

  const restored = await intelligence.executeUtterance("Reinstale a RAM", { source: "voice" });
  assert.equal(restored.executed, true);
  assert.equal(session.getEntity("pc.ram.01").properties.connected.value, true);

  const successful = await intelligence.executeUtterance("Ligue novamente", { source: "voice" });
  assert.equal(successful.executed, true);
  assert.equal(successful.result.bootRun.status, "success");
  assert.equal(session.getEntity("pc.boot").state, "running");

  assert.ok(session.events.list("IntentResolved").length >= 6);
  assert.equal(session.events.list("BootFailed")[0].source, "voice");
  assert.equal(session.events.list("BootSucceeded")[0].source, "voice");
});

test("S1.6 unresolved language does not mutate the Engineering Session", async () => {
  const session = new EngineeringSession(preset);
  const intelligence = new StudioIntelligence(session);
  const before = session.graph.snapshot().entities.map((entity) => `${entity.id}:${entity.state}`).join("|");

  const result = await intelligence.executeUtterance("Faça uma coisa completamente desconhecida");
  assert.equal(result.executed, false);
  assert.equal(result.resolution.status, "unresolved");
  assert.equal(session.events.list("IntentUnresolved").length, 1);

  const after = session.graph.snapshot().entities.map((entity) => `${entity.id}:${entity.state}`).join("|");
  assert.equal(after, before);
});
