import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { ArmFailureLab } from "../../dist/packages/studio-failure/src/index.js";
import { ArmVariantLab } from "../../dist/packages/studio-variants/src/index.js";
import { StudioIntelligence } from "../../dist/packages/studio-intelligence/src/index.js";
import { resolveStudioIntent } from "../../dist/packages/intelligence-runtime/src/index.js";

const project = JSON.parse(await readFile(new URL("../../presets/arm-01/project.json", import.meta.url), "utf8"));
const base = JSON.parse(await readFile(new URL("../../presets/arm-01/failure-profile.json", import.meta.url), "utf8"));
const candidate = JSON.parse(await readFile(new URL("../../presets/arm-01/variants/high-torque-profile.json", import.meta.url), "utf8"));
const freshProject = () => JSON.parse(JSON.stringify(project));

test("S1.10 natural language resolves redesign request as a variant task", () => {
  const session = new EngineeringSession(freshProject());
  const entities = session.graph.snapshot().entities.map((entity) => ({
    id: entity.id,
    type: entity.type,
    name: entity.name,
    state: entity.state,
    capabilityIds: entity.capabilities.map((capability) => capability.id),
    propertyIds: Object.keys(entity.properties),
    aliases: Array.isArray(entity.metadata.voiceAliases) ? entity.metadata.voiceAliases : []
  }));
  const resolution = resolveStudioIntent("Crie uma versão capaz de levantar esse peso", { entities });

  assert.equal(resolution.status, "resolved");
  assert.equal(resolution.action, "variantTask");
  assert.equal(resolution.targetEntityId, "arm.root");
  assert.equal(resolution.variantTaskDraft.kind, "highTorque");
});

test("S1.10 Studio Intelligence refuses redesign without fault evidence, then creates validated variant", async () => {
  const session = new EngineeringSession(freshProject());
  const failureLab = new ArmFailureLab(session, base);
  const variants = new ArmVariantLab(failureLab, base, candidate);
  const intelligence = new StudioIntelligence(session, undefined, undefined, variants);

  const beforeFailure = await intelligence.executeUtterance("Crie uma versão capaz de levantar esse peso");
  assert.equal(beforeFailure.executed, false);
  assert.match(beforeFailure.message, /experimento de falha anterior/);

  failureLab.run(1.6);
  const result = await intelligence.executeUtterance("Crie uma versão capaz de levantar esse peso");
  assert.equal(result.executed, true);
  assert.equal(result.variantTask.variantId, "arm-01/high-torque");
  assert.equal(result.variantTask.validationStatus, "pass");
  assert.equal(variants.latest().comparison.base.assessment.status, "fault");
  assert.equal(variants.latest().comparison.candidate.assessment.status, "pass");
});
