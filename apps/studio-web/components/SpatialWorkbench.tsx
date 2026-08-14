"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { EngineeringEntity } from "../../../packages/engineering-core/src/index";
import type { TehkneStudioProject } from "../../../packages/project-format/src/index";
import {
  EngineeringSession,
  type CapabilityExecutionResult
} from "../../../packages/engineering-session/src/index";
import { StudioBehaviorController } from "../../../packages/studio-behavior/src/index";
import { StudioIntelligence } from "../../../packages/studio-intelligence/src/index";
import desktopPreset from "../../../presets/desktop-pc/project.json";
import { browserSpeechSupported, listenOnce, speakStudioResponse } from "../lib/browserSpeech";
import { BehaviorPanel } from "./BehaviorPanel";
import { DesktopPcAssembly } from "./DesktopPcAssembly";

interface FeedbackState {
  readonly message: string;
  readonly result?: CapabilityExecutionResult;
  readonly error?: boolean;
}

export function SpatialWorkbench() {
  const session = useMemo(
    () => new EngineeringSession(desktopPreset as unknown as TehkneStudioProject),
    []
  );
  const behaviorController = useMemo(() => new StudioBehaviorController(session), [session]);
  const intelligence = useMemo(
    () => new StudioIntelligence(session, behaviorController),
    [session, behaviorController]
  );
  const [activeProduct, setActiveProduct] = useState<"desktop" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [commandText, setCommandText] = useState("");
  const [intelligenceMessage, setIntelligenceMessage] = useState(
    "Diga o que quer fazer. Eu resolvo a intenção; o Engineering Core valida a ação."
  );
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => setSpeechSupported(browserSpeechSupported()), []);

  const selected = selectedId ? session.getEntity(selectedId) : null;
  const root = session.getEntity("pc.root");
  const boot = session.getEntity("pc.boot");
  const powerState = String(root.properties.powerState?.value ?? "off");
  const bootStage = String(boot.properties.stage?.value ?? "IDLE");
  const recentHistory = session.history().slice(-4).reverse();
  const physicalComponents = session.graph
    .getDependencies(root.id, "contains")
    .filter((entity) => entity.type !== "BootProcess");
  const relationshipSnapshot = session.graph.snapshot().relationships;
  const selectedRelations = selected
    ? relationshipSnapshot
        .filter((relationship) => relationship.source === selected.id || relationship.target === selected.id)
        .slice(0, 7)
    : [];

  const selectEntity = (entity: EngineeringEntity) => {
    setSelectedId(entity.id);
    setFeedback(null);
  };

  const execute = async (capabilityId: string) => {
    if (!selected) return;
    const commandResult = await session.executeCapability(selected.id, capabilityId, "ui");
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

    const execution = await intelligence.executeUtterance(trimmed, {
      selectedEntityId: selectedId,
      lastEntityId: selectedId,
      source
    });
    setIntelligenceMessage(execution.message);

    if (execution.targetEntityId?.startsWith("pc.")) setActiveProduct("desktop");
    if (execution.targetEntityId) setSelectedId(execution.targetEntityId);

    if (execution.result) {
      setFeedback({ message: execution.result.message, result: execution.result });
      setRevision((current) => current + 1);
    } else if (execution.behavior) {
      setFeedback(null);
      setRevision((current) => current + 1);
    } else if (execution.resolution.status !== "resolved") {
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
    const result = await behaviorController.ingestTelemetry("pc.cpu", "temperatureC", 76, "simulation");
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
    const thermal = await behaviorController.simulateCpuThermalStep();
    setSelectedId("pc.cpu");
    setFeedback(null);
    setIntelligenceMessage(
      `Thermal step: ${thermal.previousTemperatureC} °C → ${thermal.nextTemperatureC} °C · fan ${thermal.fanPercent}%.`
    );
    setRevision((current) => current + 1);
  };

  const resetWorkbench = () => {
    setActiveProduct(null);
    setSelectedId(null);
    setFeedback(null);
    setCommandText("");
    setIntelligenceMessage("Diga o que quer fazer. Eu resolvo a intenção; o Engineering Core valida a ação.");
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
        {activeProduct === "desktop" ? (
          <DesktopPcAssembly session={session} selectedId={selectedId} onSelect={selectEntity} />
        ) : null}
      </Canvas>

      {!activeProduct ? (
        <div className="empty-state">
          <p>THE FIRST WORKBENCH</p>
          <strong>O que você quer construir ou compreender?</strong>
          <div className="actions">
            <button type="button" onClick={() => setActiveProduct("desktop")}>Chamar Desktop PC</button>
            <button type="button" disabled aria-disabled="true">ARM-01 · próxima etapa</button>
            <button type="button" disabled aria-disabled="true">Projeto vazio · em breve</button>
          </div>
        </div>
      ) : null}

      {activeProduct ? (
        <div className="workbench-toolbar" aria-label="Controles da bancada">
          <button type="button" onClick={resetWorkbench}>Guardar projeto</button>
          <span>
            DESKTOP-PC-001 · {physicalComponents.length} COMPONENTES · {root.state.toUpperCase()}
          </span>
          <span className={`runtime-state runtime-${powerState}`}>
            POWER {powerState.toUpperCase()} · BOOT {bootStage}
          </span>
        </div>
      ) : null}

      {activeProduct ? (
        <BehaviorPanel
          controller={behaviorController}
          revision={revision}
          onThermalSpike={() => void injectThermalSpike()}
          onThermalStep={() => void advanceThermalModel()}
        />
      ) : null}

      {activeProduct && recentHistory.length > 0 ? (
        <aside className="semantic-history" aria-label="Histórico semântico recente">
          <span>HISTORY · {session.history().length}</span>
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
              const supported = session.canExecuteCapability(capability.id);
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
                const other = session.getEntity(otherId);
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
            placeholder="Ex.: quando a CPU passar de 70 graus, coloque a ventoinha no máximo"
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
