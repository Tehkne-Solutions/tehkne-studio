"use client";

import { type ThreeEvent } from "@react-three/fiber";
import type { EngineeringEntity } from "../../../packages/engineering-core/src/index";
import type { EngineeringSession } from "../../../packages/engineering-session/src/index";
import { createSpatialBinding, resolveSpatialSelection } from "../../../packages/spatial-runtime/src/index";

type Vector3Tuple = [number, number, number];

interface SpatialMetadata {
  readonly position: Vector3Tuple;
  readonly exploded: Vector3Tuple;
  readonly size: Vector3Tuple;
}

interface TvAssemblyProps {
  readonly session: EngineeringSession;
  readonly selectedId: string | null;
  readonly onSelect: (entity: EngineeringEntity) => void;
}

const COMPONENT_COLORS: Readonly<Record<string, string>> = {
  AcDcPowerSupply: "#6f6654",
  PowerRegulator: "#9c895e",
  MediaSoC: "#b29a67",
  MemoryModule: "#84714e",
  StorageDevice: "#66706a",
  DisplayPanel: "#151b1d",
  WirelessModule: "#58645e",
  HdmiInput: "#898b84",
  AudioAmplifier: "#76684d",
  SpeakerSystem: "#383b37",
  InfraredReceiver: "#564f43",
  CoolingSystem: "#4f5652",
  StructuralFrame: "#343633"
};

function readSpatial(entity: EngineeringEntity): SpatialMetadata {
  const candidate = entity.metadata.spatial;
  if (!candidate || typeof candidate !== "object") throw new Error(`Missing spatial metadata for ${entity.id}`);
  const spatial = candidate as Partial<SpatialMetadata>;
  if (!Array.isArray(spatial.position) || !Array.isArray(spatial.exploded) || !Array.isArray(spatial.size)) {
    throw new Error(`Invalid spatial metadata for ${entity.id}`);
  }
  return spatial as SpatialMetadata;
}

function SelectionOutline({ position, size }: { readonly position: Vector3Tuple; readonly size: Vector3Tuple }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[size[0] + 0.1, size[1] + 0.1, size[2] + 0.1]} />
      <meshBasicMaterial color="#c3aa72" wireframe transparent opacity={0.95} />
    </mesh>
  );
}

function TvComponent({
  entity,
  position,
  size,
  selected,
  onSelect
}: {
  readonly entity: EngineeringEntity;
  readonly position: Vector3Tuple;
  readonly size: Vector3Tuple;
  readonly selected: boolean;
  readonly onSelect: (entity: EngineeringEntity, position: Vector3Tuple) => void;
}) {
  const click = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(entity, position);
  };
  const isSpeaker = entity.type === "SpeakerSystem";
  const isIr = entity.type === "InfraredReceiver";
  return (
    <group>
      <mesh position={position} onClick={click} castShadow>
        {isSpeaker
          ? <boxGeometry args={size} />
          : isIr
            ? <cylinderGeometry args={[Math.max(size[0] / 2, 0.06), Math.max(size[0] / 2, 0.06), Math.max(size[1], 0.06), 20]} />
            : <boxGeometry args={size} />}
        <meshStandardMaterial
          color={COMPONENT_COLORS[entity.type] ?? "#666860"}
          roughness={entity.type === "DisplayPanel" ? 0.2 : 0.62}
          metalness={entity.type === "HdmiInput" ? 0.68 : 0.24}
        />
      </mesh>
      {selected ? <SelectionOutline position={position} size={size} /> : null}
    </group>
  );
}

export function TvAssembly({ session, selectedId, onSelect }: TvAssemblyProps) {
  const root = session.getEntity("tv.root");
  const exploded = root.state === "exploded";
  const opened = root.state === "open" || exploded;
  const components = session.graph.getDependencies(root.id, "contains").filter((entity) => entity.type !== "BootProcess");

  const select = (entity: EngineeringEntity, position: Vector3Tuple) => {
    const binding = createSpatialBinding(entity, { position: { x: position[0], y: position[1], z: position[2] } });
    onSelect(resolveSpatialSelection(entity, binding).entity);
  };
  const selectRoot = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    select(root, [0, 0, 0]);
  };

  return (
    <group position={[0, 1.25, 0]}>
      <mesh position={[0, 0, -0.18]} onClick={selectRoot} castShadow receiveShadow>
        <boxGeometry args={[6.15, 3.6, 0.24]} />
        <meshStandardMaterial color="#30332f" roughness={0.66} metalness={0.32} />
      </mesh>

      {!opened ? (
        <>
          <mesh position={[0, 0, -0.01]} onClick={selectRoot} castShadow>
            <boxGeometry args={[5.72, 3.22, 0.055]} />
            <meshStandardMaterial color="#111718" roughness={0.16} metalness={0.08} />
          </mesh>
          <mesh position={[2.55, -1.54, 0.03]} onClick={selectRoot}>
            <boxGeometry args={[0.12, 0.05, 0.04]} />
            <meshStandardMaterial color="#6d6048" roughness={0.45} />
          </mesh>
        </>
      ) : null}

      {opened
        ? components.map((entity) => {
            const spatial = readSpatial(entity);
            const removed = entity.state === "removed";
            const position: Vector3Tuple = removed
              ? entity.id === "tv.psu"
                ? [-4.2, -1.0, 0.85]
                : entity.id === "tv.display"
                  ? [0, 0, 2.05]
                  : entity.id === "tv.hdmi"
                    ? [4.2, 0.2, 0.85]
                    : spatial.exploded
              : exploded
                ? spatial.exploded
                : spatial.position;
            return (
              <TvComponent
                key={entity.id}
                entity={entity}
                position={position}
                size={spatial.size}
                selected={selectedId === entity.id}
                onSelect={select}
              />
            );
          })
        : null}

      {selectedId === root.id ? <SelectionOutline position={[0, 0, -0.08]} size={[6.28, 3.73, 0.5]} /> : null}

      <mesh position={[0, -2.05, -0.6]} receiveShadow>
        <boxGeometry args={[9.2, 0.16, 5.8]} />
        <meshStandardMaterial color="#232521" roughness={0.94} />
      </mesh>
    </group>
  );
}
