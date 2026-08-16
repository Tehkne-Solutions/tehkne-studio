"use client";

import type { EngineeringEntity } from "../../../packages/engineering-core/src/index";
import {
  endpointsAreCoincident,
  mechanicalAxesAreAligned,
  mechanicalWorldAxis,
  planMechanicalRotaryJointStep,
  type MechanicalAxialConstraint
} from "../../../packages/invention-assembly-runtime/src/index";
import { rotaryJointRelativeAngle } from "../../../packages/invention-assembly-runtime/src/rotary-relative-angle";
import {
  advanceRotaryRevolutionCount,
  rotaryJointUnwrappedAngle,
  rotaryKinematicsStateForSession
} from "../../../packages/invention-assembly-runtime/src/rotary-multiturn";
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

function formatRevolutions(revolutions: number): string {
  return `${revolutions >= 0 ? "+" : "−"}${Math.abs(revolutions)} REV`;
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
  const driverEndpoint = useSpatialPortEndpoint(driverEntity, driverBinding, constraint.driver.portId);
  const followerEndpoint = useSpatialPortEndpoint(followerEntity, followerBinding, constraint.follower.portId);
  const driverAxis = mechanicalWorldAxis(constraint.driverAxisLocal, driverBinding.rotation);
  const followerAxis = mechanicalWorldAxis(constraint.followerAxisLocal, followerBinding.rotation);
  const physical = driverEndpoint.source !== "center-fallback" && followerEndpoint.source !== "center-fallback";
  const ready = physical && endpointsAreCoincident(driverEndpoint.position, followerEndpoint.position) && mechanicalAxesAreAligned(driverAxis, followerAxis);
  const relativeAngle = ready ? rotaryJointRelativeAngle(constraint.driverAxisLocal, constraint.followerAxisLocal, driverBinding.rotation, followerBinding.rotation) : null;
  const kinematics = rotaryKinematicsStateForSession(spatial.session);
  const revolutions = kinematics.revolutions(constraint.relationshipId);
  const unwrappedAngle = relativeAngle === null ? null : rotaryJointUnwrappedAngle(relativeAngle, revolutions);

  const rotateJoint = (radians: number): void => {
    try {
      if (!physical || relativeAngle === null) throw new Error(`Rotary joint ${constraint.relationshipId} requires physical aligned endpoints`);
      const plan = planMechanicalRotaryJointStep(
        driverEndpoint.position,
        followerEndpoint.localPosition,
        constraint.driverAxisLocal,
        constraint.followerAxisLocal,
        driverBinding,
        followerBinding,
        radians
      );
      const nextPrincipal = rotaryJointRelativeAngle(
        constraint.driverAxisLocal,
        constraint.followerAxisLocal,
        driverBinding.rotation,
        plan.toRotation
      );
      const nextRevolutions = advanceRotaryRevolutionCount(revolutions, relativeAngle, nextPrincipal, radians);
      spatial.rotate(plan.entityId, plan.toRotation);
      spatial.move(plan.entityId, plan.toPosition);
      kinematics.setRevolutions(constraint.relationshipId, nextRevolutions);
      onChanged(radians);
    } catch (cause) {
      onBlocked(cause);
    }
  };

  return <div className={styles.wireEvidence} aria-label={`Rotary joint ${constraint.relationshipId}`} data-testid={`rotary-joint-${constraint.relationshipId}`} data-dof="rotary-follower" data-state={ready ? "ready" : "blocked"} data-driver-entity={constraint.driver.entityId} data-follower-entity={constraint.follower.entityId} data-axis={formatAxis(driverAxis)} data-angle-rad={relativeAngle === null ? "" : relativeAngle.toFixed(3)} data-angle-mode="principal-derived" data-revolutions={revolutions} data-angle-unwrapped-rad={unwrappedAngle === null ? "" : unwrappedAngle.toFixed(3)} data-multiturn-mode="explicit-revolution-count">
    <strong>ROTARY JOINT DOF · MULTI-TURN · {followerEntity.name}</strong>
    <small>{constraint.driver.portId} → {constraint.follower.portId} · follower-only · {ready ? "READY" : "BLOCKED"} · {relativeAngle === null ? "ANGLE UNRESOLVED" : `ANGLE ${formatAngle(relativeAngle)}`} · {formatRevolutions(revolutions)} · {unwrappedAngle === null ? "ABS UNRESOLVED" : `ABS ${formatAngle(unwrappedAngle)}`} · sem RPM/torque</small>
    <div className={styles.axisGrid}>
      <button type="button" onClick={() => rotateJoint(-JOINT_STEP_RAD)} disabled={!ready}>JOINT −</button>
      <button type="button" onClick={() => rotateJoint(JOINT_STEP_RAD)} disabled={!ready}>JOINT +</button>
    </div>
  </div>;
}
