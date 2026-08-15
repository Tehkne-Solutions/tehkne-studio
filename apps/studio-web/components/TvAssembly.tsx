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
  ExternalPowerInterface: "#787972",
  PowerSupply: "#9a865c",
  MediaSystemOnChip: "#aa925d",
  StorageDevice: "#68716b",
  DisplayModule: "#182021",
  WirelessModule: "#58645e",
  Microcontroller: "#69715c",
  ExternalInterface: "#858982",
  SpeakerAssembly: "#454943",
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
  return (
    <group>
      <mesh position={position} onClick={click} castShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={COMPONENT_COLORS[entity.type] ?? "#666860"}
          roughness={entity.type === "DisplayModule" ? 0.22 : 0.62}
          metalness={entity.type === "ExternalInterface" || entity.type === "ExternalPowerInterface" ? 0.64 : 0.2}
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
    <group position={[0, 0.75, 0]} rotation={[0, 0, -0.01]}>
      <mesh position={[0, 0, -0.18]} onClick={selectRoot} castShadow receiveShadow>
        <boxGeometry args={[5.08, 3.02, 0.22]} />
        <meshStandardMaterial color="#30322f" roughness={0.67} metalness={0.32} />
      </mesh>

      <mesh
        position={opened ? [-3.25, 0.1, -0.28] : [0, 0, -0.02]}
        rotation={opened ? [0, 0.08, -0.025] : [0, 0, 0]}
        onClick={selectRoot}
        castShadow
      >
        <boxGeometry args={[5.0, 2.94, 0.12]} />
        <meshStandardMaterial color="#3a3d39" roughness={0.66} metalness={0.28} />
      </mesh>

      {!opened ? (
        <>
          <mesh position={[0, 0, 0.05]} onClick={selectRoot} castShadow>
            <boxGeometry args={[4.8, 2.72, 0.05]} />
            <meshStandardMaterial color="#141b1d" roughness={0.16} metalness={0.08} />
          </mesh>
          <mesh position={[0, -1.58, -0.24]} castShadow>
            <boxGeometry args={[1.15, 0.12, 0.48]} />
            <meshStandardMaterial color="#3d403b" roughness={0.72} metalness={0.28} />
          </mesh>
          <mesh position={[0, -1.8, -0.28]} castShadow>
            <boxGeometry args={[2.05, 0.1, 0.72]} />
            <meshStandardMaterial color="#30332f" roughness={0.78} metalness={0.24} />
          </mesh>
        </>
      ) : null}

      {opened
        ? components.map((entity) => {
            const spatial = readSpatial(entity);
            const removed = entity.state === "removed";
            const position: Vector3Tuple = removed
              ? entity.id === "tv.psu"
                ? [-3.45, -1.35, 1.0]
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

      {selectedId === root.id ? <SelectionOutline position={[0, 0, -0.08]} size={[5.18, 3.12, 0.48]} /> : null}

      <mesh position={[0, -1.98, -0.72]} receiveShadow>
        <boxGeometry args={[9.2, 0.16, 6.0]} />
        <meshStandardMaterial color="#232521" roughness={0.94} />
      </mesh>
    </group>
  );
}
