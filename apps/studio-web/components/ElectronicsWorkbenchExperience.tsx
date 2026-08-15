"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { EngineeringEntity } from "../../../packages/engineering-core/src/index";
import { EngineeringSession } from "../../../packages/engineering-session/src/index";
import {
  ElectronicsBench,
  createElectronicsWorkbenchProject,
  type ElectronicsBenchRestoreState,
  type ElectronicsMeasurementKind,
  type ElectronicsWorkbenchProfile
} from "../../../packages/electronics-runtime/src/index";
import {
  createSessionSnapshot,
  restoreSessionSnapshot,
  type StudioSessionSnapshot
} from "../../../packages/persistence-runtime/src/index";
import { StudioIntelligence } from "../../../packages/studio-intelligence/src/index";
import electronicsProfile from "../../../presets/electronics-workbench-01/profile.json";
import {
  browserProjectExists,
  loadBrowserProject,
  saveBrowserProject
} from "../lib/projectPersistence";
import { browserSpeechSupported, listenOnce, speakStudioResponse } from "../lib/browserSpeech";
import { ElectronicsBenchAssembly } from "./ElectronicsBenchAssembly";
import { ElectronicsWorkbenchPanel } from "./ElectronicsWorkbenchPanel";
import styles from "./ElectronicsWorkbenchExperience.module.css";

interface ElectronicsRuntimeBundle {
  readonly session: EngineeringSession;
  readonly bench: ElectronicsBench;
  readonly intelligence: StudioIntelligence;
}

interface ElectronicsPersistenceState {
  readonly records: ReturnType<ElectronicsBench["records"]>;
}

