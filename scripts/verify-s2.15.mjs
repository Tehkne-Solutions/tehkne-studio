import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "library/components/extensions/asset-forge-v1.json",
  "packages/invention-runtime/src/index.ts",
  "apps/studio-web/components/InventionAssetVisual.tsx",
  "apps/studio-web/components/Invention3DWorkbench.tsx",
  "tests/browser/direct-socket-wiring.spec.ts"
];
for (const path of required) await access(resolve(path));

const extension = JSON.parse(await readFile("library/components/extensions/asset-forge-v1.json", "utf8"));
const motor = extension.components?.find((definition) => definition.definitionId === "actuation.motor.dc-brushed-v1");
if (!motor) throw new Error("S2.15 canonical brushed DC motor definition missing");
if (motor.metadata?.visualAsset?.assetId !== "TS_ELEC_MOTOR_DC_A") throw new Error("S2.15 AF-001 visual identity mismatch");
if (motor.metadata?.visualAsset?.status !== "HERO_CANDIDATE") throw new Error("S2.15 must not promote AF-001 beyond HERO_CANDIDATE");
if (motor.ports?.["power-pos"]?.direction !== "bidirectional") throw new Error("S2.15 requires a bidirectional real electrical source socket");
if (motor.metadata?.portSocketMap?.["power-pos"] !== "SOCKET_ELEC_POWER_POS") throw new Error("S2.15 real power-pos socket mapping missing");

const runtime = await readFile("packages/invention-runtime/src/index.ts", "utf8");
for (const token of [
  "compatibleTargets(from: InventionPortRef)",
  "portsAreCompatible(source.port, port)",
  "connect(from: InventionPortRef, to: InventionPortRef)",
  'type: "connectedTo"',
  'validatedBy: "component-library"'
]) {
  if (!runtime.includes(token)) throw new Error(`S2.15 authoritative InventionBuilder contract missing: ${token}`);
}

const visual = await readFile("apps/studio-web/components/InventionAssetVisual.tsx", "utf8");
for (const token of [
  "socketSourceKey",
  "compatibleTargetKeys",
  "onSocketSelect",
  "showSockets = selected || Boolean(socketSourceKey)",
  "socketAuthoringState",
  "event.stopPropagation()",
  "onSocketSelect?.(entity.id, portId)",
  "interactive ? 0.005 : 0.003"
]) {
  if (!visual.includes(token)) throw new Error(`S2.15 interactive Asset Forge socket contract missing: ${token}`);
}

const workbench = await readFile("apps/studio-web/components/Invention3DWorkbench.tsx", "utf8");
for (const token of [
  "Direct Socket Wiring",
  "const selectSocket = (entityId: string, portId: string): void =>",
  "runtime.builder.compatibleTargets(from)",
  "runtime.builder.connect(sourceRef, ref)",
  "Wire criado diretamente por sockets",
  "Engineering Graph permanece autoritativo",
  'data-direct-socket-mode={sourceRef ? "armed" : "idle"}',
  "data-direct-socket-source={sourceKey}",
  'aria-label="Sockets 3D interativos"',
  'data-testid="invention-3d-socket-authoring"',
  "data-socket-state={socketState}",
  "onSocketSelect={selectSocket}",
  "WIRING REAL · FALLBACK ACESSÍVEL",
  "runtime.builder.connect(from, to)",
  "runtime.builder.disconnect"
]) {
  if (!workbench.includes(token)) throw new Error(`S2.15 workbench contract missing: ${token}`);
}
if (!["S2.15", "S2.16", "S2.17"].some((marker) => workbench.includes(marker))) {
  throw new Error("S2.15 workbench lineage marker missing");
}

for (const forbidden of [
  "parallelGraph",
  "socketTopologyGraph",
  "directSocketGraph",
  "inventionGraph3d",
  'status: "GOLDEN_ASSET"'
]) {
  if (workbench.includes(forbidden) || visual.includes(forbidden)) throw new Error(`S2.15 forbidden parallel behavior: ${forbidden}`);
}

const browser = await readFile("tests/browser/direct-socket-wiring.spec.ts", "utf8");
for (const token of [
  "invention.component.1-power-pos",
  "invention.component.2-power-pos",
  "SOCKET_ELEC_POWER_POS",
  'data-direct-socket-mode", "armed"',
  "Wire criado diretamente por sockets",
  "invention-connection-1",
  "data-source-socket",
  "data-target-socket",
  "Guardar 3D",
  "Restaurar 3D",
  "pageErrors",
  "consoleErrors"
]) {
  if (!browser.includes(token)) throw new Error(`S2.15 browser evidence missing: ${token}`);
}

const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
if (rootPackage.scripts?.["verify:s2.15"] !== "node scripts/verify-s2.15.mjs") {
  throw new Error("S2.15 package verification script missing");
}
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
if (!workflow.includes("npm run verify:s2.15")) throw new Error("S2.15 CI contract missing");
if (!workflow.includes("tests/browser/direct-socket-wiring.spec.ts")) throw new Error("S2.15 browser gate missing from CI");
if (workflow.includes("contents: write")) throw new Error("S2.15 CI must remain read-only");

console.log("S2.15 Direct Socket Wiring PASS · real Asset Forge sockets remain interactive authoring controls through S2.17 · compatibility and connectedTo remain InventionBuilder-owned · accessible rail mirrors the same handler · legacy select wiring preserved as fallback · no parallel graph · Tehkné Solutions");
