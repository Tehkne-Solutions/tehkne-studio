import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const required = [
  "apps/studio-web/app/page.tsx",
  "apps/studio-web/components/SpatialWorkbench.tsx",
  "apps/studio-web/components/DesktopPcAssembly.tsx",
  "apps/studio-web/components/BehaviorPanel.tsx",
  "apps/studio-web/components/BehaviorPanel.module.css",
  "apps/studio-web/components/Arm01Assembly.tsx",
  "apps/studio-web/components/ArmRuntimePanel.tsx",
  "apps/studio-web/components/ArmRuntimePanel.module.css",
  "apps/studio-web/lib/browserSpeech.ts",
  "apps/studio-web/next.config.mjs",
  "packages/engineering-core/src/index.ts",
  "packages/engineering-graph/src/index.ts",
  "packages/behavior-runtime/src/index.ts",
  "packages/project-format/src/index.ts",
  "packages/command-bus/src/index.ts",
  "packages/observability/src/index.ts",
  "packages/spatial-runtime/src/index.ts",
  "packages/simulation-runtime/src/index.ts",
  "packages/robotics-runtime/src/index.ts",
  "packages/engineering-session/src/index.ts",
  "packages/studio-behavior/src/index.ts",
  "packages/studio-robotics/src/index.ts",
  "packages/intelligence-runtime/src/index.ts",
  "packages/studio-intelligence/src/index.ts",
  "presets/desktop-pc/project.json",
  "presets/arm-01/project.json",
  "tests/domain/spatial-runtime.test.mjs",
  "tests/domain/engineering-session.test.mjs",
  "tests/domain/desktop-pc-system.test.mjs",
  "tests/domain/simulation-runtime.test.mjs",
  "tests/domain/causal-boot.test.mjs",
  "tests/domain/intelligence-runtime.test.mjs",
  "tests/domain/studio-intelligence.test.mjs",
  "tests/domain/behavior-runtime.test.mjs",
  "tests/domain/studio-behavior.test.mjs",
  "tests/domain/robotics-runtime.test.mjs",
  "tests/domain/studio-robotics.test.mjs",
  "tests/domain/studio-robotics-intelligence.test.mjs",
  ".github/workflows/ci.yml"
];

for (const path of required) await access(resolve(path));

const desktop = JSON.parse(await readFile("presets/desktop-pc/project.json", "utf8"));
if (desktop.schemaVersion !== "0.1") throw new Error("Desktop preset schemaVersion must be 0.1");
if (desktop.metadata?.signature !== "Tehkné Solutions") throw new Error("Desktop official signature missing");
if (desktop.metadata?.maturity !== "behavior-runtime") throw new Error("Desktop behavior-runtime maturity missing");
if (!Array.isArray(desktop.behaviors)) throw new Error("Desktop Behavior IR collection missing");

const requiredPhysicalIds = [
  "pc.motherboard", "pc.cpu", "pc.ram.01", "pc.gpu", "pc.psu", "pc.storage", "pc.cooling"
];
for (const id of requiredPhysicalIds) {
  const entity = desktop.entities?.find((candidate) => candidate.id === id);
  if (!entity) throw new Error(`Desktop subsystem missing: ${id}`);
  if (!entity.metadata?.spatial) throw new Error(`Spatial metadata missing: ${id}`);
  if (!entity.metadata?.simpleExplanation) throw new Error(`Learning explanation missing: ${id}`);
}

const desktopRelationshipTypes = new Set(desktop.relationships?.map((relationship) => relationship.type));
for (const type of ["contains", "poweredBy", "connectedTo", "mountedTo", "dependsOn"]) {
  if (!desktopRelationshipTypes.has(type)) throw new Error(`Desktop engineering relationship missing: ${type}`);
}

const desktopRoot = desktop.entities.find((entity) => entity.id === "pc.root");
if (!desktopRoot?.properties?.powerState) throw new Error("Root powerState property missing");
if (!desktopRoot.capabilities?.some((capability) => capability.id === "powerOn")) throw new Error("Power On capability missing");
const ram = desktop.entities.find((entity) => entity.id === "pc.ram.01");
if (!ram?.properties?.capacity) throw new Error("RAM inspect benchmark property missing");
if (!ram.capabilities?.some((capability) => capability.id === "insert")) throw new Error("RAM reinstall capability missing");
const cpu = desktop.entities.find((entity) => entity.id === "pc.cpu");
for (const property of ["temperatureC", "loadPercent"]) {
  if (!cpu?.properties?.[property]) throw new Error(`CPU behavior signal missing: ${property}`);
}
const cooling = desktop.entities.find((entity) => entity.id === "pc.cooling");
if (!cooling?.properties?.fanPercent) throw new Error("Cooling fanPercent actuator state missing");
if (!cooling.capabilities?.some((capability) => capability.id === "setFanSpeed")) throw new Error("Cooling setFanSpeed capability missing");
const boot = desktop.entities.find((entity) => entity.id === "pc.boot");
for (const property of ["status", "stage", "faultCode", "faultEntityId", "faultReason"]) {
  if (!boot?.properties?.[property]) throw new Error(`Boot state property missing: ${property}`);
}
if (!boot.capabilities?.some((capability) => capability.id === "why")) throw new Error("Boot why capability missing");

