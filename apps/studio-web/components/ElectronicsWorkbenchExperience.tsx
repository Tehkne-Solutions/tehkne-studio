"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { EngineeringEntity } from "../../../packages/engineering-core/src/index";
import { EngineeringSession } from "../../../packages/engineering-session/src/index";
import {
  CircuitBuilder,
  type CircuitBuilderRestoreState,
  type CircuitComponentKind
} from "../../../packages/circuit-runtime/src/index";
import {
  ElectronicsBench,
  createElectronicsWorkbenchProject,
  type ElectronicsBenchRestoreState,
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
import { CircuitBuilderAssembly } from "./CircuitBuilderAssembly";
import { CircuitBuilderPanel } from "./CircuitBuilderPanel";
import { ElectronicsBenchAssembly } from "./ElectronicsBenchAssembly";
import { ElectronicsWorkbenchPanel } from "./ElectronicsWorkbenchPanel";
import styles from "./ElectronicsWorkbenchExperience.module.css";

interface ElectronicsRuntimeBundle {
  readonly session: EngineeringSession;
  readonly bench: ElectronicsBench;
  readonly circuitBuilder: CircuitBuilder;
  readonly intelligence: StudioIntelligence;
}

interface ElectronicsPersistenceState {
  readonly records: ReturnType<ElectronicsBench["records"]>;
}

interface CircuitBuilderPersistenceState {
  readonly records: ReturnType<CircuitBuilder["records"]>;
  readonly probes: ReturnType<CircuitBuilder["probes"]>;
}

interface ElectronicsWorkspaceState {
  readonly mode: "preset" | "builder";
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
  const electronicsExtension = objectExtension(snapshot, "electronicsBench") as Partial<ElectronicsPersistenceState>;
  const benchRestore: ElectronicsBenchRestoreState = { records: electronicsExtension.records ?? [] };
  const bench = new ElectronicsBench(session, benchRestore);
  const circuitExtension = objectExtension(snapshot, "circuitBuilder") as Partial<CircuitBuilderPersistenceState>;
  const circuitRestore: CircuitBuilderRestoreState = {
    records: circuitExtension.records ?? [],
    probes: circuitExtension.probes ?? []
  };
  const circuitBuilder = new CircuitBuilder(session, circuitRestore);
  const intelligence = new StudioIntelligence(session);
  return { session, bench, circuitBuilder, intelligence };
}

function parseNumber(text: string): number {
  return Number(text.replace(",", "."));
}

export function ElectronicsWorkbenchExperience() {
  const [open, setOpen] = useState(false);
  const [runtime, setRuntime] = useState<ElectronicsRuntimeBundle>(() => createRuntime());
  const [mode, setMode] = useState<"preset" | "builder">("preset");
  const [selectedId, setSelectedId] = useState<string | null>("electronics.root");
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("Bancada pronta. Use o preset S2.8 ou entre no Circuit Builder S2.9 para montar a topologia.");
  const [commandText, setCommandText] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [saved, setSaved] = useState(false);
  const { session, bench, circuitBuilder, intelligence } = runtime;

  useEffect(() => {
    setSpeechSupported(browserSpeechSupported());
    setSaved(browserProjectExists("electronics"));
  }, []);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    try {
      return session.getEntity(selectedId);
    } catch {
      return null;
    }
  }, [session, selectedId, revision]);

  const changed = (nextMessage: string) => {
    setMessage(nextMessage);
    setRevision((current) => current + 1);
  };

  const save = () => {
    const electronicsState: ElectronicsPersistenceState = { records: bench.records() };
    const circuitState: CircuitBuilderPersistenceState = { records: circuitBuilder.records(), probes: circuitBuilder.probes() };
    const workspace: ElectronicsWorkspaceState = { mode };
    const snapshot = createSessionSnapshot(session, {
      extensions: { electronicsBench: electronicsState, circuitBuilder: circuitState, electronicsWorkspace: workspace }
    });
    saveBrowserProject("electronics", snapshot);
    setSaved(true);
    setMessage(`Electronics Workbench salva · ${bench.records().length} simulações S2.8 · ${circuitBuilder.records().length} simulações S2.9 · ${circuitBuilder.wires().length} fios.`);
  };

  const restore = () => {
    try {
      const snapshot = loadBrowserProject("electronics");
      if (!snapshot) throw new Error("Não existe Electronics Workbench salva.");
      const restored = createRuntime(snapshot);
      const workspace = objectExtension(snapshot, "electronicsWorkspace") as Partial<ElectronicsWorkspaceState>;
      const restoredMode = workspace.mode === "builder" ? "builder" : "preset";
      setRuntime(restored);
      setMode(restoredMode);
      setSelectedId(restoredMode === "builder" ? "circuit.root" : "electronics.root");
      setRevision((current) => current + 1);
      setOpen(true);
      setMessage(`Electronics Workbench restaurada · ${restored.bench.records().length} simulações S2.8 · ${restored.circuitBuilder.records().length} simulações S2.9 · sem replay.`);
    } catch (error) {
      setMessage(error instanceof Error ? `RESTORE BLOCKED · ${error.message}` : "RESTORE BLOCKED");
    }
  };

  const builderComponent = (kind: CircuitComponentKind): EngineeringEntity | undefined =>
    circuitBuilder.components().find((entity) => entity.metadata.circuitKind === kind);

  const connectCanonical = (left: CircuitComponentKind, right: CircuitComponentKind): string => {
    const from = builderComponent(left);
    const to = builderComponent(right);
    if (!from || !to) throw new Error(`Adicione ${left} e ${right} antes de conectar.`);
    const terminals: Readonly<Record<CircuitComponentKind, readonly [string, string]>> = {
      "dc-source": ["negative", "positive"],
      switch: ["input", "output"],
      resistor: ["input", "output"],
      led: ["anode", "cathode"]
    };
    const fromPort = terminals[left][1];
    const toPort = right === "dc-source" ? terminals[right][0] : terminals[right][0];
    const wire = circuitBuilder.connect({ entityId: from.id, portId: fromPort }, { entityId: to.id, portId: toPort });
    return `${wire.id}: ${from.name} → ${to.name}`;
  };

  const runBuilderCommand = (text: string): string | null => {
    if (/\b(novo|limpe|zerar|reinicie)\b.*\bcircuito\b/i.test(text)) {
      circuitBuilder.reset();
      setSelectedId("circuit.root");
      return "Novo Circuit Project vazio criado. Componentes, fios e probes anteriores foram removidos do Circuit Graph.";
    }
    if (/\b(monte|montar|crie|criar)\b.*\b(circuito|loop)\b.*\b(serie|série|led)\b/i.test(text)) {
      circuitBuilder.createSeriesLedCircuit();
      setSelectedId("circuit.root");
      return "Circuito série criado: fonte → chave → resistor → LED → retorno. A chave permanece aberta.";
    }
    const addMatch = text.match(/\b(adicione|adicionar|coloque|inserir|insira)\b.*\b(fonte|chave|interruptor|resistor|led)\b/i);
    if (addMatch) {
      const word = addMatch[2]!.toLowerCase();
      const kind: CircuitComponentKind = word === "fonte" ? "dc-source" : word === "chave" || word === "interruptor" ? "switch" : word === "resistor" ? "resistor" : "led";
      const entity = circuitBuilder.addComponent(kind);
      setSelectedId(entity.id);
      return `${entity.name} adicionado ao Circuit Graph.`;
    }
    if (/\bconecte\b.*\bfonte\b.*\bchave|\bconecte\b.*\bfonte\b.*\binterruptor/i.test(text)) return connectCanonical("dc-source", "switch");
    if (/\bconecte\b.*\b(chave|interruptor)\b.*\bresistor/i.test(text)) return connectCanonical("switch", "resistor");
    if (/\bconecte\b.*\bresistor\b.*\bled/i.test(text)) return connectCanonical("resistor", "led");
    if (/\bconecte\b.*\bled\b.*\bfonte/i.test(text)) return connectCanonical("led", "dc-source");

    const resistance = text.match(/(?:resistor|resist[eê]ncia).*?(\d+(?:[,.]\d+)?)\s*(?:ohm|ohms|Ω)/i);
    if (resistance) {
      const resistor = builderComponent("resistor");
      if (!resistor) throw new Error("Adicione um resistor ao Circuit Builder primeiro.");
      const value = parseNumber(resistance[1]!);
      circuitBuilder.setComponentValue(resistor.id, "resistanceOhm", value);
      return `${resistor.name} ajustado para ${value} Ω.`;
    }
    if (/\b(feche|fechar|ligue|ligar)\b.*\b(chave|circuito|interruptor)\b/i.test(text)) {
      const switchEntity = builderComponent("switch");
      if (!switchEntity) throw new Error("Adicione uma chave ao Circuit Builder primeiro.");
      circuitBuilder.setSwitchClosed(switchEntity.id, true);
      return circuitBuilder.simulate().message;
    }
    if (/\b(abra|abrir|desligue|desligar)\b.*\b(chave|circuito|interruptor)\b/i.test(text)) {
      const switchEntity = builderComponent("switch");
      if (!switchEntity) throw new Error("Adicione uma chave ao Circuit Builder primeiro.");
      circuitBuilder.setSwitchClosed(switchEntity.id, false);
      return circuitBuilder.simulate().message;
    }
    if (/\b(simule|simular|teste|testar)\b.*\b(circuito|montagem|loop)\b/i.test(text)) return circuitBuilder.simulate().message;
    if (/\b(me[cç]a|medir)\b.*\b(corrente|ampere|amperes)\b/i.test(text)) {
      const result = circuitBuilder.simulate();
      if (result.status === "incomplete" || result.status === "unsupported") return result.message;
      return `Circuit Builder: ${(result.circuitCurrentA * 1000).toFixed(2)} mA · calculated · ${result.id}.`;
    }
    if (/\b(me[cç]a|medir)\b.*\b(tens[aã]o|voltagem)\b.*\bfonte\b/i.test(text)) {
      const source = builderComponent("dc-source");
      if (!source) throw new Error("Adicione uma fonte ao Circuit Builder primeiro.");
      const probe = circuitBuilder.placeVoltageProbe("Probe da fonte", { entityId: source.id, portId: "positive" }, { entityId: source.id, portId: "negative" });
      const measurement = circuitBuilder.measureProbe(probe.id);
      setSelectedId(measurement.entityId);
      return `Probe da fonte: ${measurement.valueV} V · ${measurement.source}.`;
    }
    if (/\b(me[cç]a|medir)\b.*\b(tens[aã]o|voltagem)\b.*\bresistor\b/i.test(text)) {
      const resistor = builderComponent("resistor");
      if (!resistor) throw new Error("Adicione um resistor ao Circuit Builder primeiro.");
      const probe = circuitBuilder.placeVoltageProbe(`Probe ${resistor.name}`, { entityId: resistor.id, portId: "input" }, { entityId: resistor.id, portId: "output" });
      const measurement = circuitBuilder.measureProbe(probe.id);
      setSelectedId(measurement.entityId);
      return `${resistor.name}: ${measurement.valueV} V · ${measurement.source}.`;
    }
    return null;
  };

  const runCommand = async (utterance: string, source: "ui" | "voice") => {
    const text = utterance.trim();
    if (!text) return;
    setCommandText(text);
    try {
      let response = "";
      if (mode === "builder") {
        response = runBuilderCommand(text) ?? "";
      }

      if (!response && mode === "preset") {
        const voltage = text.match(/(?:fonte|tens[aã]o).*?(\d+(?:[,.]\d+)?)\s*(?:v|volt)/i);
        const resistance = text.match(/(?:resistor|resist[eê]ncia).*?(\d+(?:[,.]\d+)?)\s*(?:ohm|ohms|Ω)/i);
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
        }
      }

      if (!response) {
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

  const switchMode = (next: "preset" | "builder") => {
    setMode(next);
    setSelectedId(next === "builder" ? "circuit.root" : "electronics.root");
    setMessage(next === "builder"
      ? "Circuit Builder S2.9 ativo. Monte componentes e fios; apenas topologias suportadas serão resolvidas."
      : "Preset S2.8 ativo. Circuito DC de aprendizado preservado sem alterações.");
    setRevision((current) => current + 1);
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
    <section className={styles.host} aria-label="Tehkné Electronics Workbench" data-revision={revision} data-mode={mode}>
      <Canvas className={styles.canvas} camera={{ position: [6.2, 4.8, 7.6], fov: 38 }} shadows onPointerMissed={() => setSelectedId(null)}>
        <color attach="background" args={["#171915"]} />
        <ambientLight intensity={0.82} />
        <directionalLight position={[5, 8, 5]} intensity={2.2} castShadow />
        <gridHelper args={[14, 28, "#45483f", "#272923"]} position={[0, -0.55, 0]} />
        {mode === "builder"
          ? <CircuitBuilderAssembly session={session} selectedId={selectedId} onSelect={(entity) => setSelectedId(entity.id)} />
          : <ElectronicsBenchAssembly session={session} selectedId={selectedId} onSelect={(entity) => setSelectedId(entity.id)} />}
      </Canvas>

      <header className={styles.topbar}>
        <div className={styles.title}>
          <span>TEHKNÉ STUDIO · S2.9</span>
          <strong>{mode === "builder" ? "Circuit Builder · Criação e Medição" : "Electronics Workbench · Preset DC S2.8"}</strong>
        </div>
        <div className={styles.topActions}>
          <button type="button" onClick={() => switchMode(mode === "builder" ? "preset" : "builder")}>{mode === "builder" ? "Abrir preset S2.8" : "Abrir Circuit Builder S2.9"}</button>
          <button type="button" onClick={save}>Guardar experimento</button>
          {saved ? <button type="button" onClick={restore}>Restaurar</button> : null}
          <button type="button" onClick={() => setOpen(false)}>Voltar ao First Workbench</button>
        </div>
      </header>

      {mode === "builder"
        ? <CircuitBuilderPanel session={session} builder={circuitBuilder} revision={revision} onChanged={changed} />
        : <ElectronicsWorkbenchPanel session={session} bench={bench} revision={revision} onChanged={changed} />}

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
          <span>STUDIO INTELLIGENCE · ELECTRONICS · {mode === "builder" ? "CIRCUIT BUILDER" : "PRESET"}</span>
          <p>{message}</p>
        </div>
        <div className={styles.commandRow}>
          <input
            aria-label="Comando para a bancada eletrônica"
            value={commandText}
            onChange={(event) => setCommandText(event.target.value)}
            placeholder={mode === "builder"
              ? "Ex.: monte circuito série · conecte resistor no LED · feche a chave · meça tensão no resistor"
              : "Ex.: feche a chave · resistor 100 ohms · meça corrente · por que o LED falhou?"}
          />
          <button type="submit">Executar</button>
          <button type="button" onClick={listen} disabled={!speechSupported || listening}>{listening ? "Ouvindo…" : "Voz"}</button>
        </div>
      </form>
    </section>
  );
}
