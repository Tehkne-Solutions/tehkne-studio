"use client";

import { useState } from "react";
import type { EngineeringEntity } from "../../../packages/engineering-core/src/index";
import {
  endpointsAreCoincident,
  mechanicalAxesAreAligned,
  mechanicalWorldAxis,
  type MechanicalAxialConstraint
} from "../../../packages/invention-assembly-runtime/src/index";
import {
  mechanicalCommandRuntimeFor,
  type MechanicalRotaryCommandResult
} from "../../../packages/invention-mechanical-command-runtime/src/index";
import type { InventionSpatialScene } from "../../../packages/invention-spatial-runtime/src/index";
import type { SpatialEntityBinding } from "../../../packages/spatial-runtime/src/index";
import { useSpatialPortEndpoint } from "./InventionAssetVisual";
import styles from "./Invention3DWorkbench.module.css";

const JOINT_STEP_RAD = Math.PI / 12;

function formatAxis(value: { readonly x: number; readonly y: number; readonly z: number }): string {
  return `${value.x.toFixed(4)},${value.y.toFixed(4)},${value.z.toFixed(4)}`;
}

function formatAngle(radians: number): string {
  return `${radians >= 0 ? "+" : "−"}${Math.abs(radians).toFixed(3)} rad · ${(radians * 180 / Math.PI).toFixed(1)}°`;
}