const arm = JSON.parse(await readFile("presets/arm-01/project.json", "utf8"));
if (arm.schemaVersion !== "0.1") throw new Error("ARM-01 schemaVersion must be 0.1");
if (arm.projectType !== "invention") throw new Error("ARM-01 must be an invention project");
if (arm.metadata?.signature !== "Tehkné Solutions") throw new Error("ARM-01 official signature missing");
if (arm.metadata?.maturity !== "robotic-pick-runtime") throw new Error("ARM-01 runtime maturity missing");
if (!Array.isArray(arm.behaviors)) throw new Error("ARM-01 project must remain Behavior IR compatible");

const armIds = [
  "arm.workcell", "arm.root", "arm.joint.base", "arm.joint.shoulder", "arm.link.upper",
  "arm.joint.elbow", "arm.link.forearm", "arm.gripper", "arm.controller", "arm.sensor.object", "object.cube.red"
];
for (const id of armIds) {
  if (!arm.entities.find((entity) => entity.id === id)) throw new Error(`ARM-01 entity missing: ${id}`);
}
const robot = arm.entities.find((entity) => entity.id === "arm.root");
if (!robot.capabilities?.some((capability) => capability.id === "pick")) throw new Error("ARM-01 pick capability missing");
const geometry = robot.metadata?.geometry;
for (const key of ["baseHeight", "upperArmLength", "forearmLength"]) {
  if (typeof geometry?.[key] !== "number") throw new Error(`ARM-01 geometry missing: ${key}`);
}
for (const jointId of ["arm.joint.base", "arm.joint.shoulder", "arm.joint.elbow"]) {
  const joint = arm.entities.find((entity) => entity.id === jointId);
  for (const property of ["angleDeg", "targetDeg", "minDeg", "maxDeg"]) {
    if (!joint?.properties?.[property]) throw new Error(`${jointId} missing ${property}`);
  }
  if (!joint.capabilities?.some((capability) => capability.id === "setJointTarget")) {
    throw new Error(`${jointId} setJointTarget capability missing`);
  }
}
const gripper = arm.entities.find((entity) => entity.id === "arm.gripper");
if (!gripper?.properties?.openingMm || !gripper?.properties?.holdingEntityId) throw new Error("ARM-01 gripper state missing");
if (!gripper.capabilities?.some((capability) => capability.id === "setGripperOpening")) throw new Error("ARM-01 gripper actuation missing");
const cube = arm.entities.find((entity) => entity.id === "object.cube.red");
for (const property of ["xM", "yM", "zM", "sizeM", "massKg", "attachedTo"]) {
  if (!cube?.properties?.[property]) throw new Error(`ARM workpiece missing ${property}`);
}
if (!cube.metadata?.voiceAliases?.includes("cubo vermelho")) throw new Error("ARM workpiece voice alias missing");
const sensor = arm.entities.find((entity) => entity.id === "arm.sensor.object");
if (sensor?.properties?.detected?.value !== true) throw new Error("ARM object sensor benchmark must detect the canonical workpiece");
const armRelationshipTypes = new Set(arm.relationships?.map((relationship) => relationship.type));
for (const type of ["contains", "mountedTo", "controlledBy", "moves", "reads"]) {
  if (!armRelationshipTypes.has(type)) throw new Error(`ARM engineering relationship missing: ${type}`);
}

const projectFormat = await readFile("packages/project-format/src/index.ts", "utf8");
if (!projectFormat.includes("behaviors?: readonly BehaviorDefinition[]")) throw new Error("Behavior IR is not first-class in project format");
const graphRuntime = await readFile("packages/engineering-graph/src/index.ts", "utf8");
if (!graphRuntime.includes('"attachedTo"')) throw new Error("Engineering Graph cannot represent physical workpiece attachment");

const behaviorRuntime = await readFile("packages/behavior-runtime/src/index.ts", "utf8");
for (const token of ["BehaviorDefinition", "BehaviorThresholdCondition", "BehaviorCapabilityAction", "evaluateChange"]) {
  if (!behaviorRuntime.includes(token)) throw new Error(`Behavior Runtime contract missing: ${token}`);
}
const studioBehavior = await readFile("packages/studio-behavior/src/index.ts", "utf8");
for (const token of ["StudioBehaviorController", "BehaviorRegistered", "TelemetrySampled", "BehaviorTriggered", "FanSpeedChanged", "setFanSpeed"]) {
  if (!studioBehavior.includes(token)) throw new Error(`Behavior orchestration missing: ${token}`);
}

