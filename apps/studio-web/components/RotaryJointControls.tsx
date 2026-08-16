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
  type MechanicalRotaryCommandResult,
  type MechanicalRotaryTravelLimitsResult
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
  const [continuousTargetDegrees, setContinuousTargetDegrees] = useState("0");
  const [minTravelDegrees, setMinTravelDegrees] = useState("-180");
  const [maxTravelDegrees, setMaxTravelDegrees] = useState("540");
  const [lastCommand, setLastCommand] = useState<MechanicalRotaryCommandResult | null>(null);
  const [lastLimitCommand, setLastLimitCommand] = useState<MechanicalRotaryTravelLimitsResult | null>(null);
  const commands = mechanicalCommandRuntimeFor(spatial);
  const driverEndpoint = useSpatialPortEndpoint(driverEntity, driverBinding, constraint.driver.portId);
  const followerEndpoint = useSpatialPortEndpoint(followerEntity, followerBinding, constraint.follower.portId);
  const driverAxis = mechanicalWorldAxis(constraint.driverAxisLocal, driverBinding.rotation);
  const followerAxis = mechanicalWorldAxis(constraint.followerAxisLocal, followerBinding.rotation);
  const physical = driverEndpoint.source !== "center-fallback" && followerEndpoint.source !== "center-fallback";
  const ready = physical && endpointsAreCoincident(driverEndpoint.position, followerEndpoint.position) && mechanicalAxesAreAligned(driverAxis, followerAxis);
  const kinematics = ready ? commands.kinematics(constraint.relationshipId) : null;
  const limits = ready ? commands.travelLimits(constraint.relationshipId) : null;

  const acceptCommand = (result: MechanicalRotaryCommandResult): void => {
    setLastCommand(result);
    onChanged(result.deltaRadians);
  };

  const rotateJoint = async (radians: number): Promise<void> => {
    try {
      if (!physical) throw new Error(`Rotary joint ${constraint.relationshipId} requires physical endpoints`);
      const outcome = await commands.step(constraint.relationshipId, radians, "ui");
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
      const outcome = await commands.setTarget(constraint.relationshipId, degrees * Math.PI / 180, "ui");
      if (!outcome.ok || !outcome.result) throw new Error(outcome.error ?? "Mechanical rotary target command failed");
      acceptCommand(outcome.result);
    } catch (cause) {
      onBlocked(cause);
    }
  };

  const applyContinuousTarget = async (): Promise<void> => {
    try {
      if (!physical) throw new Error(`Rotary joint ${constraint.relationshipId} requires physical endpoints`);
      const degrees = Number(continuousTargetDegrees);
      if (!Number.isFinite(degrees)) throw new Error("Rotary continuous target angle must be finite degrees");
      const outcome = await commands.setContinuousTarget(constraint.relationshipId, degrees * Math.PI / 180, "ui");
      if (!outcome.ok || !outcome.result) throw new Error(outcome.error ?? "Mechanical rotary continuous target command failed");
      acceptCommand(outcome.result);
    } catch (cause) {
      onBlocked(cause);
    }
  };

  const applyTravelLimits = async (): Promise<void> => {
    try {
      if (!physical) throw new Error(`Rotary joint ${constraint.relationshipId} requires physical endpoints`);
      const minimumDegrees = Number(minTravelDegrees);
      const maximumDegrees = Number(maxTravelDegrees);
      if (!Number.isFinite(minimumDegrees) || !Number.isFinite(maximumDegrees)) throw new Error("Rotary travel limits must be finite degrees");
      const outcome = await commands.setTravelLimits(
        constraint.relationshipId,
        minimumDegrees * Math.PI / 180,
        maximumDegrees * Math.PI / 180,
        "ui"
      );
      if (!outcome.ok || !outcome.result) throw new Error(outcome.error ?? "Mechanical rotary travel limits command failed");
      setLastLimitCommand(outcome.result);
    } catch (cause) {
      onBlocked(cause);
    }
  };

  const clearTravelLimits = async (): Promise<void> => {
    try {
      if (!physical) throw new Error(`Rotary joint ${constraint.relationshipId} requires physical endpoints`);
      const outcome = await commands.clearTravelLimits(constraint.relationshipId, "ui");
      if (!outcome.ok || !outcome.result) throw new Error(outcome.error ?? "Mechanical rotary clear travel limits command failed");
      setLastLimitCommand(outcome.result);
    } catch (cause) {
      onBlocked(cause);
    }
  };

  return <div className={styles.wireEvidence} aria-label={`Rotary joint ${constraint.relationshipId}`} data-testid={`rotary-joint-${constraint.relationshipId}`} data-dof="rotary-follower" data-state={ready ? "ready" : "blocked"} data-driver-entity={constraint.driver.entityId} data-follower-entity={constraint.follower.entityId} data-axis={formatAxis(driverAxis)} data-angle-rad={kinematics === null ? "" : kinematics.principalRadians.toFixed(3)} data-angle-mode="principal-derived" data-continuous-angle-rad={kinematics === null ? "" : kinematics.continuousRadians.toFixed(3)} data-revolutions={kinematics === null ? "" : String(kinematics.revolutions)} data-kinematics-source={kinematics?.derivedFrom ?? ""} data-kinematics-evidence={kinematics === null ? "" : String(kinematics.evidenceCommands)} data-target-mode="principal-shortest" data-continuous-target-mode="continuous-absolute" data-travel-limited={limits ? "true" : "false"} data-travel-limit-mode={limits?.mode ?? ""} data-travel-min-rad={limits ? limits.minContinuousRadians.toFixed(3) : ""} data-travel-max-rad={limits ? limits.maxContinuousRadians.toFixed(3) : ""} data-limit-command-id={lastLimitCommand?.commandId ?? ""} data-limit-command-source={lastLimitCommand?.source ?? ""} data-limit-command-action={lastLimitCommand?.action ?? ""} data-transform-mode="atomic-batch" data-command-bus="session" data-command-source={lastCommand?.source ?? ""} data-command-id={lastCommand?.commandId ?? ""} data-command-mode={lastCommand?.mode ?? ""}>
    <strong>ROTARY JOINT DOF · {followerEntity.name}</strong>
    <small>{constraint.driver.portId} → {constraint.follower.portId} · follower-only · {ready ? "READY" : "BLOCKED"} · {kinematics === null ? "ANGLE UNRESOLVED" : `PRINCIPAL ${formatAngle(kinematics.principalRadians)} · CONTÍNUO ${formatAngle(kinematics.continuousRadians)} · VOLTAS ${kinematics.revolutions}`} · {limits ? `CURSO ${formatAngle(limits.minContinuousRadians)} → ${formatAngle(limits.maxContinuousRadians)}` : "CURSO ILIMITADO"} · CommandBus + atomic transform · sem RPM/torque</small>
    <div className={styles.axisGrid}>
      <button type="button" onClick={() => void rotateJoint(-JOINT_STEP_RAD)} disabled={!ready}>JOINT −</button>
      <button type="button" onClick={() => void rotateJoint(JOINT_STEP_RAD)} disabled={!ready}>JOINT +</button>
    </div>
    <div className={styles.axisGrid}>
      <input aria-label="Rotary joint target angle degrees" type="number" min="-180" max="180" step="15" value={targetDegrees} onChange={(event) => setTargetDegrees(event.target.value)} disabled={!ready} />
      <button type="button" onClick={() => void applyTargetAngle()} disabled={!ready}>SET ANGLE</button>
    </div>
    <div className={styles.axisGrid}>
      <input aria-label="Rotary joint continuous target degrees" type="number" step="15" value={continuousTargetDegrees} onChange={(event) => setContinuousTargetDegrees(event.target.value)} disabled={!ready} />
      <button type="button" onClick={() => void applyContinuousTarget()} disabled={!ready}>SET CONTINUOUS</button>
    </div>
    <div className={styles.axisGrid}>
      <input aria-label="Rotary joint minimum travel degrees" type="number" step="15" value={minTravelDegrees} onChange={(event) => setMinTravelDegrees(event.target.value)} disabled={!ready} />
      <input aria-label="Rotary joint maximum travel degrees" type="number" step="15" value={maxTravelDegrees} onChange={(event) => setMaxTravelDegrees(event.target.value)} disabled={!ready} />
    </div>
    <div className={styles.axisGrid}>
      <button type="button" onClick={() => void applyTravelLimits()} disabled={!ready}>SET LIMITS</button>
      <button type="button" onClick={() => void clearTravelLimits()} disabled={!ready || !limits}>CLEAR LIMITS</button>
    </div>
  </div>;
}
