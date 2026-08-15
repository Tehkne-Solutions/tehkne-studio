"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useState, type FormEvent } from "react";
import type { EngineeringEntity } from "../../../packages/engineering-core/src/index";
import { ComponentRegistry, parseComponentCatalog } from "../../../packages/component-library/src/index";
import type { ComponentCatalogOverlay } from "../../../packages/component-library/src/overlay";
import type { PrototypeManufacturingProfile, PrototypePackageManifest } from "../../../packages/factory-runtime/src/index";
import {
  createNotebookProject,
  createNotebookRegistry,
  type NotebookPresetProfile
} from "../../../packages/notebook-runtime/src/index";
import type { TehkneStudioProject } from "../../../packages/project-format/src/index";
import {
  createSessionSnapshot,
  restoreSessionSnapshot,
  type StudioSessionSnapshot
} from "../../../packages/persistence-runtime/src/index";
import {
  createSmartphoneProject,
  type SmartphonePresetProfile
} from "../../../packages/smartphone-runtime/src/index";
import {
  createTabletProject,
  createTabletRegistry,
  type TabletPresetProfile
} from "../../../packages/tablet-runtime/src/index";
import type { ArmVariantProfile } from "../../../packages/variant-runtime/src/index";
import {
  EngineeringSession,
  type CapabilityExecutionResult
} from "../../../packages/engineering-session/src/index";
import { StudioBehaviorController } from "../../../packages/studio-behavior/src/index";
import { ArmPrototypeFactory } from "../../../packages/studio-factory/src/index";
import { ArmFailureLab, type FailureExperimentRecord } from "../../../packages/studio-failure/src/index";
import { Arm01Controller, type ArmMotionRecord } from "../../../packages/studio-robotics/src/index";
import {
  ArmVariantLab,
  type BaseVariantProfile,
  type EngineeringVariantRecord
} from "../../../packages/studio-variants/src/index";
import { StudioIntelligence } from "../../../packages/studio-intelligence/src/index";
import componentCatalog from "../../../library/components/catalog.json";
import notebookOverlay from "../../../library/components/overlays/notebook-v1.json";
import tabletOverlay from "../../../library/components/overlays/tablet-v1.json";
import desktopPreset from "../../../presets/desktop-pc/project.json";
import armPreset from "../../../presets/arm-01/project.json";
import failureProfile from "../../../presets/arm-01/failure-profile.json";
import manufacturingProfile from "../../../presets/arm-01/manufacturing-profile.json";
import highTorqueProfile from "../../../presets/arm-01/variants/high-torque-profile.json";
import notebookProfile from "../../../presets/notebook-01/profile.json";
import smartphoneProfile from "../../../presets/smartphone-01/profile.json";
import tabletProfile from "../../../presets/tablet-01/profile.json";
import {
  browserProjectExists,
  loadBrowserProject,
  saveBrowserProject,
  type PersistedStudioProduct
} from "../lib/projectPersistence";
import { browserSpeechSupported, listenOnce, speakStudioResponse } from "../lib/browserSpeech";
import { Arm01Assembly } from "./Arm01Assembly";
import { ArmRuntimePanel } from "./ArmRuntimePanel";
import { BehaviorPanel } from "./BehaviorPanel";
import { DesktopPcAssembly } from "./DesktopPcAssembly";
import { NotebookAssembly } from "./NotebookAssembly";
import { SmartphoneAssembly } from "./SmartphoneAssembly";
import { TabletAssembly } from "./TabletAssembly";

interface FeedbackState {
  readonly message: string;
  readonly result?: CapabilityExecutionResult;
  readonly error?: boolean;
}

type ActiveProduct = "desktop" | "arm" | "smartphone" | "notebook" | "tablet" | null;

interface WorkspacePersistenceState {
  readonly activeProduct: Exclude<ActiveProduct, null>;
  readonly selectedEntityId: string | null;
}

interface ArmRuntimePersistenceState {
  readonly motionRecords: readonly ArmMotionRecord[];
  readonly failureRecords: readonly FailureExperimentRecord[];
  readonly variantRecords: readonly EngineeringVariantRecord[];
  readonly prototypePackage: PrototypePackageManifest | null;
}

interface DesktopRuntimeBundle {
  readonly session: EngineeringSession;
  readonly behavior: StudioBehaviorController;
  readonly intelligence: StudioIntelligence;
}

