"use client";

import { useEffect, useState } from "react";
import type { EngineeringSession } from "../../../packages/engineering-session/src/index";
import {
  type ElectronicsBench,
  type ElectronicsMeasurement,
  type ElectronicsMeasurementKind,
  type ElectronicsSimulationResult
} from "../../../packages/electronics-runtime/src/index";
import styles from "./ElectronicsWorkbenchPanel.module.css";

interface ElectronicsWorkbenchPanelProps {
  readonly session: EngineeringSession;
  readonly bench: ElectronicsBench;
  readonly revision: number;
  readonly onChanged: (message: string) => void;
}

const measurements: readonly [ElectronicsMeasurementKind, string][] = [
  ["source-voltage", "Fonte V"],
  ["circuit-current", "Corrente"],
  ["resistor-voltage", "V resistor"],
  ["led-voltage", "V LED"],
  ["resistor-power", "P resistor"],
  ["led-power", "P LED"]
];

export function ElectronicsWorkbenchPanel({ session, bench, revision, onChanged }: ElectronicsWorkbenchPanelProps) {
  const source = session.getEntity("electronics.source");
  const resistor = session.getEntity("electronics.resistor");
  const switchEntity = session.getEntity("electronics.switch");
  const [voltage, setVoltage] = useState(String(source.properties.voltageV?.value ?? 5));
  const [resistance, setResistance] = useState(String(resistor.properties.resistanceOhm?.value ?? 330));
  const [result, setResult] = useState<ElectronicsSimulationResult | null>(() => bench.records().at(-1) ?? null);
  const [measurement, setMeasurement] = useState<ElectronicsMeasurement | null>(null);

  useEffect(() => {
    setVoltage(String(session.getEntity("electronics.source").properties.voltageV?.value ?? 5));
    setResistance(String(session.getEntity("electronics.resistor").properties.resistanceOhm?.value ?? 330));
    setResult(bench.records().at(-1) ?? null);
  }, [bench, session, revision]);

  const applyInputs = () => {
    const voltageV = Number(voltage.replace(",", "."));
    const resistanceOhm = Number(resistance.replace(",", "."));
    bench.setSourceVoltage(voltageV);
    bench.setResistance(resistanceOhm);
  };

  const simulate = () => {
    try {
      applyInputs();
      const next = bench.simulate();
      setResult(next);
      setMeasurement(null);
      onChanged(next.message);
    } catch (error) {
      onChanged(error instanceof Error ? error.message : "Não foi possível simular o circuito.");
    }
  };

  const toggleSwitch = () => {
    const closed = session.getEntity("electronics.switch").properties.closed?.value === true;
    bench.setSwitchClosed(!closed);
    const next = bench.simulate();
    setResult(next);
    setMeasurement(null);
    onChanged(`${!closed ? "Chave fechada" : "Chave aberta"}. ${next.message}`);
  };

  const applyPreset = (kind: "safe" | "fault") => {
    if (kind === "safe") {
      setVoltage("5");
      setResistance("330");
      bench.setSourceVoltage(5);
      bench.setResistance(330);
      bench.setSwitchClosed(true);
    } else {
      setVoltage("5");
      setResistance("100");
      bench.setSourceVoltage(5);
      bench.setResistance(100);
      bench.setSwitchClosed(true);
    }
    const next = bench.simulate();
    setResult(next);
    setMeasurement(null);
    onChanged(next.message);
  };

  const measure = (kind: ElectronicsMeasurementKind) => {
    try {
      applyInputs();
      const next = bench.measure(kind);
      setMeasurement(next);
      setResult(bench.records().at(-1) ?? null);
      onChanged(`Multímetro: ${next.value} ${next.unit} · source ${next.source}.`);
    } catch (error) {
      onChanged(error instanceof Error ? error.message : "Medição indisponível.");
    }
  };

  const closed = switchEntity.properties.closed?.value === true;
  const currentMa = result ? result.circuitCurrentA * 1000 : 0;
  const parsedVoltage = Number(voltage.replace(",", "."));
  const displayVoltage = result?.sourceVoltageV ?? (Number.isFinite(parsedVoltage) ? parsedVoltage : 0);

  return (
    <aside className={styles.panel} aria-label="Electronics Workbench">
      <header className={styles.header}>
        <div>
          <span>S2.8 · ELECTRONICS WORKBENCH</span>
          <strong>Fonte → Chave → Resistor → LED</strong>
        </div>
        <div className={styles.status}>{result?.status.toUpperCase() ?? (closed ? "READY" : "OPEN")}</div>
      </header>

      <div className={styles.controls}>
        <label className={styles.field}>
          Fonte DC · volts
          <input aria-label="Tensão da fonte" value={voltage} onChange={(event) => setVoltage(event.target.value)} inputMode="decimal" />
        </label>
        <label className={styles.field}>
          Resistor · ohms
          <input aria-label="Resistência do resistor" value={resistance} onChange={(event) => setResistance(event.target.value)} inputMode="decimal" />
        </label>
      </div>

      <div className={styles.actions}>
        <button type="button" onClick={toggleSwitch}>{closed ? "Abrir chave" : "Fechar chave"}</button>
        <button type="button" onClick={simulate}>Simular circuito</button>
        <button type="button" onClick={() => applyPreset("safe")}>Preset seguro · 330 Ω</button>
        <button type="button" onClick={() => applyPreset("fault")}>Teste de falha · 100 Ω</button>
      </div>

      <span className={styles.sectionTitle}>ENGINEERING READOUT</span>
      <div className={styles.readouts}>
        <div className={styles.readout}><small>Fonte</small><strong>{displayVoltage} V</strong></div>
        <div className={styles.readout}><small>Corrente</small><strong>{currentMa.toFixed(2)} mA</strong></div>
        <div className={styles.readout}><small>V resistor</small><strong>{(result?.resistorVoltageV ?? 0).toFixed(3)} V</strong></div>
        <div className={styles.readout}><small>V LED</small><strong>{(result?.ledVoltageV ?? 0).toFixed(3)} V</strong></div>
        <div className={styles.readout}><small>P resistor</small><strong>{(result?.resistorPowerW ?? 0).toFixed(4)} W</strong></div>
        <div className={styles.readout}><small>Margem I</small><strong>{(result?.currentMarginPercent ?? 100).toFixed(1)}%</strong></div>
      </div>

      <div className={styles.message} data-status={result?.status ?? "open"}>
        {result?.message ?? "Feche a chave e simule para observar corrente, tensão e potência."}
      </div>

      <span className={styles.sectionTitle}>MULTÍMETRO VIRTUAL</span>
      <div className={styles.measurements}>
        {measurements.map(([kind, label]) => (
          <button type="button" key={kind} onClick={() => measure(kind)}>{label}</button>
        ))}
      </div>
      {measurement ? (
        <div className={styles.measurement} aria-label="Última medição do multímetro">
          <small>{measurement.kind} · {measurement.source}</small>
          <strong>{measurement.value} {measurement.unit}</strong>
        </div>
      ) : null}

      <p className={styles.note}>
        Modelo funcional educacional. Valores marked as calculated/simulated não representam medição física de bancada.
        A etapa S2.9 generaliza netlists, instrumentos e montagem livre.
      </p>
    </aside>
  );
}
