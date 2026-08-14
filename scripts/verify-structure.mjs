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
  "packages/simulation-runtime/src/index.ts",
  "packages/engineering-session/src/index.ts",
  "presets/desktop-pc/project.json",
  "tests/domain/spatial-runtime.test.mjs",
  "tests/domain/engineering-session.test.mjs",
  "tests/domain/desktop-pc-system.test.mjs",
  "tests/domain/simulation-runtime.test.mjs",
  "tests/domain/causal-boot.test.mjs",
  ".github/workflows/ci.yml"
];

for (const path of required) await access(resolve(path));

const preset = JSON.parse(await readFile("presets/desktop-pc/project.json", "utf8"));
if (preset.schemaVersion !== "0.1") throw new Error("Desktop preset schemaVersion must be 0.1");
if (preset.metadata?.signature !== "Tehkné Solutions") throw new Error("Official signature missing");
if (preset.metadata?.maturity !== "causal-boot") throw new Error("Desktop causal boot maturity missing");

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

const root = preset.entities.find((entity) => entity.id === "pc.root");
if (!root?.properties?.powerState) throw new Error("Root powerState property missing");
if (!root.capabilities?.some((capability) => capability.id === "powerOn")) throw new Error("Power On capability missing");

const ram = preset.entities.find((entity) => entity.id === "pc.ram.01");
if (!ram?.properties?.capacity) throw new Error("RAM inspect benchmark property missing");
if (!ram.capabilities?.some((capability) => capability.id === "insert")) throw new Error("RAM reinstall capability missing");

const boot = preset.entities.find((entity) => entity.id === "pc.boot");
for (const property of ["status", "stage", "faultCode", "faultEntityId", "faultReason"]) {
  if (!boot?.properties?.[property]) throw new Error(`Boot state property missing: ${property}`);
}
if (!boot.capabilities?.some((capability) => capability.id === "why")) throw new Error("Boot why capability missing");

const workbench = await readFile("apps/studio-web/components/SpatialWorkbench.tsx", "utf8");
if (!workbench.includes("EngineeringSession")) throw new Error("Workbench is not bound to EngineeringSession");
if (!workbench.includes("executeCapability")) throw new Error("Capability actions do not execute through session runtime");
if (!workbench.includes("desktopPreset")) throw new Error("Workbench is not loading the official Desktop preset");
if (!workbench.includes("DesktopPcAssembly")) throw new Error("Systemic Desktop assembly surface missing");
if (workbench.includes("createEngineeringEntity")) throw new Error("Workbench must not duplicate EngineeringEntity definitions locally");
if (!workbench.includes("entity-relations")) throw new Error("Engineering Graph relation UX missing");
if (!workbench.includes("boot-timeline")) throw new Error("Functional boot timeline UX missing");
if (!workbench.includes("causal-trace")) throw new Error("Causal trace UX missing");
if (!workbench.includes("focusEntityId")) throw new Error("Boot result does not focus the causal entity");

const desktopAssembly = await readFile("apps/studio-web/components/DesktopPcAssembly.tsx", "utf8");
if (!desktopAssembly.includes("createSpatialBinding")) throw new Error("Desktop assembly is not bound to SpatialRuntime");
if (!desktopAssembly.includes("getDependencies(root.id, \"contains\")")) {
  throw new Error("Desktop explode view is not driven by Engineering Graph containment");
}

const simulationRuntime = await readFile("packages/simulation-runtime/src/index.ts", "utf8");
if (!simulationRuntime.includes("runFunctionalBoot")) throw new Error("Functional boot model missing");
if (!simulationRuntime.includes("MEMORY_UNAVAILABLE")) throw new Error("Memory failure classification missing");

const sessionRuntime = await readFile("packages/engineering-session/src/index.ts", "utf8");
for (const eventType of ["BootFailed", "BootSucceeded", "CausalityExplained", "EntityInserted"]) {
  if (!sessionRuntime.includes(eventType)) throw new Error(`Causal boot event missing: ${eventType}`);
}
if (!sessionRuntime.includes("runFunctionalBoot")) throw new Error("Engineering Session is not orchestrating Simulation Runtime");
if (!sessionRuntime.includes("dependsOn")) throw new Error("Causal explanation is not reading Engineering Graph dependencies");

const nextConfig = await readFile("apps/studio-web/next.config.mjs", "utf8");
if (!nextConfig.includes("extensionAlias")) throw new Error("Next shared-source extension alias missing");

console.log(`S1.5 structure PASS · ${required.length} required surfaces · causal boot + recovery · Tehkné Solutions`);
