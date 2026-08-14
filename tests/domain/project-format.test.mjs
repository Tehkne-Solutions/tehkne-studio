import test from "node:test";
import assert from "node:assert/strict";
import { createEngineeringEntity } from "../../dist/packages/engineering-core/src/index.js";
import { TEHKNE_STUDIO_SCHEMA_VERSION, validateProject } from "../../dist/packages/project-format/src/index.js";

test(".tks logical project validates root and relations", () => {
  const root = createEngineeringEntity({ id: "pc", type: "Computer", name: "Desktop PC" });
  const project = {
    schemaVersion: TEHKNE_STUDIO_SCHEMA_VERSION,
    projectId: "desktop-pc-001",
    name: "Desktop PC 001",
    projectType: "teardown",
    rootEntityId: root.id,
    entities: [root],
    relationships: [],
    metadata: { signature: "Tehkné Solutions" }
  };
  assert.deepEqual(validateProject(project), []);
});
