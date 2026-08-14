"use client";

import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";
import type { EngineeringEntity } from "../../../packages/engineering-core/src/index";
import { createEngineeringEntity } from "../../../packages/engineering-core/src/index";
import { createSpatialBinding, resolveSpatialSelection } from "../../../packages/spatial-runtime/src/index";

function DesktopAssembly({ onSelect }: { onSelect: (entity: EngineeringEntity) => void }) {
  const entities = useMemo(() => {
    const root = createEngineeringEntity({
      id: "pc.root",
      type: "Computer",
      name: "Desktop PC",
      state: "ready",
      capabilities: [
        { id: "inspect", label: "Inspecionar" },
        { id: "open", label: "Abrir" },
        { id: "explode", label: "Explodir" }
      ]
    });
    const ram = createEngineeringEntity({
      id: "pc.ram.01",
      type: "MemoryModule",
      name: "RAM Module",
      parentId: root.id,
      state: "connected",
      properties: {
        capacity: { id: "capacity", value: 16, unit: "GB", source: "studio", confidence: 1 }
      },
      capabilities: [
        { id: "inspect", label: "Inspecionar" },
        { id: "explain", label: "Explicar" },
        { id: "remove", label: "Remover" }
      ]
    });
    return { root, ram };
  }, []);

  const select = (entity: EngineeringEntity, position: { x: number; y: number; z: number }) => {
    const binding = createSpatialBinding(entity, { position });
    onSelect(resolveSpatialSelection(entity, binding).entity);
  };

  return (
    <group position={[0, -0.15, 0]}>
      <mesh position={[0, 0.55, 0]} onClick={(event) => { event.stopPropagation(); select(entities.root, { x: 0, y: 0.55, z: 0 }); }}>
        <boxGeometry args={[2.8, 2.2, 1.65]} />
        <meshStandardMaterial color="#30322f" roughness={0.72} metalness={0.18} />
      </mesh>

      <mesh position={[-0.15, 0.75, 0.86]} onClick={(event) => { event.stopPropagation(); select(entities.ram, { x: -0.15, y: 0.75, z: 0.86 }); }}>
        <boxGeometry args={[1.22, 0.22, 0.08]} />
        <meshStandardMaterial color="#a58a58" roughness={0.58} metalness={0.28} />
      </mesh>

      <mesh position={[0, -0.6, 0]} receiveShadow>
        <boxGeometry args={[6.4, 0.18, 4.2]} />
        <meshStandardMaterial color="#232521" roughness={0.92} />
      </mesh>
    </group>
  );
}

export function SpatialWorkbench() {
  const [activeProduct, setActiveProduct] = useState<"desktop" | null>(null);
  const [selected, setSelected] = useState<EngineeringEntity | null>(null);

  return (
    <section className="workbench" aria-label="Bancada espacial do Tehkné Studio">
      <Canvas
        className="workbench-canvas"
        camera={{ position: [4.8, 3.25, 5.6], fov: 38 }}
        onPointerMissed={() => setSelected(null)}
        shadows
      >
        <color attach="background" args={["#171815"]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[5, 7, 4]} intensity={2.1} castShadow />
        <gridHelper args={[12, 24, "#45483f", "#272923"]} position={[0, -0.51, 0]} />
        {activeProduct === "desktop" ? <DesktopAssembly onSelect={setSelected} /> : null}
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
          <button type="button" onClick={() => { setActiveProduct(null); setSelected(null); }}>Guardar projeto</button>
          <span>DESKTOP-PC-001 · VIRTUAL</span>
        </div>
      ) : null}

      {selected ? (
        <aside className="entity-card" aria-live="polite">
          <span className="entity-kind">{selected.type}</span>
          <strong>{selected.name}</strong>
          <small>{selected.id} · {selected.state}</small>
          <div className="entity-actions">
            {selected.capabilities.map((capability) => (
              <button type="button" key={capability.id}>{capability.label}</button>
            ))}
          </div>
        </aside>
      ) : null}

      {activeProduct && !selected ? (
        <div className="selection-hint">Selecione uma peça da máquina para inspecionar sua Engineering Entity.</div>
      ) : null}
    </section>
  );
}
