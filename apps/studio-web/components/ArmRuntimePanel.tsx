"use client";

import type { Arm01Controller } from "../../../packages/studio-robotics/src/index";

interface ArmRuntimePanelProps {
  readonly controller: Arm01Controller;
  readonly revision: number;
  readonly onPick: () => void;
}

function angle(controller: Arm01Controller, entityId: string): string {
  const value = controller.session.getEntity(entityId).properties.angleDeg?.value;
  return typeof value === "number" ? `${value.toFixed(1)}°` : "—";
}

export function ArmRuntimePanel({ controller, revision, onPick }: ArmRuntimePanelProps) {
  const robot = controller.session.getEntity("arm.root");
  const gripper = controller.session.getEntity("arm.gripper");
  const cube = controller.session.getEntity("object.cube.red");
  const recent = controller.records().slice(-4);

  return (
    <aside className="arm-runtime-panel" aria-label="ARM-01 Robotics Runtime" data-revision={revision}>
      <div className="arm-runtime-heading">
        <span>ROBOTICS RUNTIME</span>
        <small>{String(robot.properties.taskState?.value ?? "idle").toUpperCase()}</small>
      </div>

      <div className="arm-joint-grid">
        <div><small>BASE</small><strong>{angle(controller, "arm.joint.base")}</strong></div>
        <div><small>SHOULDER</small><strong>{angle(controller, "arm.joint.shoulder")}</strong></div>
        <div><small>ELBOW</small><strong>{angle(controller, "arm.joint.elbow")}</strong></div>
        <div><small>GRIPPER</small><strong>{String(gripper.properties.openingMm?.value)} mm</strong></div>
      </div>

      <div className="arm-object-state">
        <span>WORKPIECE</span>
        <strong>{cube.name}</strong>
        <small>{cube.state} · {String(cube.properties.massKg?.value)} kg</small>
      </div>

      {recent.length > 0 ? (
        <div className="arm-motion-timeline" aria-label="Motion plan timeline">
          <span>MOTION PLAN</span>
          {recent.map((record) => (
            <div key={`${record.waypointId}-${record.occurredAt}`}>
              <small>{record.waypointId.toUpperCase()}</small>
              <strong>{record.label}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="arm-runtime-empty">Diga “Pegue o cubo vermelho” ou execute o benchmark abaixo.</p>
      )}

      <button type="button" onClick={onPick} disabled={cube.state !== "free"}>
        {cube.state === "free" ? "Executar Pick" : "Objeto na garra"}
      </button>
    </aside>
  );
}
