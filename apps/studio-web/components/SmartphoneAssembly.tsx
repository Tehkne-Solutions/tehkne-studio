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

interface SmartphoneAssemblyProps {
  readonly session: EngineeringSession;
  readonly selectedId: string | null;
  readonly onSelect: (entity: EngineeringEntity) => void;
}

const COMPONENT_COLORS: Readonly<Record<string, string>> = {
  BatteryPack: "#494b45",
  PowerRegulator: "#a08a5b",
  SystemOnChip: "#b19a67",
  MemoryModule: "#83704e",
  StorageDevice: "#68716b",
  DisplayModule: "#20282a",
  InertialSensor: "#6c765f",
  CameraModule: "#3c4544",
  WirelessModule: "#58645e",
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
      <boxGeometry args={[size[0] + 0.08, size[1] + 0.08, size[2] + 0.08]} />
      <meshBasicMaterial color="#c3aa72" wireframe transparent opacity={0.94} />
    </mesh>
  );
}

function PhoneComponent({
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
          roughness={entity.type === "DisplayModule" ? 0.28 : 0.6}
          metalness={entity.type === "ExternalInterface" ? 0.68 : 0.22}
        />
      </mesh>
      {selected ? <SelectionOutline position={position} size={size} /> : null}
    </group>
  );
}

export function SmartphoneAssembly({ session, selectedId, onSelect }: SmartphoneAssemblyProps) {
  const root = session.getEntity("phone.root");
  const exploded = root.state === "exploded";
  const opened = root.state === "open" || exploded;
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

  return (
    <group position={[0, 1.03, 0]}>
      <mesh position={[0, 0, -0.12]} onClick={selectRoot} castShadow receiveShadow>
        <boxGeometry args={[1.62, 3.24, 0.16]} />
        <meshStandardMaterial color="#2d302d" roughness={0.72} metalness={0.3} />
      </mesh>

      <mesh
        position={opened ? [-1.2, 0, -0.28] : [0, 0, 0.02]}
        rotation={opened ? [0, 0.16, -0.04] : [0, 0, 0]}
        onClick={selectRoot}
        castShadow
      >
        <boxGeometry args={[1.54, 3.14, 0.08]} />
        <meshStandardMaterial color="#3a3d39" roughness={0.66} metalness={0.32} />
      </mesh>

      {!opened ? (
        <>
          <mesh position={[0, 0, 0.11]} onClick={selectRoot} castShadow>
            <boxGeometry args={[1.43, 2.96, 0.04]} />
            <meshStandardMaterial color="#171d1e" roughness={0.2} metalness={0.08} />
          </mesh>
          <mesh position={[0, 1.34, 0.15]} onClick={selectRoot}>
            <boxGeometry args={[0.38, 0.05, 0.03]} />
            <meshStandardMaterial color="#555850" roughness={0.5} />
          </mesh>
        </>
      ) : null}

      {opened
        ? components.map((entity) => {
            const spatial = readSpatial(entity);
            const removed = entity.state === "removed";
            const position: Vector3Tuple = removed
              ? [-2.2, -0.15, 0.75]
              : exploded
                ? spatial.exploded
                : spatial.position;
            return (
              <PhoneComponent
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

      {selectedId === root.id ? <SelectionOutline position={[0, 0, 0]} size={[1.72, 3.34, 0.42]} /> : null}

      <mesh position={[0, -1.62, -0.5]} receiveShadow>
        <boxGeometry args={[6.8, 0.16, 4.3]} />
        <meshStandardMaterial color="#232521" roughness={0.92} />
      </mesh>
    </group>
  );
}
