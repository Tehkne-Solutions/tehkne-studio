import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ComponentRegistry, parseComponentCatalog } from "../../dist/packages/component-library/src/index.js";
import { applyComponentCatalogExtension } from "../../dist/packages/component-library/src/extension.js";
import { EngineeringSession } from "../../dist/packages/engineering-session/src/index.js";
import { InventionBuilder, createBlankInventionProject } from "../../dist/packages/invention-runtime/src/index.js";

async function registryWithAf002() {
  const base = parseComponentCatalog(JSON.parse(await readFile("library/components/catalog.json", "utf8")));
  const assetForge = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
  const mechanical = JSON.parse(await readFile("library/components/extensions/mechanical-assembly-v1.json", "utf8"));
  const af002 = JSON.parse(await readFile("library/components/extensions/asset-forge-af002-v1.json", "utf8"));
  return new ComponentRegistry(
    applyComponentCatalogExtension(
      applyComponentCatalogExtension(
        applyComponentCatalogExtension(base, assetForge),
        mechanical
      ),
      af002
    )
  );
}

test("S2.33 preserves AF-002 engineering-reference authority and dual rotary ports through authorized presentation stages", async () => {
  const registry = await registryWithAf002();
  const definition = registry.get("mechanical.coupler.shaft-a-v1");
  assert.ok(definition);
  assert.equal(definition.metadata.assetForgeId, "AF-002");
  assert.equal(definition.metadata.assetForgeSku, "TS_MECH_SHAFT_COUPLER_A");
  assert.ok(["ENGINEERING_REFERENCE", "RUNTIME_CANDIDATE"].includes(definition.metadata.assetForgeStage));
  assert.equal(definition.metadata.signature, "Tehkné Solutions");
  assert.ok(["PROXY_EXPLICIT_ENGINEERING_REFERENCE", "FALLBACK_ONLY_RUNTIME_CANDIDATE"].includes(definition.metadata.spatialProxy.status));
  assert.deepEqual(definition.metadata.spatialProxy.portAnchors["axis-in"].position, [0, 0, -0.0175]);
  assert.deepEqual(definition.metadata.spatialProxy.portAnchors["axis-out"].position, [0, 0, 0.0175]);
  assert.deepEqual(definition.metadata.spatialProxy.portAnchors["axis-in"].axis, [0, 0, -1]);
  assert.deepEqual(definition.metadata.spatialProxy.portAnchors["axis-out"].axis, [0, 0, 1]);
  assert.equal(definition.ports["axis-in"].direction, "in");
  assert.equal(definition.ports["axis-out"].direction, "out");
  assert.deepEqual(definition.ports["axis-in"].compatibility, ["mechanical.rotary-shaft"]);
  assert.deepEqual(definition.ports["axis-out"].compatibility, ["mechanical.rotary-shaft"]);
  assert.equal(definition.metadata.physicalClaims.torqueCapacity, false);
  assert.equal(definition.metadata.physicalClaims.maxRpm, false);
  assert.equal(definition.metadata.physicalClaims.misalignmentCapacity, false);
  assert.equal(definition.metadata.physicalClaims.stiffness, false);
  assert.equal(definition.metadata.physicalClaims.damping, false);
  assert.equal(definition.metadata.physicalClaims.manufacturingCertification, false);
});

test("S2.33 AF-002 participates in two distinct canonical connectedTo relationships without a parallel transmission graph", async () => {
  const registry = await registryWithAf002();
  const session = new EngineeringSession(createBlankInventionProject("af002-dual-shaft"));
  const builder = new InventionBuilder(session, registry);
  const motor = builder.addComponent("actuation.motor.dc-brushed-v1");
  const coupler = builder.addComponent("mechanical.coupler.shaft-a-v1");
  const wheel = builder.addComponent("mechanical.wheel.drive-v1");

  const input = builder.connect(
    { entityId: motor.id, portId: "shaft-out" },
    { entityId: coupler.id, portId: "axis-in" }
  );
  const output = builder.connect(
    { entityId: coupler.id, portId: "axis-out" },
    { entityId: wheel.id, portId: "hub-in" }
  );

  assert.notEqual(input.id, output.id);
  const relationships = session.graph.snapshot().relationships;
  const authored = relationships.filter((entry) => entry.id === input.id || entry.id === output.id);
  assert.equal(authored.length, 2);
  assert.ok(authored.every((entry) => entry.type === "connectedTo"));
  assert.equal(authored.filter((entry) => entry.source === coupler.id || entry.target === coupler.id).length, 2);
  assert.equal(session.graph.snapshot().relationships.some((entry) => entry.type === "transmissionGraph"), false);
});