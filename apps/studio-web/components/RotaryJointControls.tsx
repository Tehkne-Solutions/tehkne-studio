"use client";

import type { EngineeringEntity } from "../../../packages/engineering-core/src/index";
import {
  endpointsAreCoincident,
  mechanicalAxesAreAligned,
  mechanicalWorldAxis,
  planMechanicalRotaryJointStep,
  type MechanicalAxialConstraint
} from "../../../packages/invention-assembly-runtime/src/index";
import type { InventionSpatialScene } from "../../../packages/invention-spatial-runtime/src/index";
import type { SpatialEntityBinding } from "../../../packages/spatial-runtime/src/index";
import { useSpatialPortEndpoint } from "./InventionAssetVisual";
import styles from "./Invention3DWorkbench.module.css";

const JOINT_STEP_RAD = Math.PI / 12;

function formatAxis(value: { readonly x: number; readonly y: number; readonly z: number }): string {
  return `${value.x.toFixed(4)},${value.y.toFixed(4)},${value.z.toFixed(4)}`;
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

  const rotateJoint = (radians: number): void => {
    try {
      if (!physical) throw new Error(`Rotary joint ${constraint.relationshipId} requires physical endpoints`);
      const plan = planMechanicalRotaryJointStep(
        driverEndpoint.position,
        followerEndpoint.localPosition,
        constraint.driverAxisLocal,
        constraint.followerAxisLocal,
        driverBinding,
        followerBinding,
        radians
      );
      spatial.rotate(plan.entityId, plan.toRotation);
      spatial.move(plan.entityId, plan.toPosition);
      onChanged(radians);
    } catch (cause) {
      onBlocked(cause);
    }
  };

  return <div className={styles.wireEvidence} aria-label={`Rotary joint ${constraint.relationshipId}`} data-testid={`rotary-joint-${constraint.relationshipId}`} data-dof="rotary-follower" data-state={ready ? "ready" : "blocked"} data-driver-entity={constraint.driver.entityId} data-follower-entity={constraint.follower.entityId} data-axis={formatAxis(driverAxis)}>
    <strong>ROTARY JOINT DOF · {followerEntity.name}</strong>
    <small>{constraint.driver.portId} → {constraint.follower.portId} · follower-only · {ready ? "READY" : "BLOCKED"} · sem RPM/torque</small>
    <div className={styles.axisGrid}>
      <button type="button" onClick={() => rotateJoint(-JOINT_STEP_RAD)} disabled={!ready}>JOINT −</button>
      <button type="button" onClick={() => rotateJoint(JOINT_STEP_RAD)} disabled={!ready}>JOINT +</button>
    </div>
  </div>;
}
