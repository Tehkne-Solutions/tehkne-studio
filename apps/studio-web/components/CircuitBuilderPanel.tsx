"use client";

import { useMemo, useState } from "react";
import type { EngineeringSession } from "../../../packages/engineering-session/src/index";
import {
  type CircuitBuilder,
  type CircuitComponentKind,
  type CircuitSimulationResult,
  type CircuitTerminalRef,
  type CircuitVoltageProbeRecord
} from "../../../packages/circuit-runtime/src/index";
import styles from "./ElectronicsWorkbenchPanel.module.css";

interface CircuitBuilderPanelProps {
  readonly session: EngineeringSession;
  readonly builder: CircuitBuilder;
  readonly revision: number;
  readonly onChanged: (message: string) => void;
}

function terminalLabel(session: EngineeringSession, terminal: CircuitTerminalRef): string {
  const entity = session.getEntity(terminal.entityId);
  return `${entity.name} · ${terminal.portId}`;
}

export function CircuitBuilderPanel({ session, builder, revision, onChanged }: CircuitBuilderPanelProps) {
  const [fromKey, setFromKey] = useState("");
  const [toKey, setToKey] = useState("");
  const [result, setResult] = useState<CircuitSimulationResult | null>(() => builder.records().at(-1) ?? null);
  const [probe, setProbe] = useState<CircuitVoltageProbeRecord | null>(() => builder.probes().at(-1) ?? null);
  const [resistance, setResistance] = useState("330");

  const components = useMemo(() => builder.components(), [builder, revision]);
  const wires = useMemo(() => builder.wires(), [builder, revision]);
  const outputs = useMemo(() => builder.availableOutputs(), [builder, revision]);
  const inputs = useMemo(() => builder.availableInputs(), [builder, revision]);

  const changed = (message: string) => {
    setResult(builder.records().at(-1) ?? null);
    setProbe(builder.probes().at(-1) ?? null);
    onChanged(message);
  };

  const add = (kind: CircuitComponentKind) => {
    try {
      const entity = builder.addComponent(kind);
      changed(`${entity.name} adicionado ao Circuit Graph.`);
    } catch (error) {
      changed(error instanceof Error ? error.message : "Componente não pôde ser adicionado.");
    }
  };

  const reset = () => {
    builder.reset();
    setFromKey("");
    setToKey("");
    setResult(null);
    setProbe(null);
    onChanged("Novo circuito vazio criado. Adicione componentes e conecte os terminais.");
  };

  const series = () => {
    builder.createSeriesLedCircuit();
    setFromKey("");
    setToKey("");
    setResult(null);
    setProbe(null);
    onChanged("Circuito série materializado no Engineering Graph. Feche a chave para energizar.");
  };

  const connect = () => {
    try {
      const from = outputs.find((terminal) => `${terminal.entityId}:${terminal.portId}` === fromKey);
      const to = inputs.find((terminal) => `${terminal.entityId}:${terminal.portId}` === toKey);
      if (!from || !to) throw new Error("Selecione um terminal de saída e um terminal de entrada livres.");
      const wire = builder.connect(from, to);
      setFromKey("");
      setToKey("");
      changed(`Fio ${wire.id} conectado: ${terminalLabel(session, from)} → ${terminalLabel(session, to)}.`);
    } catch (error) {
      changed(error instanceof Error ? error.message : "Ligação bloqueada.");
    }
  };

  const simulate = () => {
    try {
      const next = builder.simulate();
      setResult(next);
      onChanged(next.message);
    } catch (error) {
      changed(error instanceof Error ? error.message : "Circuito não pôde ser simulado.");
    }
  };

  const toggleSwitch = () => {
    try {
      const switchEntity = components.find((entity) => entity.metadata.circuitKind === "switch");
      if (!switchEntity) throw new Error("Adicione uma chave ao circuito primeiro.");
      const closed = switchEntity.properties.closed?.value === true;
      builder.setSwitchClosed(switchEntity.id, !closed);
      const next = builder.simulate();
      setResult(next);
      onChanged(`${!closed ? "Chave fechada" : "Chave aberta"}. ${next.message}`);
    } catch (error) {
      changed(error instanceof Error ? error.message : "Chave não pôde ser alterada.");
    }
  };

  const applyResistance = () => {
    try {
      const resistor = components.find((entity) => entity.metadata.circuitKind === "resistor");
      if (!resistor) throw new Error("Adicione um resistor ao circuito primeiro.");
      const value = Number(resistance.replace(",", "."));
      builder.setComponentValue(resistor.id, "resistanceOhm", value);
      changed(`${resistor.name} ajustado para ${value} Ω.`);
    } catch (error) {
      changed(error instanceof Error ? error.message : "Resistência não pôde ser alterada.");
    }
  };

  const probeSource = () => {
    try {
      const source = components.find((entity) => entity.metadata.circuitKind === "dc-source");
      if (!source) throw new Error("Adicione uma fonte DC primeiro.");
      const placed = builder.placeVoltageProbe(
        "Probe da fonte",
        { entityId: source.id, portId: "positive" },
        { entityId: source.id, portId: "negative" }
      );
      const measured = builder.measureProbe(placed.id);
      setProbe(measured);
      setResult(builder.records().at(-1) ?? null);
      onChanged(`Probe da fonte: ${measured.valueV} V · ${measured.source}.`);
    } catch (error) {
      changed(error instanceof Error ? error.message : "Probe não pôde ser medido.");
    }
  };

  const probeResistor = () => {
    try {
      const resistor = components.find((entity) => entity.metadata.circuitKind === "resistor");
      if (!resistor) throw new Error("Adicione um resistor primeiro.");
      const placed = builder.placeVoltageProbe(
        `Probe ${resistor.name}`,
        { entityId: resistor.id, portId: "input" },
        { entityId: resistor.id, portId: "output" }
      );
      const measured = builder.measureProbe(placed.id);
      setProbe(measured);
      setResult(builder.records().at(-1) ?? null);
      onChanged(`${resistor.name}: queda de ${measured.valueV} V · ${measured.source}.`);
    } catch (error) {
      changed(error instanceof Error ? error.message : "Probe não pôde ser medido.");
    }
  };

  const circuitCurrentMa = (result?.circuitCurrentA ?? 0) * 1000;

  return (
    <aside className={styles.panel} aria-label="Circuit Builder">
      <header className={styles.header}>
        <div>
          <span>S2.9 · CIRCUIT CREATION & MEASUREMENT</span>
          <strong>Componentes → Terminais → Fios → Solver → Probes</strong>
        </div>
        <div className={styles.status}>{result?.status.toUpperCase() ?? "EDITING"}</div>
      </header>

      <div className={styles.actions}>
        <button type="button" onClick={reset}>Novo circuito</button>
        <button type="button" onClick={series}>Montar exemplo série</button>
        <button type="button" onClick={() => add("dc-source")}>+ Fonte</button>
        <button type="button" onClick={() => add("switch")}>+ Chave</button>
        <button type="button" onClick={() => add("resistor")}>+ Resistor</button>
        <button type="button" onClick={() => add("led")}>+ LED</button>
      </div>

      <span className={styles.sectionTitle}>CIRCUIT GRAPH · {components.length} COMPONENTES · {wires.length} FIOS</span>
      <div className={styles.topology}>
        {components.map((entity) => (
          <div key={entity.id} className={styles.topologyRow}>
            <small>{String(entity.metadata.circuitKind).toUpperCase()}</small>
            <strong>{entity.name}</strong>
            <span>{entity.id} · {entity.state}</span>
          </div>
        ))}
        {components.length === 0 ? <p>Nenhum componente. A topologia começa vazia.</p> : null}
      </div>

      <span className={styles.sectionTitle}>WIRING</span>
      <div className={styles.controls}>
        <label className={styles.field}>
          Terminal de saída
          <select aria-label="Terminal de saída do fio" value={fromKey} onChange={(event) => setFromKey(event.target.value)}>
            <option value="">Selecionar…</option>
            {outputs.map((terminal) => {
              const key = `${terminal.entityId}:${terminal.portId}`;
              return <option key={key} value={key}>{terminalLabel(session, terminal)}</option>;
            })}
          </select>
        </label>
        <label className={styles.field}>
          Terminal de entrada
          <select aria-label="Terminal de entrada do fio" value={toKey} onChange={(event) => setToKey(event.target.value)}>
            <option value="">Selecionar…</option>
            {inputs.map((terminal) => {
              const key = `${terminal.entityId}:${terminal.portId}`;
              return <option key={key} value={key}>{terminalLabel(session, terminal)}</option>;
            })}
          </select>
        </label>
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={connect}>Conectar fio</button>
        {wires.map((wire) => <button type="button" key={wire.id} onClick={() => { builder.disconnect(wire.id); changed(`${wire.id} removido.`); }}>Remover {wire.id}</button>)}
      </div>

      <span className={styles.sectionTitle}>SIMULAÇÃO SUPORTADA · LOOP DC SÉRIE</span>
      <div className={styles.controls}>
        <label className={styles.field}>
          Primeiro resistor · ohms
          <input aria-label="Resistência do Circuit Builder" value={resistance} onChange={(event) => setResistance(event.target.value)} inputMode="decimal" />
        </label>
        <div className={styles.field}>
          Operação
          <div className={styles.actions}>
            <button type="button" onClick={applyResistance}>Aplicar Ω</button>
            <button type="button" onClick={toggleSwitch}>Alternar chave</button>
            <button type="button" onClick={simulate}>Simular</button>
          </div>
        </div>
      </div>

      <div className={styles.readouts}>
        <div className={styles.readout}><small>Corrente</small><strong>{circuitCurrentMa.toFixed(2)} mA</strong></div>
        <div className={styles.readout}><small>R total</small><strong>{(result?.totalResistanceOhm ?? 0).toFixed(1)} Ω</strong></div>
        <div className={styles.readout}><small>V LED</small><strong>{(result?.ledVoltageV ?? 0).toFixed(3)} V</strong></div>
        <div className={styles.readout}><small>Margem I</small><strong>{(result?.currentMarginPercent ?? 0).toFixed(1)}%</strong></div>
      </div>

      <div className={styles.message} data-status={result?.status ?? "incomplete"}>
        {result?.message ?? "Monte e conecte um loop série. Topologias fora do solver suportado ficam bloqueadas sem números inventados."}
      </div>

      <span className={styles.sectionTitle}>VOLTAGE PROBES</span>
      <div className={styles.measurements}>
        <button type="button" onClick={probeSource}>Probe da fonte</button>
        <button type="button" onClick={probeResistor}>Probe do resistor</button>
      </div>
      {probe ? (
        <div className={styles.measurement} aria-label="Última medição do Circuit Builder">
          <small>{probe.label} · {probe.source} · {probe.simulationId ?? "sem simulação"}</small>
          <strong>{probe.valueV ?? 0} V</strong>
        </div>
      ) : null}

      <p className={styles.note}>
        O solver S2.9 cobre loops DC série simples. Circuitos ramificados, AC e componentes reativos permanecem explicitamente fora deste modelo até haver solver correspondente.
      </p>
    </aside>
  );
}
