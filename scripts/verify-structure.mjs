import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "apps/studio-web/app/page.tsx",
  "apps/studio-web/components/SpatialWorkbench.tsx",
  "apps/studio-web/next.config.mjs",
  "packages/engineering-core/src/index.ts",
  "packages/engineering-graph/src/index.ts",
  "packages/project-format/src/index.ts",
  "packages/command-bus/src/index.ts",
  "packages/observability/src/index.ts",
  "packages/spatial-runtime/src/index.ts",
  "packages/engineering-session/src/index.ts",
  "presets/desktop-pc/project.json",
  "tests/domain/spatial-runtime.test.mjs",
  "tests/domain/engineering-session.test.mjs",
  ".github/workflows/ci.yml"
];

for (const path of required) await access(resolve(path));

const preset = JSON.parse(await readFile("presets/desktop-pc/project.json", "utf8"));
if (preset.schemaVersion !== "0.1") throw new Error("Desktop preset schemaVersion must be 0.1");
if (preset.metadata?.signature !== "Tehkné Solutions") throw new Error("Official signature missing");
const ram = preset.entities?.find((entity) => entity.id === "pc.ram.01");
if (!ram) throw new Error("RAM benchmark entity missing");
if (!ram.properties?.capacity) throw new Error("RAM inspect benchmark property missing");
if (!ram.metadata?.simpleExplanation) throw new Error("RAM progressive explanation missing");

const workbench = await readFile("apps/studio-web/components/SpatialWorkbench.tsx", "utf8");
if (!workbench.includes("createSpatialBinding")) throw new Error("Spatial workbench is not bound to SpatialRuntime");
if (!workbench.includes("EngineeringSession")) throw new Error("Workbench is not bound to EngineeringSession");
if (!workbench.includes("executeCapability")) throw new Error("Capability actions do not execute through session runtime");
if (!workbench.includes("desktopPreset")) throw new Error("Workbench is not loading the official Desktop preset");
if (workbench.includes("createEngineeringEntity")) throw new Error("Workbench must not duplicate EngineeringEntity definitions locally");
if (!workbench.includes("semantic-history")) throw new Error("Semantic history UX missing");
if (!workbench.includes("DESKTOP-PC-001")) throw new Error("Desktop PC benchmark missing");

const nextConfig = await readFile("apps/studio-web/next.config.mjs", "utf8");
if (!nextConfig.includes("extensionAlias")) throw new Error("Next shared-source extension alias missing");

console.log(`S1.3 structure PASS · ${required.length} required surfaces · Tehkné Solutions`);
