import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/technology-preset-registry/src/index.ts",
  "registry/technology-presets/v1.json",
  "tests/domain/technology-preset-registry.test.mjs",
  "apps/studio-web/lib/technologyPresetRegistry.ts",
  "apps/studio-web/components/TechnologyPresetLauncher.tsx",
  "tests/browser/technology-preset-registry.spec.ts"
];
for (const path of required) await access(resolve(path));
for (const temporary of [
  ".github/workflows/s2-08-registry-bootstrap.yml",
  "tools/s2-08-integrate-preset-registry.mjs"
]) {
  try {
    await access(resolve(temporary));
    throw new Error(`S2.8 temporary write bootstrap must not ship: ${temporary}`);
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  }
}

const runtime = await readFile("packages/technology-preset-registry/src/index.ts", "utf8");
for (const token of [
  'TECHNOLOGY_PRESET_REGISTRY_VERSION = "1"',
  'TECHNOLOGY_PRESET_REGISTRY_SIGNATURE = "Tehkné Solutions"',
  "TechnologyPresetRuntimeAdapter",
  "TechnologyPresetDefinition",
  "TechnologyPresetManifest",
  "parseTechnologyPresetManifest",
  "TechnologyPresetRegistry",
  "resolveUtterance",
  "getByAdapter",
  "route alias collision",
  "persistenceKey must match runtimeAdapter",
  "repeats presetId",
  "repeats projectId",
  "unsupported runtimeAdapter"
]) {
  if (!runtime.includes(token)) throw new Error(`S2.8 registry runtime contract missing: ${token}`);
}

const manifest = JSON.parse(await readFile("registry/technology-presets/v1.json", "utf8"));
if (manifest.registryId !== "tehkne-technology-presets-v1") throw new Error("S2.8 registry identity mismatch");
if (manifest.registryVersion !== "1") throw new Error("S2.8 registry version mismatch");
if (manifest.signature !== "Tehkné Solutions") throw new Error("S2.8 registry signature missing");
if (manifest.presets?.length !== 6) throw new Error(`S2.8 registry requires six current presets, got ${manifest.presets?.length}`);
const expected = new Map([
  ["desktop", ["desktop-pc", "desktop-pc-001", "pc.root"]],
  ["arm", ["arm-01", "arm-01", "arm.workcell"]],
  ["smartphone", ["smartphone-01", "smartphone-01", "phone.root"]],
  ["notebook", ["notebook-01", "notebook-01", "notebook.root"]],
  ["tablet", ["tablet-01", "tablet-01", "tablet.root"]],
  ["tv", ["tv-01", "tv-01", "tv.root"]]
]);
for (const preset of manifest.presets) {
  const contract = expected.get(preset.runtimeAdapter);
  if (!contract) throw new Error(`S2.8 unexpected runtime adapter in manifest: ${preset.runtimeAdapter}`);
  if (preset.presetId !== contract[0] || preset.projectId !== contract[1] || preset.rootEntityId !== contract[2]) {
    throw new Error(`S2.8 registry identity mismatch for ${preset.runtimeAdapter}`);
  }
  if (preset.persistenceKey !== preset.runtimeAdapter) throw new Error(`S2.8 persistence key mismatch for ${preset.presetId}`);
  if (preset.signature !== "Tehkné Solutions" || preset.version !== "1" || preset.status !== "alpha-ready") {
    throw new Error(`S2.8 signed alpha-ready contract missing for ${preset.presetId}`);
  }
  if (!preset.launcherLabel || !preset.restoreLabel || !preset.sourcePath || !preset.routeAliases?.length) {
    throw new Error(`S2.8 launcher/routing metadata incomplete for ${preset.presetId}`);
  }
  expected.delete(preset.runtimeAdapter);
}
if (expected.size !== 0) throw new Error(`S2.8 missing runtime adapters: ${[...expected.keys()].join(", ")}`);

const domain = await readFile("tests/domain/technology-preset-registry.test.mjs", "utf8");
for (const token of [
  "cross-checks source identity",
  "routing are deterministic across accents and longest aliases",
  "generic component term must not guess product family",
  "fails closed on signature version adapter persistence and duplicate identity errors",
  "refuses ambiguous route aliases across products"
]) {
  if (!domain.includes(token)) throw new Error(`S2.8 domain evidence missing: ${token}`);
}

