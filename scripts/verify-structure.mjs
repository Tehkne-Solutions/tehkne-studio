import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "apps/studio-web/app/page.tsx",
  "apps/studio-web/components/SpatialWorkbench.tsx",
  "packages/engineering-core/src/index.ts",
  "packages/engineering-graph/src/index.ts",
  "packages/project-format/src/index.ts",
  "packages/command-bus/src/index.ts",
  "packages/observability/src/index.ts",
  "packages/spatial-runtime/src/index.ts",
  "presets/desktop-pc/project.json",
  "tests/domain/spatial-runtime.test.mjs",
  ".github/workflows/ci.yml"
];

for (const path of required) await access(resolve(path));

const preset = JSON.parse(await readFile("presets/desktop-pc/project.json", "utf8"));
if (preset.schemaVersion !== "0.1") throw new Error("Desktop preset schemaVersion must be 0.1");
if (preset.metadata?.signature !== "Tehkné Solutions") throw new Error("Official signature missing");
if (!preset.entities?.some((entity) => entity.id === "pc.ram.01")) throw new Error("RAM benchmark entity missing");

const workbench = await readFile("apps/studio-web/components/SpatialWorkbench.tsx", "utf8");
if (!workbench.includes("createSpatialBinding")) throw new Error("Spatial workbench is not bound to SpatialRuntime");
if (!workbench.includes("createEngineeringEntity")) throw new Error("Spatial workbench is not bound to EngineeringEntity");
if (!workbench.includes("DESKTOP-PC-001")) throw new Error("Desktop PC spatial benchmark missing");

console.log(`S1.2 structure PASS · ${required.length} required surfaces · Tehkné Solutions`);
