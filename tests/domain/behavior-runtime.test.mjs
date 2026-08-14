import test from "node:test";
import assert from "node:assert/strict";
import { BehaviorRuntime } from "../../dist/packages/behavior-runtime/src/index.js";

const behavior = {
  id: "behavior-test",
  name: "CPU > 70°C → Fan 100%",
  enabled: true,
  trigger: {
    kind: "propertyChanged",
    signal: { entityId: "pc.cpu", propertyId: "temperatureC" }
  },
  condition: {
    kind: "threshold",
    signal: { entityId: "pc.cpu", propertyId: "temperatureC" },
    operator: "gt",
    threshold: 70
  },
  action: {
    kind: "capability",
    targetEntityId: "pc.cooling",
    capabilityId: "setFanSpeed",
    args: { percent: 100 }
  },
  authoredBy: "intelligence",
  createdAt: "2026-08-14T00:00:00.000Z"
};

test("S1.7 Behavior Runtime stays idle below threshold and triggers above it", () => {
  const runtime = new BehaviorRuntime([behavior]);
  const below = runtime.evaluateChange({
    signal: { entityId: "pc.cpu", propertyId: "temperatureC" },
    value: 69
  });
  assert.equal(below.length, 1);
  assert.equal(below[0].status, "not_triggered");
  assert.equal(below[0].action, null);

  const above = runtime.evaluateChange({
    signal: { entityId: "pc.cpu", propertyId: "temperatureC" },
    value: 76
  });
  assert.equal(above.length, 1);
  assert.equal(above[0].status, "triggered");
  assert.equal(above[0].observedValue, 76);
  assert.equal(above[0].action.capabilityId, "setFanSpeed");
});

test("S1.7 Behavior Runtime ignores unrelated signals and fails closed for non numeric values", () => {
  const runtime = new BehaviorRuntime([behavior]);
  assert.equal(runtime.evaluateChange({
    signal: { entityId: "pc.gpu", propertyId: "temperatureC" },
    value: 90
  }).length, 0);

  const invalid = runtime.evaluateChange({
    signal: { entityId: "pc.cpu", propertyId: "temperatureC" },
    value: "hot"
  });
  assert.equal(invalid[0].status, "unavailable");
  assert.equal(invalid[0].action, null);
});
