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

interface TabletAssemblyProps {
  readonly session: EngineeringSession;
  readonly selectedId: string | null;
  readonly onSelect: (entity: EngineeringEntity) => void;
}

const COMPONENT_COLORS: Readonly<Record<string, string>> = {
  BatteryPack: "#4b4e48",
  PowerRegulator: "#a08a5b",
  SystemOnChip: "#b19a67",
  MemoryModule: "#83704e",
  StorageDevice: "#68716b",
  DisplayModule: "#1a2223",
  InertialSensor: "#6c765f",
  CameraModule: "#3b4443",
  WirelessModule: "#58645e",
  Microcontroller: "#69715c",
  ExternalInterface: "#8d8f88",
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
      <boxGeometry args={[size[0] + 0.09, size[1] + 0.09, size[2] + 0.09]} />
      <meshBasicMaterial color="#c3aa72" wireframe transparent opacity={0.95} />
    </mesh>
  );
}

function TabletComponent({
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
          ? <cylinderGeometry args={[size[0] / 2, size[0] / 2, size[2], 24]} />
          : <boxGeometry args={size} />}
        <meshStandardMaterial
          color={COMPONENT_COLORS[entity.type] ?? "#666860"}
          roughness={entity.type === "DisplayModule" ? 0.24 : 0.61}
          metalness={entity.type === "ExternalInterface" ? 0.68 : 0.22}
        />
      </mesh>
      {selected ? <SelectionOutline position={position} size={size} /> : null}
    </group>
  );
}

export function TabletAssembly({ session, selectedId, onSelect }: TabletAssemblyProps) {
  const root = session.getEntity("tablet.root");
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
    <group position={[0, 1.2, 0]} rotation={[0, 0, -0.02]}>
      <mesh position={[0, 0, -0.12]} onClick={selectRoot} castShadow receiveShadow>
        <boxGeometry args={[2.86, 4.02, 0.16]} />
        <meshStandardMaterial color="#30332f" roughness={0.67} metalness={0.32} />
      </mesh>

      <mesh
        position={opened ? [-1.95, 0, -0.3] : [0, 0, 0.02]}
        rotation={opened ? [0, 0.12, -0.035] : [0, 0, 0]}
        onClick={selectRoot}
        castShadow
      >
        <boxGeometry args={[2.76, 3.92, 0.08]} />
        <meshStandardMaterial color="#393c38" roughness={0.64} metalness={0.3} />
      </mesh>

      {!opened ? (
        <>
          <mesh position={[0, 0, 0.11]} onClick={selectRoot} castShadow>
            <boxGeometry args={[2.6, 3.7, 0.04]} />
            <meshStandardMaterial color="#161d1e" roughness={0.2} metalness={0.08} />
          </mesh>
          <mesh position={[0, 1.8, 0.15]} onClick={selectRoot}>
            <boxGeometry args={[0.06, 0.06, 0.025]} />
            <meshStandardMaterial color="#565850" roughness={0.5} />
          </mesh>
        </>
      ) : null}

      {opened
        ? components.map((entity) => {
            const spatial = readSpatial(entity);
            const removed = entity.state === "removed";
            const position: Vector3Tuple = removed
              ? entity.id === "tablet.battery"
                ? [-3.05, -0.2, 0.85]
                : spatial.exploded
              : exploded
                ? spatial.exploded
                : spatial.position;
            return (
              <TabletComponent
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

      {selectedId === root.id ? <SelectionOutline position={[0, 0, 0]} size={[2.98, 4.14, 0.44]} /> : null}

      <mesh position={[0, -2.15, -0.5]} receiveShadow>
        <boxGeometry args={[8.4, 0.16, 5.8]} />
        <meshStandardMaterial color="#232521" roughness={0.94} />
      </mesh>
    </group>
  );
}
