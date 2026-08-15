"use client";

import { useEffect } from "react";
import {
  alignedFollowerRotation,
  mechanicalAxesAreAligned,
  mechanicalWorldAxis,
  type MechanicalOrientationConstraint
} from "../../../packages/invention-assembly-runtime/src/index";
import type { InventionSpatialScene } from "../../../packages/invention-spatial-runtime/src/index";
import type { SpatialEntityBinding } from "../../../packages/spatial-runtime/src/index";

function format(value: number): string {
  return value.toFixed(4);
}

export function MechanicalOrientationSynchronizer({
  constraint,
  driverBinding,
  followerBinding,
  spatial,
  onAligned,
  onBlocked
}: {
  readonly constraint: MechanicalOrientationConstraint;
  readonly driverBinding: SpatialEntityBinding;
  readonly followerBinding: SpatialEntityBinding;
  readonly spatial: InventionSpatialScene;
  readonly onAligned: (constraint: MechanicalOrientationConstraint) => void;
  readonly onBlocked: (constraint: MechanicalOrientationConstraint, cause: unknown) => void;
}) {
  const driverAxis = mechanicalWorldAxis(constraint.driverAxisLocal, driverBinding.rotation);
  const followerAxis = mechanicalWorldAxis(constraint.followerAxisLocal, followerBinding.rotation);
  const aligned = mechanicalAxesAreAligned(driverAxis, followerAxis);

  useEffect(() => {
    if (aligned) return;
    try {
      const nextRotation = alignedFollowerRotation(
        constraint.driverAxisLocal,
        constraint.followerAxisLocal,
        driverBinding.rotation,
        followerBinding.rotation
      );
      spatial.rotate(constraint.follower.entityId, nextRotation);
      onAligned(constraint);
    } catch (cause) {
      onBlocked(constraint, cause);
    }
  }, [
    aligned,
    constraint.driver.entityId,
    constraint.driver.portId,
    constraint.follower.entityId,
    constraint.follower.portId,
    constraint.relationshipId,
    driverBinding.rotation.x,
    driverBinding.rotation.y,
    driverBinding.rotation.z,
    followerBinding.rotation.x,
    followerBinding.rotation.y,
    followerBinding.rotation.z,
    spatial
  ]);

  return (
    <div
      data-testid={`mechanical-orientation-${constraint.relationshipId}`}
      data-state={aligned ? "aligned" : "aligning"}
      data-driver-entity={constraint.driver.entityId}
      data-driver-port={constraint.driver.portId}
      data-follower-entity={constraint.follower.entityId}
      data-follower-port={constraint.follower.portId}
      data-driver-axis={`${format(driverAxis.x)},${format(driverAxis.y)},${format(driverAxis.z)}`}
      data-follower-axis={`${format(followerAxis.x)},${format(followerAxis.y)},${format(followerAxis.z)}`}
      data-derived-from={constraint.derivedFrom}
    >
      <strong>ORIENTATION · {constraint.sharedInterfaces.join(" · ")}</strong>
      <small>{constraint.driver.portId} → {constraint.follower.portId} · {aligned ? "AXIS ALIGNED" : "ALIGNING AXIS"}</small>
    </div>
  );
}
