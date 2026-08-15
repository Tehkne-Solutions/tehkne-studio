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

interface NotebookAssemblyProps {
  readonly session: EngineeringSession;
  readonly selectedId: string | null;
  readonly onSelect: (entity: EngineeringEntity) => void;
}

const COMPONENT_COLORS: Readonly<Record<string, string>> = {
  BatteryPack: "#4d504a",
  PowerRegulator: "#a08a5b",
  SystemOnChip: "#b19a67",
  MemoryModule: "#85744f",
  StorageDevice: "#66706a",
  DisplayModule: "#1c2224",
  CoolingSystem: "#4f5652",
  WirelessModule: "#59645f",
  CameraModule: "#353d3d",
  Microcontroller: "#68705b",
  ExternalInterface: "#8c8f88",
  StructuralFrame: "#353733"
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
      <boxGeometry args={[size[0] + 0.08, size[1] + 0.08, size[2] + 0.08]} />
      <meshBasicMaterial color="#c3aa72" wireframe transparent opacity={0.95} />
    </mesh>
  );
}

function NotebookComponent({
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
  const isCamera = entity.type === "CameraModule";
  return (
    <group>
      <mesh position={position} onClick={click} castShadow>
        {isCamera
          ? <cylinderGeometry args={[size[0] / 2, size[0] / 2, Math.max(size[1], 0.06), 24]} />
          : <boxGeometry args={size} />}
        <meshStandardMaterial
          color={COMPONENT_COLORS[entity.type] ?? "#666860"}
          roughness={entity.type === "DisplayModule" ? 0.24 : 0.62}
          metalness={entity.type === "ExternalInterface" ? 0.68 : 0.24}
        />
      </mesh>
      {selected ? <SelectionOutline position={position} size={size} /> : null}
    </group>
  );
}

export function NotebookAssembly({ session, selectedId, onSelect }: NotebookAssemblyProps) {
  const root = session.getEntity("notebook.root");
  const opened = root.state === "open" || root.state === "exploded";
  const exploded = root.state === "exploded";
  const components = session.graph
    .getDependencies(root.id, "contains")
    .filter((entity) => entity.type !== "BootProcess");

  const select = (entity: EngineeringEntity, position: Vector3Tuple) => {
    const binding = createSpatialBinding(entity, { position: { x: position[0], y: position[1], z: position[2] } });
    onSelect(resolveSpatialSelection(entity, binding).entity);
  };
  const selectRoot = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    select(root, [0, 0, 0]);
  };

  const lidRotation: Vector3Tuple = opened ? [-1.02, 0, 0] : [-0.08, 0, 0];
  const lidPosition: Vector3Tuple = opened ? [0, 1.62, -1.08] : [0, 0.2, -0.96];

  return (
    <group position={[0, 0.95, 0]}>
      <mesh position={[0, 0, 0]} onClick={selectRoot} castShadow receiveShadow>
        <boxGeometry args={[4.05, 0.2, 2.7]} />
        <meshStandardMaterial color="#30332f" roughness={0.68} metalness={0.34} />
      </mesh>

      <group position={lidPosition} rotation={lidRotation}>
        <mesh position={[0, 1.05, 0]} onClick={selectRoot} castShadow>
          <boxGeometry args={[3.9, 2.25, 0.12]} />
          <meshStandardMaterial color="#343733" roughness={0.62} metalness={0.32} />
        </mesh>
        <mesh position={[0, 1.05, 0.075]} onClick={selectRoot}>
          <boxGeometry args={[3.56, 1.93, 0.025]} />
          <meshStandardMaterial color="#171d1f" roughness={0.18} metalness={0.08} />
        </mesh>
      </group>

      {opened ? (
        <>
          <mesh position={[0, 0.12, 0.56]} onClick={selectRoot} receiveShadow>
            <boxGeometry args={[2.9, 0.025, 0.9]} />
            <meshStandardMaterial color="#282b27" roughness={0.84} />
          </mesh>
          <mesh position={[0, 0.13, -0.28]} onClick={selectRoot}>
            <boxGeometry args={[1.55, 0.025, 0.82]} />
            <meshStandardMaterial color="#3b3e39" roughness={0.72} />
          </mesh>
        </>
      ) : null}

      {opened
        ? components.map((entity) => {
            const spatial = readSpatial(entity);
            const removed = entity.state === "removed";
            const position: Vector3Tuple = removed
              ? entity.id === "notebook.memory"
                ? [-2.8, 0.9, -0.7]
                : entity.id === "notebook.storage"
                  ? [-2.8, 0.9, 0.05]
                  : entity.id === "notebook.battery"
                    ? [-2.8, 0.75, 0.85]
                    : spatial.exploded
              : exploded
                ? spatial.exploded
                : spatial.position;
            return (
              <NotebookComponent
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

      {selectedId === root.id ? <SelectionOutline position={[0, 0, 0]} size={[4.18, 2.9, 2.85]} /> : null}

      <mesh position={[0, -0.9, 0]} receiveShadow>
        <boxGeometry args={[8.2, 0.16, 5.6]} />
        <meshStandardMaterial color="#232521" roughness={0.94} />
      </mesh>
    </group>
  );
}
