import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import {
  TechnologyPresetRegistry,
  parseTechnologyPresetManifest
} from "../../dist/packages/technology-preset-registry/src/index.js";

async function manifest() {
  return readFile("registry/technology-presets/v1.json", "utf8").then(JSON.parse);
}

async function sourceIdentity(sourcePath) {
  const raw = JSON.parse(await readFile(sourcePath, "utf8"));
  return {
    projectId: raw.projectId,
    rootEntityId: raw.rootEntityId ?? raw.root?.id
  };
}

test("S2.8 registry parses six signed alpha-ready technology presets and cross-checks source identity", async () => {
  const raw = await manifest();
  const parsed = parseTechnologyPresetManifest(raw);
  assert.equal(parsed.registryId, "tehkne-technology-presets-v1");
  assert.equal(parsed.registryVersion, "1");
  assert.equal(parsed.signature, "Tehkné Solutions");
  assert.equal(parsed.presets.length, 6);

  for (const preset of parsed.presets) {
    await access(preset.sourcePath);
    const source = await sourceIdentity(preset.sourcePath);
    assert.equal(source.projectId, preset.projectId, `${preset.presetId} projectId diverged from source`);
    assert.equal(source.rootEntityId, preset.rootEntityId, `${preset.presetId} rootEntityId diverged from source`);
    assert.equal(preset.signature, "Tehkné Solutions");
    assert.equal(preset.status, "alpha-ready");
    assert.equal(preset.persistenceKey, preset.runtimeAdapter);
  }
});

test("S2.8 registry lookup and utterance routing are deterministic across accents and longest aliases", async () => {
  const registry = new TechnologyPresetRegistry(await manifest());
  assert.equal(registry.list().length, 6);
  assert.equal(registry.get("desktop-pc").projectId, "desktop-pc-001");
  assert.equal(registry.getByAdapter("tv").displayName, "TV 01");
  assert.equal(registry.resolveUtterance("Abra o computador")?.runtimeAdapter, "desktop");
  assert.equal(registry.resolveUtterance("Abra a televisão")?.runtimeAdapter, "tv");
  assert.equal(registry.resolveUtterance("Quero desmontar o braço robótico")?.runtimeAdapter, "arm");
  assert.equal(registry.resolveUtterance("Ligue o tablete")?.runtimeAdapter, "tablet");
  assert.equal(registry.resolveUtterance("Inspecione o laptop")?.runtimeAdapter, "notebook");
  assert.equal(registry.resolveUtterance("Abra o celular")?.runtimeAdapter, "smartphone");
  assert.equal(registry.resolveUtterance("Inspecione a bateria"), null, "generic component term must not guess product family");
});

test("S2.8 registry fails closed on signature version adapter persistence and duplicate identity errors", async () => {
  const raw = await manifest();
  assert.throws(() => parseTechnologyPresetManifest({ ...raw, signature: "Other" }), /signature must be Tehkné Solutions/);
  assert.throws(() => parseTechnologyPresetManifest({ ...raw, registryVersion: "2" }), /Unsupported Technology Preset Registry version/);

  const badAdapter = structuredClone(raw);
  badAdapter.presets[0].runtimeAdapter = "spaceship";
  assert.throws(() => parseTechnologyPresetManifest(badAdapter), /unsupported runtimeAdapter/);

  const badPersistence = structuredClone(raw);
  badPersistence.presets[0].persistenceKey = "tv";
  assert.throws(() => parseTechnologyPresetManifest(badPersistence), /persistenceKey must match runtimeAdapter/);

  const duplicateId = structuredClone(raw);
  duplicateId.presets[1].presetId = duplicateId.presets[0].presetId;
  assert.throws(() => parseTechnologyPresetManifest(duplicateId), /repeats presetId/);

  const duplicateProject = structuredClone(raw);
  duplicateProject.presets[1].projectId = duplicateProject.presets[0].projectId;
  assert.throws(() => parseTechnologyPresetManifest(duplicateProject), /repeats projectId/);
});

test("S2.8 registry refuses ambiguous route aliases across products", async () => {
  const raw = await manifest();
  const ambiguous = structuredClone(raw);
  ambiguous.presets[1].routeAliases.push("computador");
  assert.throws(() => parseTechnologyPresetManifest(ambiguous), /route alias collision/);
});
