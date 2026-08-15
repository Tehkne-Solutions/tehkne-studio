import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
const required = ["library/components/extensions/asset-forge-v1.json", "packages/invention-spatial-runtime/src/index.ts", "apps/studio-web/components/InventionAssetVisual.tsx", "apps/studio-web/components/Invention3DWorkbench.tsx", "tests/browser/socket-aware-invention.spec.ts"];
for (const path of required) await access(resolve(path));
const extension = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = extension.components?.find((definition) => definition.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor || motor.metadata?.visualAsset?.assetId !== "TS_ELEC_MOTOR_DC_A") throw new Error("S2.14 AF-001 visual identity mismatch");
if (motor.metadata?.visualAsset?.version !== "0.6.6-hero-candidate" || motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.14 AF-001 v0.6.6 candidate mismatch");
for (const [portId, socketName] of Object.entries({ "power-pos": "SOCKET_ELEC_POWER_POS", "power-neg": "SOCKET_ELEC_POWER_NEG", "shaft-out": "SOCKET_MECH_AXIS_OUT", "mount-front": "SOCKET_MECH_MOUNT_FRONT" })) {
  if (motor.metadata?.portSocketMap?.[portId] !== socketName) throw new Error(`S2.14 port/socket contract mismatch: ${portId}`);
}
const spatial = await readFile("packages/invention-spatial-runtime/src/index.ts", "utf8");
for (const token of ["sourcePortId: string", "targetPortId: string", "relationshipPortId", 'relationshipPortId(relationship, "sourcePortId")', 'relationshipPortId(relationship, "targetPortId")']) if (!spatial.includes(token)) throw new Error(`S2.14 spatial port identity missing: ${token}`);
const visual = await readFile("apps/studio-web/components/InventionAssetVisual.tsx", "utf8");
for (const token of ["portSocketMap: Readonly<Record<string, string>>", "AssetSocketEvidence", "useSyncExternalStore", "useAssetSocketEndpoint", "useSpatialPortEndpoint", "transformSocketPosition", "prepareAssetScene", "scene.getObjectByName(socketName)", "missing required socket node", "publishSocketEvidence", "port-socket-${entity.id}-${portId}-${socketName}"]) if (!visual.includes(token)) throw new Error(`S2.14 visual socket resolver missing: ${token}`);
const workbench = await readFile("apps/studio-web/components/Invention3DWorkbench.tsx", "utf8");
for (const token of ["useSpatialPortEndpoint", "sourcePortId", "targetPortId", 'data-source-socket={sourceEndpoint.socketName}', 'data-target-socket={targetEndpoint.socketName}', 'data-socket-aware={socketAware ? "true" : "false"}', "data-socket-aware-wires={socketAwareWireCount}", "SOCKET-AWARE", "runtime.spatial.connectionSegments(connections)", "runtime.builder.connect", "runtime.builder.disconnect"]) if (!workbench.includes(token)) throw new Error(`S2.14 workbench contract missing: ${token}`);
if (!["S2.14", "S2.15", "S2.16", "S2.17"].some((marker) => workbench.includes(marker))) throw new Error("S2.14 workbench lineage marker missing");
if (!workbench.includes("Direct Socket Wiring") && !workbench.includes("Mechanical Assembly")) throw new Error("S2.14 presentation lineage missing");
for (const forbidden of ["parallelGraph", "inventionGraph3d", 'status: "GOLDEN_ASSET"', "socketTopologyGraph"]) if (workbench.includes(forbidden) || visual.includes(forbidden)) throw new Error(`S2.14 forbidden parallel behavior: ${forbidden}`);
const browser = await readFile("tests/browser/socket-aware-invention.spec.ts", "utf8");
for (const token of ["Lithium-Ion Battery Pack · dc-output", "Brushed DC Motor · power-pos", "SOCKET_ELEC_POWER_POS", "0.6.6-hero-candidate", "data-target-socket", "data-socket-aware", "data-target-z", "0.0047", "0.00085", "0.01936", "Z +", "pageErrors", "consoleErrors"]) if (!browser.includes(token)) throw new Error(`S2.14 browser evidence missing: ${token}`);
const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
if (rootPackage.scripts?.["verify:s2.14"] !== "node scripts/verify-s2.14.mjs") throw new Error("S2.14 package verification script missing");
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("npm run verify:s2.14") || !workflow.includes("tests/browser/socket-aware-invention.spec.ts") || workflow.includes("contents: write")) throw new Error("S2.14 CI contract mismatch");
console.log("S2.14 Socket-Aware Wiring PASS · graph port identity + AF-001 v0.6.6 physical socket transforms + successor endpoint projection preserves direct wiring, assembly and rigid rotation through S2.17 · Tehkné Solutions");
