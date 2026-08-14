"use client";

import { useMemo, useState } from "react";
import type { ArmActuatorEnvelope, FailureTraceStep } from "../../../packages/failure-simulation/src/index";
import { ArmFailureLab } from "../../../packages/studio-failure/src/index";
import type { Arm01Controller } from "../../../packages/studio-robotics/src/index";
import failureProfile from "../../../presets/arm-01/failure-profile.json";
import styles from "./ArmRuntimePanel.module.css";

interface ArmRuntimePanelProps {
  readonly controller: Arm01Controller;
  readonly revision: number;
  readonly onPick: () => void;
}

function angle(controller: Arm01Controller, entityId: string): string {
  const value = controller.session.getEntity(entityId).properties.angleDeg?.value;
  return typeof value === "number" ? `${value.toFixed(1)}°` : "—";
}

function assessmentLabel(status: string): string {
  if (status === "fault") return "FAULT";
  if (status === "warning") return "WARNING";
  return "PASS";
}

export function ArmRuntimePanel({ controller, revision, onPick }: ArmRuntimePanelProps) {
  const failureLab = useMemo(
    () => new ArmFailureLab(controller.session, failureProfile as ArmActuatorEnvelope),
    [controller]
  );
  const [failureRevision, setFailureRevision] = useState(0);
  const [trace, setTrace] = useState<readonly FailureTraceStep[]>([]);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const robot = controller.session.getEntity("arm.root");
  const gripper = controller.session.getEntity("arm.gripper");
  const cube = controller.session.getEntity("object.cube.red");
  const recent = controller.records().slice(-4);
  const latest = failureLab.latest();

  const runFailureCase = (massKg: number) => {
    try {
      const record = failureLab.run(massKg);
      setTrace([]);
      setFailureMessage(
        `${assessmentLabel(record.assessment.status)} · ${record.assessment.requiredTorqueNm} N·m · ${record.assessment.currentA} A · ${record.assessment.temperatureC} °C`
      );
      setFailureRevision((current) => current + 1);
    } catch (error) {
      setFailureMessage(error instanceof Error ? error.message : "Failure Lab não conseguiu executar o cenário.");
    }
  };

  const explainFailure = () => {
    try {
      const explanation = failureLab.explainLatest();
      setTrace(explanation.trace);
      setFailureMessage(explanation.message);
      setFailureRevision((current) => current + 1);
    } catch (error) {
      setFailureMessage(error instanceof Error ? error.message : "Não existe evidência suficiente para explicar.");
    }
  };

  return (
    <aside
      className={styles.panel}
      aria-label="ARM-01 Robotics Runtime"
      data-revision={`${revision}-${failureRevision}`}
    >
      <div className={styles.heading}>
        <span>ROBOTICS RUNTIME</span>
        <small>{String(robot.properties.taskState?.value ?? robot.state).toUpperCase()}</small>
      </div>

      <div className={styles.joints}>
        <div><small>BASE</small><strong>{angle(controller, "arm.joint.base")}</strong></div>
        <div><small>SHOULDER</small><strong>{angle(controller, "arm.joint.shoulder")}</strong></div>
        <div><small>ELBOW</small><strong>{angle(controller, "arm.joint.elbow")}</strong></div>
        <div><small>GRIPPER</small><strong>{String(gripper.properties.openingMm?.value)} mm</strong></div>
      </div>

      <div className={styles.workpiece}>
        <span>WORKPIECE</span>
        <strong>{cube.name}</strong>
        <small>{cube.state} · {String(cube.properties.massKg?.value)} kg</small>
      </div>

      {recent.length > 0 ? (
        <div className={styles.timeline} aria-label="Motion plan timeline">
          <span>MOTION PLAN</span>
          {recent.map((record) => (
            <div key={`${record.waypointId}-${record.occurredAt}`}>
              <small>{record.waypointId.toUpperCase()}</small>
              <strong>{record.label}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.empty}>Diga “Pegue o cubo vermelho” ou use o Failure Lab para testar o envelope antes do movimento.</p>
      )}

      <section className={styles.failureLab} aria-label="ARM-01 Failure Lab">
        <div className={styles.failureHeading}>
          <span>FAILURE LAB</span>
          <small>{latest ? assessmentLabel(latest.assessment.status) : "READY"}</small>
        </div>
        <div className={styles.failureCases}>
          <button type="button" onClick={() => runFailureCase(0.35)} disabled={cube.state !== "free"}>0,35 kg</button>
          <button type="button" onClick={() => runFailureCase(1.25)} disabled={cube.state !== "free"}>1,25 kg</button>
          <button type="button" onClick={() => runFailureCase(1.6)} disabled={cube.state !== "free"}>1,60 kg</button>
        </div>

        {latest ? (
          <div className={styles.failureMetrics} data-status={latest.assessment.status}>
            <div><small>TORQUE</small><strong>{latest.assessment.requiredTorqueNm} N·m</strong></div>
            <div><small>CURRENT</small><strong>{latest.assessment.currentA} A</strong></div>
            <div><small>THERMAL</small><strong>{latest.assessment.temperatureC} °C</strong></div>
            <div><small>MARGIN</small><strong>{latest.assessment.limitingMarginPercent}%</strong></div>
          </div>
        ) : null}

        {failureMessage ? <p className={styles.failureMessage}>{failureMessage}</p> : null}

        {latest ? (
          <button className={styles.whyButton} type="button" onClick={explainFailure}>
            Por que este resultado aconteceu?
          </button>
        ) : null}

        {trace.length > 0 ? (
          <div className={styles.failureTrace} aria-label="Failure causal trace">
            <span>CAUSAL TRACE</span>
            {trace.map((step, index) => (
              <div key={step.id}>
                <small>{index + 1}</small>
                <section>
                  <strong>{step.label}</strong>
                  <p>{step.detail}</p>
                </section>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <button className={styles.button} type="button" onClick={onPick} disabled={cube.state !== "free"}>
        {cube.state === "free" ? "Executar Pick" : "Objeto na garra"}
      </button>
    </aside>
  );
}