interface ArmRuntimeBundle {
  readonly session: EngineeringSession;
  readonly controller: Arm01Controller;
  readonly failureLab: ArmFailureLab;
  readonly variantLab: ArmVariantLab;
  readonly factory: ArmPrototypeFactory;
  readonly intelligence: StudioIntelligence;
}

interface ProductRuntimeBundle {
  readonly session: EngineeringSession;
  readonly intelligence: StudioIntelligence;
}

const universalRegistry = new ComponentRegistry(parseComponentCatalog(componentCatalog));
const smartphoneMaterialization = createSmartphoneProject(
  smartphoneProfile as unknown as SmartphonePresetProfile,
  universalRegistry
);
const notebookRegistry = createNotebookRegistry(
  componentCatalog,
  notebookOverlay as ComponentCatalogOverlay
).registry;
const notebookMaterialization = createNotebookProject(
  notebookProfile as unknown as NotebookPresetProfile,
  notebookRegistry
);
const tabletRegistry = createTabletRegistry(
  componentCatalog,
  tabletOverlay as ComponentCatalogOverlay
).registry;
const tabletMaterialization = createTabletProject(
  tabletProfile as unknown as TabletPresetProfile,
  tabletRegistry
);

function objectExtension(snapshot: StudioSessionSnapshot | undefined, key: string): Record<string, unknown> {
  const value = snapshot?.extensions[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function createDesktopRuntime(snapshot?: StudioSessionSnapshot): DesktopRuntimeBundle {
  if (snapshot && snapshot.project.projectId !== (desktopPreset as { projectId: string }).projectId) {
    throw new Error(`Snapshot ${snapshot.project.projectId} não pertence ao Desktop PC.`);
  }
  const session = snapshot
    ? restoreSessionSnapshot(snapshot)
    : new EngineeringSession(desktopPreset as unknown as TehkneStudioProject);
  const behavior = new StudioBehaviorController(session);
  const intelligence = new StudioIntelligence(session, behavior);
  return { session, behavior, intelligence };
}

function createArmRuntime(snapshot?: StudioSessionSnapshot): ArmRuntimeBundle {
  if (snapshot && snapshot.project.projectId !== (armPreset as { projectId: string }).projectId) {
    throw new Error(`Snapshot ${snapshot.project.projectId} não pertence ao ARM-01.`);
  }
  const session = snapshot
    ? restoreSessionSnapshot(snapshot)
    : new EngineeringSession(armPreset as unknown as TehkneStudioProject);
  const raw = objectExtension(snapshot, "armRuntime") as Partial<ArmRuntimePersistenceState>;
  const controller = new Arm01Controller(session, { records: raw.motionRecords ?? [] });
  const failureLab = new ArmFailureLab(
    session,
    failureProfile as BaseVariantProfile,
    "object.cube.red",
    { records: raw.failureRecords ?? [] }
  );
  const variantLab = new ArmVariantLab(
    failureLab,
    failureProfile as BaseVariantProfile,
    highTorqueProfile as ArmVariantProfile,
    "arm.root",
    { records: raw.variantRecords ?? [] }
  );
  const factory = new ArmPrototypeFactory(
    session,
    variantLab,
    manufacturingProfile as PrototypeManufacturingProfile,
    { latest: raw.prototypePackage ?? null }
  );
  const intelligence = new StudioIntelligence(session, undefined, controller, variantLab);
  return { session, controller, failureLab, variantLab, factory, intelligence };
}

function createSmartphoneRuntime(snapshot?: StudioSessionSnapshot): ProductRuntimeBundle {
  if (snapshot && snapshot.project.projectId !== smartphoneMaterialization.project.projectId) {
    throw new Error(`Snapshot ${snapshot.project.projectId} não pertence ao Smartphone 01.`);
  }
  const session = snapshot
    ? restoreSessionSnapshot(snapshot)
    : new EngineeringSession(smartphoneMaterialization.project);
  return { session, intelligence: new StudioIntelligence(session) };
}

function createNotebookRuntime(snapshot?: StudioSessionSnapshot): ProductRuntimeBundle {
  if (snapshot && snapshot.project.projectId !== notebookMaterialization.project.projectId) {
    throw new Error(`Snapshot ${snapshot.project.projectId} não pertence ao Notebook 01.`);
  }
  const session = snapshot
    ? restoreSessionSnapshot(snapshot)
    : new EngineeringSession(notebookMaterialization.project);
  return { session, intelligence: new StudioIntelligence(session) };
}

function createTabletRuntime(snapshot?: StudioSessionSnapshot): ProductRuntimeBundle {
  if (snapshot && snapshot.project.projectId !== tabletMaterialization.project.projectId) {
    throw new Error(`Snapshot ${snapshot.project.projectId} não pertence ao Tablet 01.`);
  }
  const session = snapshot
    ? restoreSessionSnapshot(snapshot)
    : new EngineeringSession(tabletMaterialization.project);
  return { session, intelligence: new StudioIntelligence(session) };
}

function savedSelection(snapshot: StudioSessionSnapshot, session: EngineeringSession): string | null {
  const workspace = objectExtension(snapshot, "workspace") as Partial<WorkspacePersistenceState>;
  const selected = workspace.selectedEntityId;
  if (typeof selected !== "string") return null;
  try {
    session.getEntity(selected);
    return selected;
  } catch {
    return null;
  }
}

function productLabel(product: Exclude<ActiveProduct, null>): string {
  if (product === "desktop") return "Desktop PC";
  if (product === "arm") return "ARM-01";
  if (product === "smartphone") return "Smartphone 01";
  if (product === "notebook") return "Notebook 01";
  return "Tablet 01";
}

export function SpatialWorkbench() {
  const [desktopRuntime, setDesktopRuntime] = useState<DesktopRuntimeBundle>(() => createDesktopRuntime());
  const [armRuntime, setArmRuntime] = useState<ArmRuntimeBundle>(() => createArmRuntime());
  const [smartphoneRuntime, setSmartphoneRuntime] = useState<ProductRuntimeBundle>(() => createSmartphoneRuntime());
  const [notebookRuntime, setNotebookRuntime] = useState<ProductRuntimeBundle>(() => createNotebookRuntime());
  const [tabletRuntime, setTabletRuntime] = useState<ProductRuntimeBundle>(() => createTabletRuntime());
  const { session: desktopSession, behavior: desktopBehavior, intelligence: desktopIntelligence } = desktopRuntime;
  const {
    session: armSession,
    controller: armController,
    failureLab: armFailureLab,
    variantLab: armVariantLab,
    factory: armFactory,
    intelligence: armIntelligence
  } = armRuntime;
  const { session: smartphoneSession, intelligence: smartphoneIntelligence } = smartphoneRuntime;
  const { session: notebookSession, intelligence: notebookIntelligence } = notebookRuntime;
  const { session: tabletSession, intelligence: tabletIntelligence } = tabletRuntime;

  const [activeProduct, setActiveProduct] = useState<ActiveProduct>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [commandText, setCommandText] = useState("");
  const [intelligenceMessage, setIntelligenceMessage] = useState(
    "Diga o que quer fazer. Eu resolvo a intenção; o Engineering Core valida a ação."
  );
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [savedProjects, setSavedProjects] = useState<Record<PersistedStudioProduct, boolean>>({
    desktop: false,
    arm: false,
    smartphone: false,
    notebook: false,
    tablet: false
  });

  useEffect(() => {
    setSpeechSupported(browserSpeechSupported());
    setSavedProjects({
      desktop: browserProjectExists("desktop"),
      arm: browserProjectExists("arm"),
      smartphone: browserProjectExists("smartphone"),
      notebook: browserProjectExists("notebook"),
      tablet: browserProjectExists("tablet")
    });
  }, []);

  const activeSession = activeProduct === "arm"
    ? armSession
    : activeProduct === "smartphone"
      ? smartphoneSession
      : activeProduct === "notebook"
        ? notebookSession
        : activeProduct === "tablet"
          ? tabletSession
          : desktopSession;
  const activeIntelligence = activeProduct === "arm"
    ? armIntelligence
    : activeProduct === "smartphone"
      ? smartphoneIntelligence
      : activeProduct === "notebook"
        ? notebookIntelligence
        : activeProduct === "tablet"
          ? tabletIntelligence
          : desktopIntelligence;
  const selected = selectedId ? activeSession.getEntity(selectedId) : null;
  const relationshipSnapshot = activeSession.graph.snapshot().relationships;
  const selectedRelations = selected
    ? relationshipSnapshot
        .filter((relationship) => relationship.source === selected.id || relationship.target === selected.id)
        .slice(0, 7)
    : [];
  const recentHistory = activeSession.history().slice(-4).reverse();

  const desktopRoot = desktopSession.getEntity("pc.root");
  const desktopBoot = desktopSession.getEntity("pc.boot");
  const desktopPowerState = String(desktopRoot.properties.powerState?.value ?? "off");
  const desktopBootStage = String(desktopBoot.properties.stage?.value ?? "IDLE");
  const desktopComponents = desktopSession.graph.getDependencies(desktopRoot.id, "contains").filter((entity) => entity.type !== "BootProcess");

  const armRoot = armSession.getEntity("arm.root");
  const cube = armSession.getEntity("object.cube.red");
  const armTaskState = String(armRoot.properties.taskState?.value ?? "idle");

  const smartphoneRoot = smartphoneSession.getEntity("phone.root");
  const smartphoneBoot = smartphoneSession.getEntity("phone.boot");
  const smartphonePowerState = String(smartphoneRoot.properties.powerState?.value ?? "off");
  const smartphoneBootStage = String(smartphoneBoot.properties.stage?.value ?? "IDLE");
  const smartphoneComponents = smartphoneSession.graph.getDependencies(smartphoneRoot.id, "contains").filter((entity) => entity.type !== "BootProcess");

  const notebookRoot = notebookSession.getEntity("notebook.root");
  const notebookBoot = notebookSession.getEntity("notebook.boot");
  const notebookPowerState = String(notebookRoot.properties.powerState?.value ?? "off");
  const notebookBootStage = String(notebookBoot.properties.stage?.value ?? "IDLE");
  const notebookComponents = notebookSession.graph.getDependencies(notebookRoot.id, "contains").filter((entity) => entity.type !== "BootProcess");

  const tabletRoot = tabletSession.getEntity("tablet.root");
  const tabletBoot = tabletSession.getEntity("tablet.boot");
  const tabletPowerState = String(tabletRoot.properties.powerState?.value ?? "off");
  const tabletBootStage = String(tabletBoot.properties.stage?.value ?? "IDLE");
  const tabletComponents = tabletSession.graph.getDependencies(tabletRoot.id, "contains").filter((entity) => entity.type !== "BootProcess");

  const returnToWorkbench = (message?: string) => {
    setActiveProduct(null);
    setSelectedId(null);
    setFeedback(null);
    setCommandText("");
    setIntelligenceMessage(message ?? "Diga o que quer fazer. Eu resolvo a intenção; o Engineering Core valida a ação.");
  };

  const switchProduct = (product: Exclude<ActiveProduct, null>) => {
    setActiveProduct(product);
    setSelectedId(null);
    setFeedback(null);
    setCommandText("");
    setIntelligenceMessage(
      product === "arm"
        ? "ARM-01 pronto. Teste a carga, investigue uma falha ou peça uma variante."
        : product === "smartphone"
          ? "Smartphone 01 materializado pela Component Library. Abra, inspecione, ligue ou remova a bateria para testar causalidade."
          : product === "notebook"
            ? "Notebook 01 materializado pelo Product Composition Runtime. Abra, inspecione, remova RAM/SSD/bateria ou teste o boot causal."
            : product === "tablet"
              ? "Tablet 01 pronto. Abra, inspecione o controlador touch/pen, remova a bateria ou teste o boot causal."
              : "Desktop PC pronto para inspeção, boot causal e automações."
    );
  };

  const saveCurrentProject = () => {
    if (!activeProduct) return;
    try {
      const workspace: WorkspacePersistenceState = { activeProduct, selectedEntityId: selectedId };
      if (activeProduct === "desktop") {
        saveBrowserProject("desktop", createSessionSnapshot(desktopSession, {
          behaviors: desktopBehavior.behaviors(),
          extensions: { workspace }
        }));
      } else if (activeProduct === "arm") {
        const armRuntimeState: ArmRuntimePersistenceState = {
          motionRecords: armController.records(),
          failureRecords: armFailureLab.records(),
          variantRecords: armVariantLab.records(),
          prototypePackage: armFactory.latest()
        };
        saveBrowserProject("arm", createSessionSnapshot(armSession, {
          extensions: { workspace, armRuntime: armRuntimeState }
        }));
      } else if (activeProduct === "smartphone") {
        saveBrowserProject("smartphone", createSessionSnapshot(smartphoneSession, { extensions: { workspace } }));
      } else if (activeProduct === "notebook") {
        saveBrowserProject("notebook", createSessionSnapshot(notebookSession, { extensions: { workspace } }));
      } else {
        saveBrowserProject("tablet", createSessionSnapshot(tabletSession, { extensions: { workspace } }));
      }
      setSavedProjects((current) => ({ ...current, [activeProduct]: true }));
      returnToWorkbench(`${productLabel(activeProduct)} salvo com Engineering Graph, histórico e evidências da sessão.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar o projeto.";
      setFeedback({ message, error: true });
      setIntelligenceMessage(message);
    }
  };

  const restoreProject = (product: PersistedStudioProduct) => {
    try {
      const snapshot = loadBrowserProject(product);
      if (!snapshot) throw new Error(`Não existe snapshot salvo para ${product}.`);
      let restoredSession: EngineeringSession;
      if (product === "desktop") {
        const restored = createDesktopRuntime(snapshot);
        setDesktopRuntime(restored);
        restoredSession = restored.session;
      } else if (product === "arm") {
        const restored = createArmRuntime(snapshot);
        setArmRuntime(restored);
        restoredSession = restored.session;
      } else if (product === "smartphone") {
        const restored = createSmartphoneRuntime(snapshot);
        setSmartphoneRuntime(restored);
        restoredSession = restored.session;
      } else if (product === "notebook") {
        const restored = createNotebookRuntime(snapshot);
        setNotebookRuntime(restored);
        restoredSession = restored.session;
      } else {
        const restored = createTabletRuntime(snapshot);
        setTabletRuntime(restored);
        restoredSession = restored.session;
      }
      setSelectedId(savedSelection(snapshot, restoredSession));
      setActiveProduct(product);
      setFeedback(null);
      setCommandText("");
      setIntelligenceMessage(
        `${productLabel(product)} restaurado de ${new Date(snapshot.savedAt).toLocaleString("pt-BR")} · ${snapshot.history.length} entradas de histórico · ${snapshot.events.length} eventos.`
      );
      setRevision((current) => current + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Snapshot salvo não pôde ser restaurado.";
      setFeedback({ message, error: true });
      setIntelligenceMessage(`RESTORE BLOCKED · ${message}`);
    }
  };

  const selectEntity = (entity: EngineeringEntity) => {
    setSelectedId(entity.id);
    setFeedback(null);
  };

  const execute = async (capabilityId: string) => {
    if (!selected) return;
    const commandResult = await activeSession.executeCapability(selected.id, capabilityId, "ui");
    if (!commandResult.ok || !commandResult.result) {
      setFeedback({ message: commandResult.error ?? "Falha ao executar capability.", error: true });
      return;
    }
    setFeedback({ message: commandResult.result.message, result: commandResult.result });
    setSelectedId(commandResult.result.focusEntityId ?? commandResult.result.entity.id);
    setRevision((current) => current + 1);
  };

  const runUtterance = async (utterance: string, source: "ui" | "voice") => {
    const trimmed = utterance.trim();
    if (!trimmed) return;
    setCommandText(trimmed);

    const looksRobotic = /\b(pegue|pegar|apanhe|segure|cubo|arm-01|braco|braço|robo|robô|pick|grab|versao|versão|variante|redesign|levantar|peso|torque)\b/i.test(trimmed);
    const looksNotebook = /\b(notebook|laptop|computador portatil|computador portátil)\b/i.test(trimmed);
    const looksTablet = /\b(tablet|tablete)\b/i.test(trimmed);
    const looksSmartphone = /\b(celular|smartphone|telefone|phone)\b/i.test(trimmed);
    const autoProduct: Exclude<ActiveProduct, null> | null = activeProduct === null
      ? looksRobotic
        ? "arm"
        : looksNotebook
          ? "notebook"
          : looksTablet
            ? "tablet"
            : looksSmartphone
              ? "smartphone"
              : null
      : null;
    const intelligence = autoProduct === "arm"
      ? armIntelligence
      : autoProduct === "notebook"
        ? notebookIntelligence
        : autoProduct === "tablet"
          ? tabletIntelligence
          : autoProduct === "smartphone"
            ? smartphoneIntelligence
            : activeIntelligence;
    if (autoProduct) setActiveProduct(autoProduct);

    const execution = await intelligence.executeUtterance(trimmed, {
      selectedEntityId: autoProduct ? null : selectedId,
      lastEntityId: autoProduct ? null : selectedId,
      source
    });
    setIntelligenceMessage(execution.message);

    if (execution.targetEntityId?.startsWith("pc.")) setActiveProduct("desktop");
    if (execution.targetEntityId?.startsWith("arm.") || execution.robotTask || execution.variantTask) setActiveProduct("arm");
    if (execution.targetEntityId?.startsWith("phone.")) setActiveProduct("smartphone");
    if (execution.targetEntityId?.startsWith("notebook.")) setActiveProduct("notebook");
    if (execution.targetEntityId?.startsWith("tablet.")) setActiveProduct("tablet");
    if (execution.targetEntityId) setSelectedId(execution.targetEntityId);

    if (execution.result) {
      setFeedback({ message: execution.result.message, result: execution.result });
      setRevision((current) => current + 1);
    } else if (execution.behavior || execution.robotTask || execution.variantTask) {
      setFeedback(null);
      setRevision((current) => current + 1);
    } else if (execution.resolution.status !== "resolved" || !execution.executed) {
      setFeedback({ message: execution.message, error: true });
    } else {
      setFeedback(null);
    }

    if (source === "voice") speakStudioResponse(execution.message);
  };

  const submitUtterance = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runUtterance(commandText, "ui");
  };

  const startListening = () => {
    if (!speechSupported || listening) return;
    setListening(true);
    setIntelligenceMessage("Ouvindo…");
    listenOnce(
      (result) => {
        setCommandText(result.transcript);
        void runUtterance(result.transcript, "voice");
      },
      () => setListening(false),
      (message) => {
        setIntelligenceMessage(message);
        setFeedback({ message, error: true });
      }
    );
  };

  const injectThermalSpike = async () => {
    setActiveProduct("desktop");
    const result = await desktopBehavior.ingestTelemetry("pc.cpu", "temperatureC", 76, "simulation");
    const triggered = result.executions.at(-1);
    setSelectedId("pc.cpu");
    setFeedback(null);
    setIntelligenceMessage(
      triggered
        ? `Telemetry 76 °C cruzou o limiar. ${triggered.message}`
        : "Telemetry 76 °C registrada; nenhuma regra foi acionada."
    );
    setRevision((current) => current + 1);
  };

  const advanceThermalModel = async () => {
    setActiveProduct("desktop");
    const thermal = await desktopBehavior.simulateCpuThermalStep();
    setSelectedId("pc.cpu");
    setFeedback(null);
    setIntelligenceMessage(
      `Thermal step: ${thermal.previousTemperatureC} °C → ${thermal.nextTemperatureC} °C · fan ${thermal.fanPercent}%.`
    );
    setRevision((current) => current + 1);
  };

  const executeArmPick = () => {
    try {
      setActiveProduct("arm");
      const result = armController.executePick("object.cube.red");
      setSelectedId("arm.root");
      setFeedback(null);
      setIntelligenceMessage(result.message);
      setRevision((current) => current + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao executar a tarefa robótica.";
      setFeedback({ message, error: true });
      setIntelligenceMessage(message);
    }
  };

  const handleArmEngineeringChange = (message: string) => {
    setActiveProduct("arm");
    setSelectedId("arm.root");
    setFeedback(null);
    setIntelligenceMessage(message);
    setRevision((current) => current + 1);
  };

  return (
    <section className="workbench" aria-label="Bancada espacial do Tehkné Studio" data-revision={revision}>
      <Canvas
        className="workbench-canvas"
        camera={{ position: [5.4, 3.6, 6.4], fov: 38 }}
        onPointerMissed={() => { setSelectedId(null); setFeedback(null); }}
        shadows
      >
        <color attach="background" args={["#171815"]} />
        <ambientLight intensity={0.82} />
        <directionalLight position={[5, 7, 4]} intensity={2.1} castShadow />
        <gridHelper args={[14, 28, "#45483f", "#272923"]} position={[0, -0.53, 0]} />
        {activeProduct === "desktop" ? <DesktopPcAssembly session={desktopSession} selectedId={selectedId} onSelect={selectEntity} /> : null}
        {activeProduct === "arm" ? <Arm01Assembly session={armSession} selectedId={selectedId} onSelect={selectEntity} /> : null}
        {activeProduct === "smartphone" ? <SmartphoneAssembly session={smartphoneSession} selectedId={selectedId} onSelect={selectEntity} /> : null}
        {activeProduct === "notebook" ? <NotebookAssembly session={notebookSession} selectedId={selectedId} onSelect={selectEntity} /> : null}
        {activeProduct === "tablet" ? <TabletAssembly session={tabletSession} selectedId={selectedId} onSelect={selectEntity} /> : null}
      </Canvas>

      {!activeProduct ? (
        <div className="empty-state">
          <p>THE FIRST WORKBENCH</p>
          <strong>O que você quer construir ou compreender?</strong>
          <div className="actions">
            <button type="button" onClick={() => switchProduct("desktop")}>Chamar Desktop PC</button>
            <button type="button" onClick={() => switchProduct("arm")}>Chamar ARM-01</button>
            <button type="button" onClick={() => switchProduct("smartphone")}>Chamar Smartphone 01</button>
            <button type="button" onClick={() => switchProduct("notebook")}>Chamar Notebook 01</button>
            <button type="button" onClick={() => switchProduct("tablet")}>Chamar Tablet 01</button>
            {savedProjects.desktop ? <button type="button" onClick={() => restoreProject("desktop")}>Restaurar Desktop salvo</button> : null}
            {savedProjects.arm ? <button type="button" onClick={() => restoreProject("arm")}>Restaurar ARM-01 salvo</button> : null}
            {savedProjects.smartphone ? <button type="button" onClick={() => restoreProject("smartphone")}>Restaurar Smartphone salvo</button> : null}
            {savedProjects.notebook ? <button type="button" onClick={() => restoreProject("notebook")}>Restaurar Notebook salvo</button> : null}
            {savedProjects.tablet ? <button type="button" onClick={() => restoreProject("tablet")}>Restaurar Tablet salvo</button> : null}
            <button type="button" disabled aria-disabled="true">Projeto vazio · em breve</button>
          </div>
        </div>
      ) : null}

      {activeProduct ? (
        <div className="workbench-toolbar" aria-label="Controles da bancada">
          <button type="button" onClick={saveCurrentProject}>Guardar projeto</button>
          <button type="button" onClick={() => returnToWorkbench()}>Voltar sem salvar</button>
          {activeProduct === "desktop" ? (
            <>
              <span>DESKTOP-PC-001 · {desktopComponents.length} COMPONENTES · {desktopRoot.state.toUpperCase()}</span>
              <span className={`runtime-state runtime-${desktopPowerState}`}>POWER {desktopPowerState.toUpperCase()} · BOOT {desktopBootStage}</span>
            </>
          ) : activeProduct === "arm" ? (
            <>
              <span>ARM-01 · 3 JOINTS · {armTaskState.toUpperCase()}</span>
              <span className="runtime-state">WORKPIECE {cube.state.toUpperCase()}</span>
            </>
          ) : activeProduct === "smartphone" ? (
            <>
              <span>SMARTPHONE-01 · {smartphoneComponents.length} COMPONENTES · {smartphoneRoot.state.toUpperCase()}</span>
              <span className={`runtime-state runtime-${smartphonePowerState}`}>POWER {smartphonePowerState.toUpperCase()} · BOOT {smartphoneBootStage}</span>
            </>
          ) : activeProduct === "notebook" ? (
            <>
              <span>NOTEBOOK-01 · {notebookComponents.length} COMPONENTES · {notebookRoot.state.toUpperCase()}</span>
              <span className={`runtime-state runtime-${notebookPowerState}`}>POWER {notebookPowerState.toUpperCase()} · BOOT {notebookBootStage}</span>
            </>
          ) : (
            <>
              <span>TABLET-01 · {tabletComponents.length} COMPONENTES · {tabletRoot.state.toUpperCase()}</span>
              <span className={`runtime-state runtime-${tabletPowerState}`}>POWER {tabletPowerState.toUpperCase()} · BOOT {tabletBootStage}</span>
            </>
          )}
        </div>
      ) : null}

      {activeProduct === "desktop" ? (
        <BehaviorPanel
          controller={desktopBehavior}
          revision={revision}
          onThermalSpike={() => void injectThermalSpike()}
          onThermalStep={() => void advanceThermalModel()}
        />
      ) : null}

      {activeProduct === "arm" ? (
        <ArmRuntimePanel
          controller={armController}
          failureLab={armFailureLab}
          variantLab={armVariantLab}
          factory={armFactory}
          revision={revision}
          onPick={executeArmPick}
          onEngineeringChange={handleArmEngineeringChange}
        />
      ) : null}

      {activeProduct && recentHistory.length > 0 ? (
        <aside className="semantic-history" aria-label="Histórico semântico recente">
          <span>HISTORY · {activeSession.history().length}</span>
          {recentHistory.map((entry) => (
            <div key={entry.id}>
              <strong>{entry.label}</strong>
              <small>{entry.beforeState} → {entry.afterState}</small>
            </div>
          ))}
        </aside>
      ) : null}

      {selected ? (
        <aside className="entity-card" aria-live="polite">
          <span className="entity-kind">{selected.type}</span>
          <strong>{selected.name}</strong>
          <small>{selected.id} · {selected.state}</small>

          <div className="entity-actions">
            {selected.capabilities.map((capability) => {
              const supported = activeSession.canExecuteCapability(capability.id);
              return (
                <button
                  type="button"
                  key={capability.id}
                  onClick={() => void execute(capability.id)}
                  disabled={!supported}
                  title={supported ? capability.label : `${capability.label} é controlada por outro runtime nesta etapa`}
                >
                  {capability.label}
                </button>
              );
            })}
          </div>

          {selectedRelations.length > 0 ? (
            <section className="entity-relations" aria-label="Relações de engenharia">
              <span>ENGINEERING GRAPH</span>
              {selectedRelations.map((relationship) => {
                const outgoing = relationship.source === selected.id;
                const otherId = outgoing ? relationship.target : relationship.source;
                const other = activeSession.getEntity(otherId);
                return (
                  <div key={relationship.id}>
                    <small>{outgoing ? "→" : "←"} {relationship.type}</small>
                    <strong>{other.name}</strong>
                  </div>
                );
              })}
            </section>
          ) : null}

          {feedback ? (
            <section className={feedback.error ? "capability-result capability-error" : "capability-result"}>
              <span>{feedback.error ? "COMMAND ERROR" : "COMMAND RESULT"}</span>
              <p>{feedback.message}</p>

              {feedback.result?.bootRun ? (
                <div className="boot-timeline" aria-label="Timeline do boot">
                  <span>FUNCTIONAL BOOT MODEL</span>
                  {feedback.result.bootRun.timeline.map((step, index) => (
                    <div key={`${step.stage}-${index}`} data-outcome={step.outcome}>
                      <small>{step.outcome === "pass" ? "✓" : "×"}</small>
                      <strong>{step.stage}</strong>
                    </div>
                  ))}
                </div>
              ) : null}

              {feedback.result?.causalTrace?.length ? (
                <div className="causal-trace" aria-label="Rastreamento causal">
                  <span>CAUSAL TRACE</span>
                  {feedback.result.causalTrace.map((step, index) => (
                    <div key={`${step.entityId}-${index}`}>
                      <small>{index + 1}</small>
                      <section>
                        <strong>{step.label}</strong>
                        <p>{step.detail}</p>
                      </section>
                    </div>
                  ))}
                </div>
              ) : null}

              {feedback.result?.inspection?.length ? (
                <dl className="property-list">
                  {feedback.result.inspection.map((property) => (
                    <div key={property.id}>
                      <dt>{property.id}</dt>
                      <dd>
                        {String(property.value)}{property.unit ? ` ${property.unit}` : ""}
                        <small>source · {property.source}</small>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </section>
          ) : null}
        </aside>
      ) : null}

      <form className="studio-command" onSubmit={submitUtterance} aria-label="Studio Intelligence">
        <div className="studio-command-state">
          <span>STUDIO INTELLIGENCE</span>
          <p>{intelligenceMessage}</p>
        </div>
        <div className="studio-command-input">
          <input
            value={commandText}
            onChange={(event) => setCommandText(event.target.value)}
            placeholder={activeProduct === "arm"
              ? "Ex.: pegue o cubo · teste 1,60 kg · crie uma versão capaz de levantar esse peso"
              : activeProduct === "smartphone"
                ? "Ex.: abra o celular · ligue o smartphone · remova a bateria · por que não iniciou?"
                : activeProduct === "notebook"
                  ? "Ex.: abra o notebook · tire a RAM · ligue · por que não iniciou?"
                  : activeProduct === "tablet"
                    ? "Ex.: abra o tablet · inspecione a caneta · tire a bateria · ligue"
                    : "Ex.: abra o computador · tire a RAM · crie uma automação térmica"}
            aria-label="Comando para o Tehkné Studio"
          />
          <button type="submit">Executar</button>
          <button
            type="button"
            onClick={startListening}
            disabled={!speechSupported || listening}
            aria-pressed={listening}
            title={speechSupported ? "Comando por voz" : "Voz indisponível neste navegador"}
          >
            {listening ? "Ouvindo…" : "Voz"}
          </button>
        </div>
      </form>
    </section>
  );
}
