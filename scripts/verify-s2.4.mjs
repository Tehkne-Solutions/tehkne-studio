import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "packages/smartphone-runtime/src/index.ts",
  "presets/smartphone-01/profile.json",
  "tests/domain/smartphone-runtime.test.mjs",
  "apps/studio-web/components/SmartphoneAssembly.tsx",
  "tests/browser/smartphone.spec.ts"
];
for (const path of required) await access(resolve(path));

const profile = JSON.parse(await readFile("presets/smartphone-01/profile.json", "utf8"));
if (profile.profileId !== "smartphone-01-v1") throw new Error("S2.4 Smartphone profile identity mismatch");
if (profile.projectId !== "smartphone-01") throw new Error("S2.4 Smartphone project identity mismatch");
if (profile.signature !== "Tehkné Solutions") throw new Error("S2.4 Smartphone profile signature missing");
if (profile.root?.id !== "phone.root" || profile.root?.type !== "Smartphone") throw new Error("S2.4 Smartphone root contract invalid");
if (profile.slots?.length !== 11) throw new Error(`S2.4 Smartphone must materialize 11 component slots, got ${profile.slots?.length}`);
if (profile.connections?.length !== 15) throw new Error(`S2.4 Smartphone must declare 15 validated connections, got ${profile.connections?.length}`);
if (profile.bootDependencies?.length !== 6) throw new Error("S2.4 Smartphone boot dependencies changed unexpectedly");
const slots = new Map(profile.slots.map((slot) => [slot.slotId, slot]));
for (const [slotId, definitionId] of Object.entries({
  frame: "structural.frame.modular-v1",
  battery: "energy.battery.lithium-ion-v1",
  regulator: "power.regulator.dc-v1",
  soc: "compute.soc.mobile-v1",
  memory: "memory.lpddr.package-v1",
  storage: "storage.solid-state.general-v1",
  display: "display.oled.touch-v1",
  imu: "sensing.imu.6dof-v1",
  camera: "sensing.camera.rgb-v1",
  wireless: "communication.wireless.combo-v1",
  usbC: "interface.usb-c.port-v1"
})) {
  if (slots.get(slotId)?.definitionId !== definitionId) throw new Error(`S2.4 canonical slot mismatch: ${slotId}`);
}
if (slots.get("battery")?.teardown !== true) throw new Error("S2.4 battery must remain a contextual teardown component");

const runtime = await readFile("packages/smartphone-runtime/src/index.ts", "utf8");
for (const token of [
  'SMARTPHONE_SIGNATURE = "Tehkné Solutions"',
  "SmartphonePresetProfile",
  "validateSmartphoneProfile",
  "createSmartphoneProject",
  "portsAreCompatible",
  "registry.instantiate",
  'validatedBy: "component-library"',
  'materializedFrom: "tehkne-universal-components-v1"',
  "contextualTeardown",
  'battery: ["bateria"',
  'display: ["tela"',
  'camera: ["camera"',
  'wireless: ["wifi"'
]) {
  if (!runtime.includes(token)) throw new Error(`S2.4 Smartphone runtime contract missing: ${token}`);
}
for (const failClosedToken of [
  "Invalid smartphone profile",
  "uses incompatible interfaces",
  "references unknown slot",
  "is not declared for smartphone products"
]) {
  if (!runtime.includes(failClosedToken)) throw new Error(`S2.4 fail-closed product rule missing: ${failClosedToken}`);
}

const domain = await readFile("tests/domain/smartphone-runtime.test.mjs", "utf8");
for (const token of [
  "materializes from Universal Component Library with validated interfaces",
  "functional boot succeeds",
  "battery teardown creates causal POST failure",
  "incompatible interfaces before project materialization",
  "boot graph depends only on declared essential component slots"
]) {
  if (!domain.includes(token)) throw new Error(`S2.4 domain evidence missing: ${token}`);
}

const assembly = await readFile("apps/studio-web/components/SmartphoneAssembly.tsx", "utf8");
for (const token of [
  "SmartphoneAssembly",
  'session.getEntity("phone.root")',
  'entity.metadata.spatial',
  'root.state === "exploded"',
  'entity.state === "removed"',
  "createSpatialBinding",
  "resolveSpatialSelection"
]) {
  if (!assembly.includes(token)) throw new Error(`S2.4 Smartphone spatial UX missing: ${token}`);
}

const workbench = await readFile("apps/studio-web/components/SpatialWorkbench.tsx", "utf8");
for (const token of [
  "ComponentRegistry",
  "createSmartphoneProject",
  "createSmartphoneRuntime",
  "smartphoneSession",
  "smartphoneIntelligence",
  '<SmartphoneAssembly session={smartphoneSession}',
  "Chamar Smartphone 01",
  "Restaurar Smartphone salvo",
  'saveBrowserProject("smartphone"',
  'loadBrowserProject(product)',
  'looksSmartphone',
  'execution.targetEntityId?.startsWith("phone.")',
  "SMARTPHONE-01",
  "POWER {smartphonePowerState.toUpperCase()} · BOOT {smartphoneBootStage}"
]) {
  if (!workbench.includes(token)) throw new Error(`S2.4 Workbench integration missing: ${token}`);
}

const persistenceAdapter = await readFile("apps/studio-web/lib/projectPersistence.ts", "utf8");
if (!persistenceAdapter.includes('"desktop" | "arm" | "smartphone"')) throw new Error("S2.4 persistence adapter does not include smartphone");

const browser = await readFile("tests/browser/smartphone.spec.ts", "utf8");
for (const token of [
  "Chamar Smartphone 01",
  "Abra o celular",
  "Tire a bateria",
  "Ligue o celular",
  "Por que não iniciou?",
  "Reinstale a bateria",
  "POWER FAULT · BOOT POST",
  "POWER ON · BOOT RUNNING",
  "Restaurar Smartphone salvo",
  "page.reload",
  "Abra o smartphone"
]) {
  if (!browser.includes(token)) throw new Error(`S2.4 browser golden-flow evidence missing: ${token}`);
}

const tsconfig = await readFile("tsconfig.core.json", "utf8");
if (!tsconfig.includes("packages/smartphone-runtime/src/**/*.ts")) throw new Error("S2.4 Smartphone runtime is not part of core typecheck/build");

console.log("S2.4 Smartphone structure PASS · 11 library components · 15 compatible connections · causal boot + teardown + persistence · Tehkné Solutions");
