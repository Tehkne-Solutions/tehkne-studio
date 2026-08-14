"use client";

import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useState } from "react";
import type { EngineeringEntity } from "../../../packages/engineering-core/src/index";
import type { TehkneStudioProject } from "../../../packages/project-format/src/index";
import {
  EngineeringSession,
  type CapabilityExecutionResult
} from "../../../packages/engineering-session/src/index";
import { createSpatialBinding, resolveSpatialSelection } from "../../../packages/spatial-runtime/src/index";
import desktopPreset from "../../../presets/desktop-pc/project.json";

interface DesktopAssemblyProps {
  readonly session: EngineeringSession;
  readonly selectedId: string | null;
  readonly onSelect: (entity: EngineeringEntity) => void;
}

function SelectionOutline({
  position,
  size
}: {
  readonly position: [number, number, number];
  readonly size: [number, number, number];
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshBasicMaterial color="#c3aa72" wireframe transparent opacity={0.92} />
    </mesh>
  );
}

function DesktopAssembly({ session, selectedId, onSelect }: DesktopAssemblyProps) {
  const root = session.getEntity("pc.root");
  const ram = session.getEntity("pc.ram.01");
  const opened = root.state === "open";
  const ramRemoved = ram.state === "removed";
  const ramPosition: [number, number, number] = ramRemoved ? [-2.15, 0.22, 1.05] : [-0.15, 0.75, 0.86];

  const select = (entity: EngineeringEntity, position: { x: number; y: number; z: number }) => {
    const binding = createSpatialBinding(entity, { position });
    onSelect(resolveSpatialSelection(entity, binding).entity);
  };

  const selectRoot = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    select(root, { x: 0, y: 0.55, z: 0 });
  };

  const selectRam = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    select(ram, { x: ramPosition[0], y: ramPosition[1], z: ramPosition[2] });
  };

  return (
    <group position={[0, -0.15, 0]}>
      <group onClick={selectRoot}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[2.7, 2.1, opened ? 1.25 : 1.6]} />
          <meshStandardMaterial color="#30322f" roughness={0.72} metalness={0.18} />
        </mesh>
        <mesh
          position={opened ? [-1.72, 0.62, 0.2] : [-1.37, 0.55, 0]}
          rotation={opened ? [0, 0.06, -0.08] : [0, 0, 0]}
        >
          <boxGeometry args={[0.08, 1.92, 1.48]} />
          <meshStandardMaterial color="#3a3c38" roughness={0.8} metalness={0.22} />
        </mesh>
      </group>

      <mesh position={ramPosition} onClick={selectRam} castShadow>
        <boxGeometry args={[1.22, 0.22, 0.08]} />
        <meshStandardMaterial color="#a58a58" roughness={0.58} metalness={0.28} />
      </mesh>

      {selectedId === root.id ? (
        <SelectionOutline position={[0, 0.55, 0]} size={[2.78, 2.18, opened ? 1.33 : 1.68]} />
      ) : null}
      {selectedId === ram.id ? (
        <SelectionOutline position={ramPosition} size={[1.3, 0.3, 0.16]} />
      ) : null}

      <mesh position={[0, -0.6, 0]} receiveShadow>
        <boxGeometry args={[6.4, 0.18, 4.2]} />
        <meshStandardMaterial color="#232521" roughness={0.92} />
      </mesh>
    </group>
  );
}

interface FeedbackState {
  readonly message: string;
  readonly result?: CapabilityExecutionResult;
  readonly error?: boolean;
}

