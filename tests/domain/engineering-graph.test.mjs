import test from "node:test";
import assert from "node:assert/strict";
import { createEngineeringEntity } from "../../dist/packages/engineering-core/src/index.js";
import { EngineeringGraph } from "../../dist/packages/engineering-graph/src/index.js";

test("EngineeringGraph traces causal dependencies without dangling relations", () => {
  const graph = new EngineeringGraph();
  for (const entity of [
    createEngineeringEntity({ id: "pc", type: "Computer", name: "Desktop PC" }),
    createEngineeringEntity({ id: "boot", type: "BootProcess", name: "Boot" }),
    createEngineeringEntity({ id: "ram", type: "MemoryModule", name: "RAM" })
  ]) graph.addEntity(entity);

  graph.connect({ id: "boot-depends-ram", source: "boot", target: "ram", type: "dependsOn", metadata: {} });
  graph.connect({ id: "pc-contains-boot", source: "pc", target: "boot", type: "contains", metadata: {} });
  graph.assertIntegrity();
  assert.deepEqual(graph.trace("boot", "dependsOn"), ["boot", "ram"]);
});
