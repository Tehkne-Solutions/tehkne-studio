import test from "node:test";
import assert from "node:assert/strict";
import { createEngineeringEntity } from "../../dist/packages/engineering-core/src/index.js";
import { createSpatialBinding, resolveSpatialSelection } from "../../dist/packages/spatial-runtime/src/index.js";

test("Spatial binding resolves selection to the same EngineeringEntity", () => {
  const entity = createEngineeringEntity({
    id: "pc.ram.01",
    type: "MemoryModule",
    name: "RAM Module",
    capabilities: [{ id: "inspect", label: "Inspect" }]
  });

  const binding = createSpatialBinding(entity, {
    position: { x: 0, y: 0.55, z: 0 }
  });

  const selection = resolveSpatialSelection(entity, binding);
  assert.equal(selection.entity.id, "pc.ram.01");
  assert.equal(selection.binding.entityId, selection.entity.id);
  assert.equal(selection.binding.position.y, 0.55);
});

test("Spatial binding fails closed when visual and domain entities diverge", () => {
  const entity = createEngineeringEntity({
    id: "pc.ram.01",
    type: "MemoryModule",
    name: "RAM Module"
  });

  const binding = createSpatialBinding(entity);
  assert.throws(
    () => resolveSpatialSelection({ ...entity, id: "pc.gpu.01" }, binding),
    /does not match entity/
  );
});