export function RotaryJointControls({
  constraint,
  driverEntity,
  followerEntity,
  driverBinding,
  followerBinding,
  spatial,
  onChanged,
  onBlocked
}: {
  readonly constraint: MechanicalAxialConstraint;
  readonly driverEntity: EngineeringEntity;
  readonly followerEntity: EngineeringEntity;
  readonly driverBinding: SpatialEntityBinding;
  readonly followerBinding: SpatialEntityBinding;
  readonly spatial: InventionSpatialScene;
  readonly onChanged: (radians: number) => void;
  readonly onBlocked: (cause: unknown) => void;
}) {
  const [targetDegrees, setTargetDegrees] = useState("0");
  const [durationSecondsInput, setDurationSecondsInput] = useState("");
  const [lastCommand, setLastCommand] = useState<MechanicalRotaryCommandResult | null>(null);
  const commands = mechanicalCommandRuntimeFor(spatial);
  const driverEndpoint = useSpatialPortEndpoint(driverEntity, driverBinding, constraint.driver.portId);
  const followerEndpoint = useSpatialPortEndpoint(followerEntity, followerBinding, constraint.follower.portId);
  const driverAxis = mechanicalWorldAxis(constraint.driverAxisLocal, driverBinding.rotation);
  const followerAxis = mechanicalWorldAxis(constraint.followerAxisLocal, followerBinding.rotation);
  const physical = driverEndpoint.source !== "center-fallback" && followerEndpoint.source !== "center-fallback";
  const ready = physical && endpointsAreCoincident(driverEndpoint.position, followerEndpoint.position) && mechanicalAxesAreAligned(driverAxis, followerAxis);
  const kinematics = ready ? commands.kinematics(constraint.relationshipId) : null;
  const rate = ready ? commands.rate(constraint.relationshipId) : null;

  const commandDurationSeconds = (): number | undefined => {
    if (durationSecondsInput.trim() === "") return undefined;
    const duration = Number(durationSecondsInput);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("Rotary command duration must be greater than zero seconds");
    return duration;
  };

  const acceptCommand = (result: MechanicalRotaryCommandResult): void => {
    setLastCommand(result);
    onChanged(result.deltaRadians);
  };

  const rotateJoint = async (radians: number): Promise<void> => {
    try {
      if (!physical) throw new Error(`Rotary joint ${constraint.relationshipId} requires physical endpoints`);
      const outcome = await commands.step(constraint.relationshipId, radians, "ui", commandDurationSeconds());
      if (!outcome.ok || !outcome.result) throw new Error(outcome.error ?? "Mechanical rotary step command failed");
      acceptCommand(outcome.result);
    } catch (cause) {
      onBlocked(cause);
    }
  };

  const applyTargetAngle = async (): Promise<void> => {
    try {
      if (!physical) throw new Error(`Rotary joint ${constraint.relationshipId} requires physical endpoints`);
      const degrees = Number(targetDegrees);
      if (!Number.isFinite(degrees) || degrees < -180 || degrees > 180) throw new Error("Rotary target angle must be between -180 and 180 degrees");
      const outcome = await commands.setTarget(constraint.relationshipId, degrees * Math.PI / 180, "ui", commandDurationSeconds());
      if (!outcome.ok || !outcome.result) throw new Error(outcome.error ?? "Mechanical rotary target command failed");
      acceptCommand(outcome.result);
    } catch (cause) {
      onBlocked(cause);
    }
  };

  const rateText = rate?.mode === "segment-average" && rate.durationSeconds !== null && rate.averageAngularVelocityRadPerSec !== null && rate.averageRpm !== null
    ? `TAXA MÉDIA ${rate.averageAngularVelocityRadPerSec.toFixed(3)} rad/s · ${rate.averageRpm.toFixed(2)} RPM · Δt ${rate.durationSeconds.toFixed(3)} s`
    : "RATE UNRESOLVED · informe duração explícita";

  return <div className={styles.wireEvidence} aria-label={`Rotary joint ${constraint.relationshipId}`} data-testid={`rotary-joint-${constraint.relationshipId}`} data-dof="rotary-follower" data-state={ready ? "ready" : "blocked"} data-driver-entity={constraint.driver.entityId} data-follower-entity={constraint.follower.entityId} data-axis={formatAxis(driverAxis)} data-angle-rad={kinematics === null ? "" : kinematics.principalRadians.toFixed(3)} data-angle-mode="principal-derived" data-continuous-angle-rad={kinematics === null ? "" : kinematics.continuousRadians.toFixed(3)} data-revolutions={kinematics === null ? "" : String(kinematics.revolutions)} data-kinematics-source={kinematics?.derivedFrom ?? ""} data-kinematics-evidence={kinematics === null ? "" : String(kinematics.evidenceCommands)} data-target-mode="principal-shortest" data-transform-mode="atomic-batch" data-command-bus="session" data-command-source={lastCommand?.source ?? ""} data-command-id={lastCommand?.commandId ?? ""} data-command-mode={lastCommand?.mode ?? ""} data-rate-mode={rate?.mode ?? ""} data-rate-source={rate?.derivedFrom ?? ""} data-rate-command-id={rate?.commandId ?? ""} data-duration-seconds={rate?.durationSeconds === null || rate?.durationSeconds === undefined ? "" : rate.durationSeconds.toFixed(3)} data-angular-velocity-rad-s={rate?.averageAngularVelocityRadPerSec === null || rate?.averageAngularVelocityRadPerSec === undefined ? "" : rate.averageAngularVelocityRadPerSec.toFixed(3)} data-rpm={rate?.averageRpm === null || rate?.averageRpm === undefined ? "" : rate.averageRpm.toFixed(3)}>
    <strong>ROTARY JOINT DOF · {followerEntity.name}</strong>
    <small>{constraint.driver.portId} → {constraint.follower.portId} · follower-only · {ready ? "READY" : "BLOCKED"} · {kinematics === null ? "ANGLE UNRESOLVED" : `PRINCIPAL ${formatAngle(kinematics.principalRadians)} · CONTÍNUO ${formatAngle(kinematics.continuousRadians)} · VOLTAS ${kinematics.revolutions}`} · {rateText} · CommandBus + atomic transform · sem torque/aceleração · sem inferência por wall-clock</small>
    <div className={styles.axisGrid}>
      <button type="button" onClick={() => void rotateJoint(-JOINT_STEP_RAD)} disabled={!ready}>JOINT −</button>
      <button type="button" onClick={() => void rotateJoint(JOINT_STEP_RAD)} disabled={!ready}>JOINT +</button>
    </div>
    <div className={styles.axisGrid}>
      <input aria-label="Rotary joint target angle degrees" type="number" min="-180" max="180" step="15" value={targetDegrees} onChange={(event) => setTargetDegrees(event.target.value)} disabled={!ready} />
      <button type="button" onClick={() => void applyTargetAngle()} disabled={!ready}>SET ANGLE</button>
    </div>
    <div className={styles.axisGrid}>
      <input aria-label="Rotary command duration seconds" type="number" min="0.001" step="0.1" placeholder="duração (s)" value={durationSecondsInput} onChange={(event) => setDurationSecondsInput(event.target.value)} disabled={!ready} />
      <span aria-label="Rotary segment rate evidence">{rateText}</span>
    </div>
  </div>;
}