import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const extension = JSON.parse(await readFile("library/components/extensions/asset-forge-af002-v1.json", "utf8"));
const component = extension.components.find((entry) => entry.definitionId === "mechanical.coupler.shaft-a-v1");
assert.ok(component, "AF-002 component missing");
const metadata = component.metadata;
assert.equal(metadata.assetForgeStage, "RUNTIME_CANDIDATE");
assert.equal(metadata.visualAsset.kind, "gltf");
assert.equal(metadata.visualAsset.runtimeUrl, "/api/asset-forge/af002/coupler");
assert.equal(metadata.visualAsset.bytes, 22600);
assert.equal(metadata.visualAsset.sha256, "48e8363cdc38b5ae93ace0b975c42498663e03c922970fb2b60e80c65d26b50e");
assert.equal(metadata.visualAsset.triangles, 1792);
assert.equal(metadata.portSocketMap["axis-in"], "SOCKET_MECH_AXIS_IN");
assert.equal(metadata.portSocketMap["axis-out"], "SOCKET_MECH_AXIS_OUT");
assert.deepEqual(metadata.mechanicalPortPositionMap["axis-in"], [0, 0, -0.0175]);
assert.deepEqual(metadata.mechanicalPortPositionMap["axis-out"], [0, 0, 0.0175]);
assert.deepEqual(metadata.mechanicalPortAxisMap["axis-in"], [0, 0, -1]);
assert.deepEqual(metadata.mechanicalPortAxisMap["axis-out"], [0, 0, 1]);

const review = await readFile("apps/studio-web/components/Af002RuntimeVisualReview.tsx", "utf8");
assert.match(review, /\/api\/asset-forge\/af001\/motor\/lod0/);
assert.match(review, /\/api\/asset-forge\/af002\/coupler/);
assert.match(review, /SOCKET_MECH_AXIS_OUT/);
assert.match(review, /SOCKET_MECH_AXIS_IN/);
assert.match(review, /data-topology="connectedTo"/);
assert.match(review, /endpointGapM\.toFixed\(6\)/);
assert.match(review, /MOTOR_CENTER_Z = COUPLER_AXIS_IN_Z - MOTOR_SHAFT_OUT_Z/);

const page = await readFile("apps/studio-web/app/asset-forge/af002/page.tsx", "utf8");
assert.match(page, /Af002RuntimeVisualReview/);

for (const claim of ["torqueCapacity", "maxRpm", "stiffness", "damping", "manufacturingCertification"]) {
  assert.equal(metadata.physicalClaims[claim], false, `${claim} must remain unclaimed`);
}

console.log("AF002_RUNTIME_VISUAL_SNAP PASS triangles=1792 endpointGap=0.000000m");
console.log("Tehkné Solutions");