function objectExtension(snapshot: StudioSessionSnapshot | undefined, key: string): Record<string, unknown> {
  const value = snapshot?.extensions[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function createRuntime(snapshot?: StudioSessionSnapshot): ElectronicsRuntimeBundle {
  const project = createElectronicsWorkbenchProject(electronicsProfile as ElectronicsWorkbenchProfile);
  if (snapshot && snapshot.project.projectId !== project.projectId) {
    throw new Error(`Snapshot ${snapshot.project.projectId} não pertence à Electronics Workbench.`);
  }
  const session = snapshot ? restoreSessionSnapshot(snapshot) : new EngineeringSession(project);
  const extension = objectExtension(snapshot, "electronicsBench") as Partial<ElectronicsPersistenceState>;
  const restore: ElectronicsBenchRestoreState = { records: extension.records ?? [] };
  const bench = new ElectronicsBench(session, restore);
  const intelligence = new StudioIntelligence(session);
  return { session, bench, intelligence };
}

function parseNumber(text: string): number {
  return Number(text.replace(",", "."));
}

export function ElectronicsWorkbenchExperience() {
  const [open, setOpen] = useState(false);
  const [runtime, setRuntime] = useState<ElectronicsRuntimeBundle>(() => createRuntime());
  const [selectedId, setSelectedId] = useState<string | null>("electronics.root");
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("Bancada pronta. Feche a chave e simule o circuito de 5 V com resistor de 330 Ω.");
  const [commandText, setCommandText] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [saved, setSaved] = useState(false);
  const { session, bench, intelligence } = runtime;

  useEffect(() => {
    setSpeechSupported(browserSpeechSupported());
    setSaved(browserProjectExists("electronics"));
  }, []);

  const selected = useMemo(() => selectedId ? session.getEntity(selectedId) : null, [session, selectedId, revision]);

  const changed = (nextMessage: string) => {
    setMessage(nextMessage);
    setRevision((current) => current + 1);
  };

  const save = () => {
    const state: ElectronicsPersistenceState = { records: bench.records() };
    const snapshot = createSessionSnapshot(session, { extensions: { electronicsBench: state } });
    saveBrowserProject("electronics", snapshot);
    setSaved(true);
    setMessage(`Electronics Workbench salva · ${bench.records().length} simulações preservadas.`);
  };

  const restore = () => {
    try {
      const snapshot = loadBrowserProject("electronics");
      if (!snapshot) throw new Error("Não existe Electronics Workbench salva.");
      const restored = createRuntime(snapshot);
      setRuntime(restored);
      setSelectedId("electronics.root");
      setRevision((current) => current + 1);
      setOpen(true);
      setMessage(`Electronics Workbench restaurada · ${restored.bench.records().length} simulações · sem replay.`);
    } catch (error) {
      setMessage(error instanceof Error ? `RESTORE BLOCKED · ${error.message}` : "RESTORE BLOCKED");
    }
  };

  const runCommand = async (utterance: string, source: "ui" | "voice") => {
    const text = utterance.trim();
    if (!text) return;
    setCommandText(text);
    try {
      const voltage = text.match(/(?:fonte|tens[aã]o).*?(\d+(?:[,.]\d+)?)\s*(?:v|volt)/i);
      const resistance = text.match(/(?:resistor|resist[eê]ncia).*?(\d+(?:[,.]\d+)?)\s*(?:ohm|ohms|Ω)/i);
      let response = "";

      if (/\b(feche|fechar|ligue|ligar)\b.*\b(chave|circuito|interruptor)\b/i.test(text)) {
        bench.setSwitchClosed(true);
        response = bench.simulate().message;
      } else if (/\b(abra|abrir|desligue|desligar)\b.*\b(chave|circuito|interruptor)\b/i.test(text)) {
        bench.setSwitchClosed(false);
        response = bench.simulate().message;
      } else if (voltage) {
        bench.setSourceVoltage(parseNumber(voltage[1]!));
        response = bench.simulate().message;
      } else if (resistance) {
        bench.setResistance(parseNumber(resistance[1]!));
        response = bench.simulate().message;
      } else if (/\b(simule|simular|teste|testar)\b.*\b(circuito|led|bancada)\b/i.test(text)) {
        response = bench.simulate().message;
      } else if (/\b(me[cç]a|medir)\b.*\b(corrente|ampere|amperes)\b/i.test(text)) {
        const measurement = bench.measure("circuit-current");
        response = `Multímetro: ${measurement.value} ${measurement.unit} · ${measurement.source}.`;
      } else if (/\b(me[cç]a|medir)\b.*\b(tens[aã]o|voltagem)\b.*\bled\b/i.test(text)) {
        const measurement = bench.measure("led-voltage");
        response = `Multímetro no LED: ${measurement.value} ${measurement.unit} · ${measurement.source}.`;
      } else if (/\b(me[cç]a|medir)\b.*\b(tens[aã]o|voltagem)\b.*\bresistor\b/i.test(text)) {
        const measurement = bench.measure("resistor-voltage");
        response = `Multímetro no resistor: ${measurement.value} ${measurement.unit} · ${measurement.source}.`;
      } else {
        const execution = await intelligence.executeUtterance(text, {
          selectedEntityId: selectedId,
          lastEntityId: selectedId,
          source
        });
        response = execution.message;
        if (execution.targetEntityId) setSelectedId(execution.targetEntityId);
      }

      changed(response);
      if (source === "voice") speakStudioResponse(response);
    } catch (error) {
      const response = error instanceof Error ? error.message : "Comando eletrônico não pôde ser executado.";
      changed(response);
      if (source === "voice") speakStudioResponse(response);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runCommand(commandText, "ui");
  };

  const listen = () => {
    if (!speechSupported || listening) return;
    setListening(true);
    setMessage("Ouvindo comando da bancada eletrônica…");
    listenOnce(
      (result) => {
        setCommandText(result.transcript);
        void runCommand(result.transcript, "voice");
      },
      () => setListening(false),
      (error) => setMessage(error)
    );
  };

  if (!open) {
    return (
      <div className={styles.launcher} aria-label="Atalhos da Electronics Workbench">
        <button type="button" onClick={() => setOpen(true)}>Abrir Electronics Workbench</button>
        {saved ? <button type="button" onClick={restore}>Restaurar bancada eletrônica</button> : null}
      </div>
    );
  }

  return (
    <section className={styles.host} aria-label="Tehkné Electronics Workbench" data-revision={revision}>
      <Canvas className={styles.canvas} camera={{ position: [6.2, 4.8, 7.6], fov: 38 }} shadows onPointerMissed={() => setSelectedId(null)}>
        <color attach="background" args={["#171915"]} />
        <ambientLight intensity={0.82} />
        <directionalLight position={[5, 8, 5]} intensity={2.2} castShadow />
        <gridHelper args={[14, 28, "#45483f", "#272923"]} position={[0, -0.55, 0]} />
        <ElectronicsBenchAssembly session={session} selectedId={selectedId} onSelect={(entity) => setSelectedId(entity.id)} />
      </Canvas>

      <header className={styles.topbar}>
        <div className={styles.title}>
          <span>TEHKNÉ STUDIO · S2.8</span>
          <strong>Electronics Workbench · Circuito DC de Aprendizado</strong>
        </div>
        <div className={styles.topActions}>
          <button type="button" onClick={save}>Guardar experimento</button>
          {saved ? <button type="button" onClick={restore}>Restaurar</button> : null}
          <button type="button" onClick={() => setOpen(false)}>Voltar ao First Workbench</button>
        </div>
      </header>

      <ElectronicsWorkbenchPanel session={session} bench={bench} revision={revision} onChanged={changed} />

      {selected ? (
        <aside className={styles.inspector} aria-label="Componente eletrônico selecionado">
          <span>{selected.type}</span>
          <strong>{selected.name}</strong>
          <small>{selected.id} · {selected.state}</small>
          <dl className={styles.properties}>
            {Object.values(selected.properties).map((property) => (
              <div className={styles.property} key={property.id}>
                <dt>{property.id}</dt>
                <dd>
                  {String(property.value)}{property.unit ? ` ${property.unit}` : ""}
                  <small>{property.source}</small>
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      ) : null}

      <form className={styles.command} onSubmit={submit} aria-label="Electronics Studio Intelligence">
        <div className={styles.commandState}>
          <span>STUDIO INTELLIGENCE · ELECTRONICS</span>
          <p>{message}</p>
        </div>
        <div className={styles.commandRow}>
          <input
            aria-label="Comando para a bancada eletrônica"
            value={commandText}
            onChange={(event) => setCommandText(event.target.value)}
            placeholder="Ex.: feche a chave · resistor 100 ohms · meça corrente · por que o LED falhou?"
          />
          <button type="submit">Executar</button>
          <button type="button" onClick={listen} disabled={!speechSupported || listening}>{listening ? "Ouvindo…" : "Voz"}</button>
        </div>
      </form>
    </section>
  );
}
