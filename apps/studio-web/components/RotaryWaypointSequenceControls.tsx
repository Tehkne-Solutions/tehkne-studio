"use client";

import { useState } from "react";
import { mechanicalRotaryNamedPositionsRuntimeFor } from "../../../packages/invention-mechanical-command-runtime/src/rotary-named-positions";
import {
  mechanicalRotaryWaypointSequenceRuntimeFor,
  type MechanicalRotaryWaypointSequenceAuthoringResult,
  type MechanicalRotaryWaypointSequencePlan,
  type MechanicalRotaryWaypointSequenceRunResult
} from "../../../packages/invention-mechanical-command-runtime/src/rotary-waypoint-sequence";
import type { InventionSpatialScene } from "../../../packages/invention-spatial-runtime/src/index";
import styles from "./Invention3DWorkbench.module.css";

interface DraftWaypoint {
  readonly positionKey: string;
  readonly positionName: string;
  readonly durationSeconds?: number;
}

function formatPlanRadians(value: number): string {
  return `${value.toFixed(3)} rad · ${(value * 180 / Math.PI).toFixed(1)}°`;
}

export function RotaryWaypointSequenceControls({
  relationshipId,
  spatial,
  ready,
  onChanged,
  onBlocked
}: {
  readonly relationshipId: string;
  readonly spatial: InventionSpatialScene;
  readonly ready: boolean;
  readonly onChanged: (radians: number) => void;
  readonly onBlocked: (cause: unknown) => void;
}) {
  const [sequenceName, setSequenceName] = useState("");
  const [selectedPositionKey, setSelectedPositionKey] = useState("");
  const [stepDurationSeconds, setStepDurationSeconds] = useState("");
  const [draft, setDraft] = useState<readonly DraftWaypoint[]>([]);
  const [selectedSequenceKey, setSelectedSequenceKey] = useState("");
  const [lastAuthoring, setLastAuthoring] = useState<MechanicalRotaryWaypointSequenceAuthoringResult | null>(null);
  const [lastRun, setLastRun] = useState<MechanicalRotaryWaypointSequenceRunResult | null>(null);
  const [lastPlan, setLastPlan] = useState<MechanicalRotaryWaypointSequencePlan | null>(null);

  const positionsRuntime = mechanicalRotaryNamedPositionsRuntimeFor(spatial);
  const sequenceRuntime = mechanicalRotaryWaypointSequenceRuntimeFor(spatial);
  const positions = ready ? positionsRuntime.positions(relationshipId) : [];
  const sequences = ready ? sequenceRuntime.sequences(relationshipId) : [];
  const selectedPosition = positions.find((entry) => entry.key === selectedPositionKey) ?? null;
  const selectedSequence = sequences.find((entry) => entry.key === selectedSequenceKey) ?? null;

  const parsedStepDuration = (): number | undefined => {
    if (stepDurationSeconds.trim() === "") return undefined;
    const duration = Number(stepDurationSeconds);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("Waypoint duration must be greater than zero seconds");
    return duration;
  };

  const addWaypoint = (): void => {
    try {
      if (!selectedPosition) throw new Error("Select a named position before adding a waypoint");
      if (draft.length >= 32) throw new Error("Rotary waypoint sequence supports at most 32 steps");
      const durationSeconds = parsedStepDuration();
      setDraft((current) => [...current, {
        positionKey: selectedPosition.key,
        positionName: selectedPosition.name,
        ...(durationSeconds === undefined ? {} : { durationSeconds })
      }]);
    } catch (cause) {
      onBlocked(cause);
    }
  };

  const removeLastWaypoint = (): void => {
    setDraft((current) => current.slice(0, -1));
  };

  const saveSequence = async (): Promise<void> => {
    try {
      if (!ready) throw new Error(`Rotary joint ${relationshipId} is not ready`);
      const outcome = await sequenceRuntime.saveSequence(
        relationshipId,
        sequenceName,
        draft.map((step) => ({ positionName: step.positionName, durationSeconds: step.durationSeconds })),
        "ui"
      );
      if (!outcome.ok || !outcome.result || !outcome.result.current) {
        throw new Error(outcome.error ?? "Mechanical rotary save waypoint sequence command failed");
      }
      setLastAuthoring(outcome.result);
      setSelectedSequenceKey(outcome.result.current.key);
      setSequenceName(outcome.result.current.name);
      setLastPlan(null);
    } catch (cause) {
      onBlocked(cause);
    }
  };

  const previewSequence = (): void => {
    try {
      if (!selectedSequence) throw new Error("Select an authored rotary waypoint sequence");
      setLastPlan(sequenceRuntime.planSequence(relationshipId, selectedSequence.name));
    } catch (cause) {
      onBlocked(cause);
    }
  };

  const runSequence = async (): Promise<void> => {
    try {
      if (!selectedSequence) throw new Error("Select an authored rotary waypoint sequence");
      const outcome = await sequenceRuntime.runSequence(relationshipId, selectedSequence.name, "ui");
      if (!outcome.ok || !outcome.result) throw new Error(outcome.error ?? "Mechanical rotary waypoint sequence failed");
      setLastRun(outcome.result);
      setLastPlan(null);
      onChanged(outcome.result.totalDeltaRadians);
    } catch (cause) {
      onBlocked(cause);
    }
  };

  const deleteSequence = async (): Promise<void> => {
    try {
      if (!selectedSequence) throw new Error("Select an authored rotary waypoint sequence");
      const outcome = await sequenceRuntime.deleteSequence(relationshipId, selectedSequence.name, "ui");
      if (!outcome.ok || !outcome.result) throw new Error(outcome.error ?? "Mechanical rotary delete waypoint sequence failed");
      setLastAuthoring(outcome.result);
      setSelectedSequenceKey("");
      setLastRun(null);
      setLastPlan(null);
    } catch (cause) {
      onBlocked(cause);
    }
  };

  const draftText = draft.length === 0
    ? "DRAFT VAZIO"
    : draft.map((step, index) => `${index + 1}. ${step.positionName}${step.durationSeconds === undefined ? " · RATE UNRESOLVED" : ` · ${step.durationSeconds.toFixed(3)} s`}`).join(" → ");
  const planText = lastPlan === null
    ? "PLAN NÃO GERADO"
    : `${lastPlan.admissible ? "PLAN OK" : "PLAN BLOCKED"} · ${lastPlan.segments.length} segmentos · Δ ${formatPlanRadians(lastPlan.totalDeltaRadians)} · percurso ${formatPlanRadians(lastPlan.cumulativeAbsoluteTravelRadians)} · ${lastPlan.durationMode === "complete-explicit" ? `duração total ${lastPlan.totalDurationSeconds!.toFixed(3)} s` : `${lastPlan.durationMode} · explícito ${lastPlan.explicitDurationSeconds.toFixed(3)} s`}`;
  const planSegmentsText = lastPlan === null
    ? ""
    : lastPlan.segments.map((segment) => `${segment.index + 1}. ${segment.positionName} · Δ ${formatPlanRadians(segment.deltaRadians)} · ${segment.rateMode === "segment-average" ? `${segment.durationSeconds!.toFixed(3)} s · ${segment.averageRpm!.toFixed(3)} RPM` : "RATE UNRESOLVED"} · ${segment.withinTravelLimits ? "LIMIT OK" : "LIMIT BLOCKED"}`).join(" → ");

  return <div
    className={styles.wireEvidence}
    aria-label={`Rotary waypoint sequence ${relationshipId}`}
    data-testid={`rotary-waypoint-sequence-${relationshipId}`}
    data-waypoint-sequence-count={String(sequences.length)}
    data-waypoint-draft-count={String(draft.length)}
    data-selected-sequence-key={selectedSequence?.key ?? ""}
    data-sequence-command-id={lastAuthoring?.commandId ?? lastRun?.commandId ?? ""}
    data-sequence-command-action={lastAuthoring?.action ?? (lastRun ? "run" : "")}
    data-sequence-run-steps={lastRun ? String(lastRun.stepsCompleted) : ""}
    data-sequence-final-movement-id={lastRun?.finalMovementCommandId ?? ""}
    data-sequence-final-rate-mode={lastRun?.finalRateMode ?? ""}
    data-sequence-plan-status={lastPlan === null ? "" : lastPlan.admissible ? "admissible" : "blocked"}
    data-sequence-plan-steps={lastPlan === null ? "" : String(lastPlan.segments.length)}
    data-sequence-plan-duration-mode={lastPlan?.durationMode ?? ""}
    data-sequence-plan-total-duration={lastPlan?.totalDurationSeconds === null || lastPlan === null ? "" : lastPlan.totalDurationSeconds.toFixed(3)}
    data-sequence-plan-explicit-duration={lastPlan === null ? "" : lastPlan.explicitDurationSeconds.toFixed(3)}
    data-sequence-plan-total-delta-rad={lastPlan === null ? "" : lastPlan.totalDeltaRadians.toFixed(3)}
    data-sequence-plan-absolute-travel-rad={lastPlan === null ? "" : lastPlan.cumulativeAbsoluteTravelRadians.toFixed(3)}
    data-sequence-plan-final-rad={lastPlan === null ? "" : lastPlan.afterContinuousRadians.toFixed(3)}
    data-sequence-plan-timed-steps={lastPlan === null ? "" : String(lastPlan.timedSteps)}
    data-sequence-plan-untimed-steps={lastPlan === null ? "" : String(lastPlan.untimedSteps)}
    data-command-bus="session"
    data-sequence-execution="canonical-continuous-targets"
    data-sequence-preflight="shared-read-only-plan"
    data-sequence-plan-mutation="none"
  >
    <strong>ROTARY WAYPOINT SEQUENCE</strong>
    <small>Named Positions autoradas · até 32 waypoints · duração explícita opcional por segmento · plan/preflight determinístico antes do primeiro movimento · sem relógio contínuo/dinâmica</small>
    <div className={styles.axisGrid}>
      <input aria-label="Rotary waypoint sequence name" type="text" maxLength={64} value={sequenceName} onChange={(event) => setSequenceName(event.target.value)} disabled={!ready} placeholder="Inspection Cycle…" />
      <select aria-label="Rotary waypoint position" value={selectedPositionKey} onChange={(event) => setSelectedPositionKey(event.target.value)} disabled={!ready || positions.length === 0}>
        <option value="">Select Named Position…</option>
        {positions.map((entry) => <option key={entry.key} value={entry.key}>{entry.name} · {(entry.continuousRadians * 180 / Math.PI).toFixed(1)}°</option>)}
      </select>
    </div>
    <div className={styles.axisGrid}>
      <input aria-label="Rotary waypoint duration seconds" type="number" min="0.001" step="0.1" value={stepDurationSeconds} onChange={(event) => setStepDurationSeconds(event.target.value)} disabled={!ready} placeholder="duração s (opcional)" />
      <button type="button" onClick={addWaypoint} disabled={!ready || !selectedPosition || draft.length >= 32}>ADD WAYPOINT</button>
    </div>
    <small aria-label="Rotary waypoint draft">{draftText}</small>
    <div className={styles.axisGrid}>
      <button type="button" onClick={removeLastWaypoint} disabled={!ready || draft.length === 0}>UNDO WAYPOINT</button>
      <button type="button" onClick={() => setDraft([])} disabled={!ready || draft.length === 0}>CLEAR DRAFT</button>
    </div>
    <div className={styles.axisGrid}>
      <button type="button" onClick={() => void saveSequence()} disabled={!ready || sequenceName.trim().length === 0 || draft.length === 0}>SAVE SEQUENCE</button>
      <select aria-label="Rotary waypoint sequence" value={selectedSequenceKey} onChange={(event) => { setSelectedSequenceKey(event.target.value); setLastPlan(null); }} disabled={!ready || sequences.length === 0}>
        <option value="">Select sequence…</option>
        {sequences.map((entry) => <option key={entry.key} value={entry.key}>{entry.name} · {entry.steps.length} steps</option>)}
      </select>
    </div>
    <div className={styles.axisGrid}>
      <button type="button" onClick={previewSequence} disabled={!ready || !selectedSequence}>PREVIEW SEQUENCE</button>
      <button type="button" onClick={() => void runSequence()} disabled={!ready || !selectedSequence}>RUN SEQUENCE</button>
    </div>
    <small aria-label="Rotary waypoint sequence plan summary">{planText}</small>
    <small aria-label="Rotary waypoint sequence plan segments">{planSegmentsText}</small>
    <div className={styles.axisGrid}>
      <button type="button" onClick={() => void deleteSequence()} disabled={!ready || !selectedSequence}>DELETE SEQUENCE</button>
    </div>
  </div>;
}
