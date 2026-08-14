import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "apps/studio-web/app/page.tsx",
  "apps/studio-web/components/SpatialWorkbench.tsx",
  "apps/studio-web/components/DesktopPcAssembly.tsx",
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
  "tests/domain/desktop-pc-system.test.mjs",
  ".github/workflows/ci.yml"
];

for (const path of required) await access(resolve(path));

const preset = JSON.parse(await readFile("presets/desktop-pc/project.json", "utf8"));
if (preset.schemaVersion !== "0.1") throw new Error("Desktop preset schemaVersion must be 0.1");
if (preset.metadata?.signature !== "Tehkné Solutions") throw new Error("Official signature missing");
if (preset.metadata?.maturity !== "systemic-teardown") throw new Error("Desktop systemic teardown maturity missing");

const requiredPhysicalIds = [
  "pc.motherboard",
  "pc.cpu",
  "pc.ram.01",
  "pc.gpu",
  "pc.psu",
  "pc.storage",
  "pc.cooling"
];
for (const id of requiredPhysicalIds) {
  const entity = preset.entities?.find((candidate) => candidate.id === id);
  if (!entity) throw new Error(`Desktop subsystem missing: ${id}`);
  if (!entity.metadata?.spatial) throw new Error(`Spatial metadata missing: ${id}`);
  if (!entity.metadata?.simpleExplanation) throw new Error(`Learning explanation missing: ${id}`);
}

const relationshipTypes = new Set(preset.relationships?.map((relationship) => relationship.type));
for (const type of ["contains", "poweredBy", "connectedTo", "mountedTo", "dependsOn"]) {
  if (!relationshipTypes.has(type)) throw new Error(`Engineering relationship missing: ${type}`);
}

const ram = preset.entities.find((entity) => entity.id === "pc.ram.01");
if (!ram?.properties?.capacity) throw new Error("RAM inspect benchmark property missing");

const workbench = await readFile("apps/studio-web/components/SpatialWorkbench.tsx", "utf8");
if (!workbench.includes("EngineeringSession")) throw new Error("Workbench is not bound to EngineeringSession");
if (!workbench.includes("executeCapability")) throw new Error("Capability actions do not execute through session runtime");
if (!workbench.includes("desktopPreset")) throw new Error("Workbench is not loading the official Desktop preset");
if (!workbench.includes("DesktopPcAssembly")) throw new Error("Systemic Desktop assembly surface missing");
if (workbench.includes("createEngineeringEntity")) throw new Error("Workbench must not duplicate EngineeringEntity definitions locally");
if (!workbench.includes("entity-relations")) throw new Error("Engineering Graph relation UX missing");
if (!workbench.includes("DESKTOP-PC-001")) throw new Error("Desktop PC benchmark missing");

const desktopAssembly = await readFile("apps/studio-web/components/DesktopPcAssembly.tsx", "utf8");
if (!desktopAssembly.includes("createSpatialBinding")) throw new Error("Desktop assembly is not bound to SpatialRuntime");
if (!desktopAssembly.includes("getDependencies(root.id, \"contains\")")) {
  throw new Error("Desktop explode view is not driven by Engineering Graph containment");
}

const sessionRuntime = await readFile("packages/engineering-session/src/index.ts", "utf8");
if (!sessionRuntime.includes("EntityExploded")) throw new Error("Explode domain event missing");
if (!sessionRuntime.includes("must be open before explode")) throw new Error("Explode fail-closed guard missing");

const nextConfig = await readFile("apps/studio-web/next.config.mjs", "utf8");
if (!nextConfig.includes("extensionAlias")) throw new Error("Next shared-source extension alias missing");

console.log(`S1.4 structure PASS · ${required.length} required surfaces · ${requiredPhysicalIds.length} physical subsystems · Tehkné Solutions`);