export function SpatialWorkbench() {
  const session = useMemo(
    () => new EngineeringSession(desktopPreset as unknown as TehkneStudioProject),
    []
  );
  const [activeProduct, setActiveProduct] = useState<"desktop" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const selected = selectedId ? session.getEntity(selectedId) : null;
  const recentHistory = session.history().slice(-4).reverse();

  const selectEntity = (entity: EngineeringEntity) => {
    setSelectedId(entity.id);
    setFeedback(null);
  };

  const execute = async (capabilityId: string) => {
    if (!selected) return;
    const commandResult = await session.executeCapability(selected.id, capabilityId, "ui");
    if (!commandResult.ok || !commandResult.result) {
      setFeedback({ message: commandResult.error ?? "Falha ao executar capability.", error: true });
      return;
    }
    setFeedback({ message: commandResult.result.message, result: commandResult.result });
    setSelectedId(commandResult.result.entity.id);
    setRevision((current) => current + 1);
  };

  const resetWorkbench = () => {
    setActiveProduct(null);
    setSelectedId(null);
    setFeedback(null);
  };

  return (
    <section className="workbench" aria-label="Bancada espacial do Tehkné Studio" data-revision={revision}>
      <Canvas
        className="workbench-canvas"
        camera={{ position: [4.8, 3.25, 5.6], fov: 38 }}
        onPointerMissed={() => { setSelectedId(null); setFeedback(null); }}
        shadows
      >
        <color attach="background" args={["#171815"]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[5, 7, 4]} intensity={2.1} castShadow />
        <gridHelper args={[12, 24, "#45483f", "#272923"]} position={[0, -0.51, 0]} />
        {activeProduct === "desktop" ? (
          <DesktopAssembly session={session} selectedId={selectedId} onSelect={selectEntity} />
        ) : null}
      </Canvas>

      {!activeProduct ? (
        <div className="empty-state">
          <p>THE FIRST WORKBENCH</p>
          <strong>O que você quer construir ou compreender?</strong>
          <div className="actions">
            <button type="button" onClick={() => setActiveProduct("desktop")}>Chamar Desktop PC</button>
            <button type="button" disabled aria-disabled="true">ARM-01 · próxima etapa</button>
            <button type="button" disabled aria-disabled="true">Projeto vazio · em breve</button>
          </div>
        </div>
      ) : null}

      {activeProduct ? (
        <div className="workbench-toolbar" aria-label="Controles da bancada">
          <button type="button" onClick={resetWorkbench}>Guardar projeto</button>
          <span>DESKTOP-PC-001 · ENGINEERING SESSION</span>
        </div>
      ) : null}

      {activeProduct && recentHistory.length > 0 ? (
        <aside className="semantic-history" aria-label="Histórico semântico recente">
          <span>HISTORY · {session.history().length}</span>
          {recentHistory.map((entry) => (
            <div key={entry.id}>
              <strong>{entry.label}</strong>
              <small>{entry.beforeState} → {entry.afterState}</small>
            </div>
          ))}
        </aside>
      ) : null}

      {selected ? (
        <aside className="entity-card" aria-live="polite">
          <span className="entity-kind">{selected.type}</span>
          <strong>{selected.name}</strong>
          <small>{selected.id} · {selected.state}</small>

          <div className="entity-actions">
            {selected.capabilities.map((capability) => {
              const supported = session.canExecuteCapability(capability.id);
              return (
                <button
                  type="button"
                  key={capability.id}
                  onClick={() => void execute(capability.id)}
                  disabled={!supported}
                  title={supported ? capability.label : `${capability.label} entra em uma próxima etapa`}
                >
                  {capability.label}
                </button>
              );
            })}
          </div>

          {feedback ? (
            <section className={feedback.error ? "capability-result capability-error" : "capability-result"}>
              <span>{feedback.error ? "COMMAND ERROR" : "COMMAND RESULT"}</span>
              <p>{feedback.message}</p>
              {feedback.result?.inspection?.length ? (
                <dl className="property-list">
                  {feedback.result.inspection.map((property) => (
                    <div key={property.id}>
                      <dt>{property.id}</dt>
                      <dd>
                        {String(property.value)}{property.unit ? ` ${property.unit}` : ""}
                        <small>source · {property.source}</small>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </section>
          ) : null}
        </aside>
      ) : null}

      {activeProduct && !selected ? (
        <div className="selection-hint">Selecione uma peça. Ações agora executam contra a Engineering Entity real.</div>
      ) : null}
    </section>
  );
}
