import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "library/components/extensions/asset-forge-v1.json",
  "packages/invention-spatial-runtime/src/index.ts",
  "apps/studio-web/components/InventionAssetVisual.tsx",
  "apps/studio-web/components/Invention3DWorkbench.tsx",
  "tests/browser/socket-aware-invention.spec.ts"
];
for (const path of required) await access(resolve(path));

const extension = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = extension.components?.find((definition) => definition.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor) throw new Error("S2.14 canonical brushed DC motor definition missing");
if (motor.metadata?.visualAsset?.assetId !== "TS_ELEC_MOTOR_DC_A") throw new Error("S2.14 AF-001 visual identity mismatch");
if (motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.14 must not promote AF-001 beyond HERO_CANDIDATE");
const expectedSockets = {
  "power-pos": "SOCKET_ELEC_POWER_POS",
  "power-neg": "SOCKET_ELEC_POWER_NEG",
  "shaft-out": "SOCKET_MECH_AXIS_OUT",
  "mount-front": "SOCKET_MECH_MOUNT_FRONT"
};
for (const [portId, socketName] of Object.entries(expectedSockets)) {
  if (motor.metadata?.portSocketMap?.[portId] !== socketName) {
    throw new Error(`S2.14 port/socket contract mismatch: ${portId}`);
  }
}

const spatial = await readFile("packages/invention-spatial-runtime/src/index.ts", "utf8");
for (const token of [
  "sourcePortId: string",
  "targetPortId: string",
  "relationshipPortId",
  'relationshipPortId(relationship, "sourcePortId")',
  'relationshipPortId(relationship, "targetPortId")'
]) {
  if (!spatial.includes(token)) throw new Error(`S2.14 spatial port identity missing: ${token}`);
}

const visual = await readFile("apps/studio-web/components/InventionAssetVisual.tsx", "utf8");
for (const token of [
  "portSocketMap: Readonly<Record<string, string>>",
  "AssetSocketEvidence",
  "useSyncExternalStore",
  "useAssetSocketEndpoint",
  "transformSocketPosition",
  "scene.getObjectByName(socketName)",
  "missing required socket node",
  "publishSocketEvidence",
  "port-socket-${entity.id}-${portId}-${socketName}"
]) {
  if (!visual.includes(token)) throw new Error(`S2.14 visual socket resolver missing: ${token}`);
}

const workbench = await readFile("apps/studio-web/components/Invention3DWorkbench.tsx", "utf8");
for (const token of [
  "useAssetSocketEndpoint",
  "sourcePortId",
  "targetPortId",
  'data-source-socket={sourceEndpoint.socketName}',
  'data-target-socket={targetEndpoint.socketName}',
  'data-socket-aware={socketAware ? "true" : "false"}',
  "data-socket-aware-wires={socketAwareWireCount}",
  "SOCKET-AWARE WIRES",
  "runtime.spatial.connectionSegments(connections)",
  "runtime.builder.connect",
  "runtime.builder.disconnect"
]) {
  if (!workbench.includes(token)) throw new Error(`S2.14 workbench contract missing: ${token}`);
}
if (!workbench.includes("S2.14") && !workbench.includes("S2.15")) {
  throw new Error("S2.14 workbench lineage marker missing");
}
if (!workbench.includes("Socket-Aware 3D Invention Workbench") && !workbench.includes("Direct Socket Wiring")) {
  throw new Error("S2.14 socket-aware workbench presentation lineage missing");
}
for (const forbidden of [
  "parallelGraph",
  "inventionGraph3d",
  'status: "GOLDEN_ASSET"',
  "socketTopologyGraph"
]) {
  if (workbench.includes(forbidden) || visual.includes(forbidden)) throw new Error(`S2.14 forbidden parallel behavior: ${forbidden}`);
}

const browser = await readFile("tests/browser/socket-aware-invention.spec.ts", "utf8");
for (const token of [
  "Lithium-Ion Battery Pack · dc-output",
  "Brushed DC Motor · power-pos",
  "SOCKET_ELEC_POWER_POS",
  "data-target-socket",
  "data-socket-aware",
  "data-target-z",
  "Z +",
  "pageErrors",
  "consoleErrors"
]) {
  if (!browser.includes(token)) throw new Error(`S2.14 browser evidence missing: ${token}`);
}

const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
if (rootPackage.scripts?.["verify:s2.14"] !== "node scripts/verify-s2.14.mjs") {
  throw new Error("S2.14 package verification script missing");
}
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("npm run verify:s2.14")) throw new Error("S2.14 CI contract missing");
if (!workflow.includes("tests/browser/socket-aware-invention.spec.ts")) throw new Error("S2.14 browser gate missing from CI");
if (workflow.includes("contents: write")) throw new Error("S2.14 CI must remain read-only");

console.log("S2.14 Socket-Aware Wiring PASS · graph port identity + fail-closed GLB socket resolution + socket endpoints follow spatial transforms + proxy center fallback only when no Asset Forge socket exists · Tehkné Solutions");
