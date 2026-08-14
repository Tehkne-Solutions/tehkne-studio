"use client";

import type { StudioBehaviorController } from "../../../packages/studio-behavior/src/index";
import styles from "./BehaviorPanel.module.css";

interface BehaviorPanelProps {
  readonly controller: StudioBehaviorController;
  readonly revision: number;
  readonly onThermalSpike: () => void;
  readonly onThermalStep: () => void;
}

function operatorLabel(operator: string): string {
  if (operator === "gt") return ">";
  if (operator === "gte") return "≥";
  if (operator === "lt") return "<";
  if (operator === "lte") return "≤";
  return "=";
}

export function BehaviorPanel({ controller, revision, onThermalSpike, onThermalStep }: BehaviorPanelProps) {
  const behaviors = controller.behaviors();
  const latestExecution = controller.executions().at(-1) ?? null;
  const cpu = controller.session.getEntity("pc.cpu");
  const cooling = controller.session.getEntity("pc.cooling");
  const temperature = cpu.properties.temperatureC?.value;
  const fan = cooling.properties.fanPercent?.value;

  return (
    <aside className={styles.panel} aria-label="Behavior Runtime" data-revision={revision}>
      <div className={styles.heading}>
        <span>BEHAVIOR RUNTIME</span>
        <small>{behaviors.length} regra(s)</small>
      </div>

      <div className={styles.telemetry}>
        <div><small>CPU TEMP</small><strong>{String(temperature)} °C</strong></div>
        <div><small>FAN</small><strong>{String(fan)}%</strong></div>
      </div>

      {behaviors.length === 0 ? (
        <p className={styles.empty}>
          Crie uma regra pela Studio Intelligence. Ex.: “Quando a CPU passar de 70 graus, coloque a ventoinha no máximo”.
        </p>
      ) : (
        <div className={styles.list}>
          {behaviors.map((behavior) => (
            <article key={behavior.id}>
              <strong>{behavior.name}</strong>
              <small>
                WHEN {behavior.condition.signal.entityId}.{behavior.condition.signal.propertyId} {operatorLabel(behavior.condition.operator)} {behavior.condition.threshold}
              </small>
              <small>
                THEN {behavior.action.targetEntityId}.{behavior.action.capabilityId}({String(behavior.action.args?.percent ?? "")})
              </small>
            </article>
          ))}
        </div>
      )}

      {latestExecution ? (
        <div className={styles.lastExecution}>
          <span>LAST TRIGGER</span>
          <p>{latestExecution.message}</p>
        </div>
      ) : null}

      <div className={styles.actions}>
        <button type="button" onClick={onThermalSpike}>Injetar 76 °C</button>
        <button type="button" onClick={onThermalStep}>Avançar térmica</button>
      </div>
    </aside>
  );
}