const roboticsRuntime = await readFile("packages/robotics-runtime/src/index.ts", "utf8");
for (const token of ["solveArmIk", "forwardKinematics", "planPickMotion", "ArmJointLimits", "unreachable"]) {
  if (!roboticsRuntime.includes(token)) throw new Error(`Robotics Runtime contract missing: ${token}`);
}
const studioRobotics = await readFile("packages/studio-robotics/src/index.ts", "utf8");
for (const token of ["Arm01Controller", "MotionPlanCreated", "MotionWaypointReached", "JointTargetChanged", "GripperClosed", "ObjectAttached", "PickTaskCompleted", "planPickMotion", "setEngineeringProperty"]) {
  if (!studioRobotics.includes(token)) throw new Error(`ARM orchestration missing: ${token}`);
}
if (!studioRobotics.includes("payloadKg")) throw new Error("ARM payload gate missing");
if (!studioRobotics.includes("arm.sensor.object")) throw new Error("ARM sensor gate missing");

const workbench = await readFile("apps/studio-web/components/SpatialWorkbench.tsx", "utf8");
for (const token of [
  "EngineeringSession", "StudioIntelligence", "StudioBehaviorController", "BehaviorPanel", "DesktopPcAssembly",
  "armPreset", "Arm01Controller", "Arm01Assembly", "ArmRuntimePanel", "armIntelligence", "executeArmPick",
  "entity-relations", "boot-timeline", "causal-trace", "studio-command", "listenOnce", "speakStudioResponse"
]) {
  if (!workbench.includes(token)) throw new Error(`Workbench integration missing: ${token}`);
}
if (workbench.includes("createEngineeringEntity")) throw new Error("Workbench must not duplicate EngineeringEntity definitions locally");

const armAssembly = await readFile("apps/studio-web/components/Arm01Assembly.tsx", "utf8");
for (const token of ["arm.joint.base", "arm.joint.shoulder", "arm.joint.elbow", "arm.gripper", "object.cube.red"]) {
  if (!armAssembly.includes(token)) throw new Error(`ARM spatial representation missing: ${token}`);
}

const simulationRuntime = await readFile("packages/simulation-runtime/src/index.ts", "utf8");
for (const token of ["runFunctionalBoot", "MEMORY_UNAVAILABLE", "runThermalStep", "ThermalStepResult"]) {
  if (!simulationRuntime.includes(token)) throw new Error(`Simulation Runtime contract missing: ${token}`);
}
const sessionRuntime = await readFile("packages/engineering-session/src/index.ts", "utf8");
for (const eventType of ["BootFailed", "BootSucceeded", "CausalityExplained", "EntityInserted"]) {
  if (!sessionRuntime.includes(eventType)) throw new Error(`Causal boot event missing: ${eventType}`);
}

const intentRuntime = await readFile("packages/intelligence-runtime/src/index.ts", "utf8");
for (const token of ["resolveStudioIntent", "ThresholdBehaviorDraft", "RobotTaskDraft", 'action: "robotTask"', 'intent: "robotPick"', "cubo"]) {
  if (!intentRuntime.includes(token)) throw new Error(`Studio intent robotics contract missing: ${token}`);
}
const studioIntelligence = await readFile("packages/studio-intelligence/src/index.ts", "utf8");
if (!studioIntelligence.includes("session.executeCapability")) throw new Error("Studio Intelligence bypasses Engineering Session capability execution");
if (!studioIntelligence.includes("behaviorRegistrar.registerDraft")) throw new Error("Studio Intelligence is not materializing Behavior IR through registrar");
if (!studioIntelligence.includes("robotTaskExecutor.executePick")) throw new Error("Studio Intelligence is not routing robot tasks through the robotics executor");
if (studioIntelligence.includes("replaceEntity(")) throw new Error("Studio Intelligence must not mutate Engineering Graph entities directly");

const speech = await readFile("apps/studio-web/lib/browserSpeech.ts", "utf8");
if (!speech.includes("pt-BR")) throw new Error("Portuguese browser voice input missing");
if (!speech.includes("speechSynthesis")) throw new Error("Optional spoken Studio response missing");
const nextConfig = await readFile("apps/studio-web/next.config.mjs", "utf8");
if (!nextConfig.includes("extensionAlias")) throw new Error("Next shared-source extension alias missing");

console.log(`S1.8 structure PASS · ${required.length} required surfaces · Desktop + Behavior + ARM-01 robotics · Tehkné Solutions`);