const singleton = await readFile("apps/studio-web/lib/technologyPresetRegistry.ts", "utf8");
for (const token of ["TechnologyPresetRegistry", "technologyPresetManifest", "new TechnologyPresetRegistry"]) {
  if (!singleton.includes(token)) throw new Error(`S2.8 Studio registry singleton missing: ${token}`);
}

const launcher = await readFile("apps/studio-web/components/TechnologyPresetLauncher.tsx", "utf8");
for (const token of [
  "technologyPresetRegistry.list()",
  "preset.launcherLabel",
  "preset.restoreLabel",
  "preset.runtimeAdapter",
  "preset.persistenceKey",
  "data-preset-registry",
  "data-preset-count",
  "data-preset-id",
  "data-project-id",
  "data-restore-preset-id",
  "Projeto vazio · em breve"
]) {
  if (!launcher.includes(token)) throw new Error(`S2.8 registry launcher contract missing: ${token}`);
}
for (const hardcoded of [
  "Chamar Desktop PC",
  "Chamar ARM-01",
  "Chamar Smartphone 01",
  "Chamar Notebook 01",
  "Chamar Tablet 01",
  "Chamar TV 01",
  "Restaurar Desktop salvo",
  "Restaurar TV salva"
]) {
  if (launcher.includes(hardcoded)) throw new Error(`S2.8 launcher must not hard-code preset label: ${hardcoded}`);
}

const workbench = await readFile("apps/studio-web/components/SpatialWorkbench.tsx", "utf8");
for (const token of [
  "TechnologyPresetRuntimeAdapter",
  "TechnologyPresetLauncher",
  "technologyPresetRegistry.getByAdapter(product).displayName",
  "technologyPresetRegistry.resolveUtterance(trimmed)",
  "registryPreset?.runtimeAdapter",
  "savedProjects={savedProjects}",
  "onLaunch={switchProduct}",
  "onRestore={restoreProject}"
]) {
  if (!workbench.includes(token)) throw new Error(`S2.8 Workbench registry integration missing: ${token}`);
}
for (const deprecated of ["const looksNotebook", "const looksTablet", "const looksTv", "const looksSmartphone"]) {
  if (workbench.includes(deprecated)) throw new Error(`S2.8 hard-coded product routing returned: ${deprecated}`);
}
if (!workbench.includes("const looksRobotic")) throw new Error("S2.8 ARM task-intent routing must remain explicit until robotics routing is registry-capable");

const browser = await readFile("tests/browser/technology-preset-registry.spec.ts", "utf8");
for (const token of [
  "tehkne-technology-presets-v1",
  'data-preset-count", "6"',
  "button[data-preset-id]",
  "data-restore-preset-id",
  "Abra o computador",
  "Abra a televisão",
  "Abra o laptop",
  "Inspecione a bateria",
  "THE FIRST WORKBENCH"
]) {
  if (!browser.includes(token)) throw new Error(`S2.8 browser evidence missing: ${token}`);
}

const tsconfig = await readFile("tsconfig.core.json", "utf8");
if (!tsconfig.includes("packages/technology-preset-registry/src/**/*.ts")) throw new Error("S2.8 registry runtime is not part of strict core typecheck/build");

const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
if (rootPackage.scripts?.["verify:s2.8"] !== "node scripts/verify-s2.8.mjs") throw new Error("S2.8 package verification script missing");

const workflow = await readFile(".github/workflows/ci.yml", "utf8");
for (const token of ["S2.8 Technology Preset Registry Gate", "npm run verify:s2.8", "npm run verify:s2.7", "npm run smoke:browser"]) {
  if (!workflow.includes(token)) throw new Error(`S2.8 accumulated CI contract missing: ${token}`);
}
if (workflow.includes("contents: write")) throw new Error("S2.8 final CI must remain read-only");

console.log("S2.8 Technology Preset Registry PASS · six signed presets · registry-driven launcher + labels + product routing · source identity + persistence invariants · Tehkné Solutions");
