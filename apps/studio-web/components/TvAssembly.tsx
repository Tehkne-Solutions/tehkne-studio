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
  PowerSupply: "#9a8355",
  MediaController: "#6f765e",
  StorageDevice: "#65706a",
  WirelessModule: "#59645f",
  DisplayModule: "#171d1f",
  ExternalInterface: "#8b8e87",
  ElectroacousticActuator: "#4f544e",
  StructuralFrame: "#353733"
};

function spatial(entity: EngineeringEntity): SpatialMetadata {
  const candidate = entity.metadata.spatial;
  if (!candidate || typeof candidate !== "object") throw new Error(`Missing spatial metadata for ${entity.id}`);
  const value = candidate as Partial<SpatialMetadata>;
  if (!Array.isArray(value.position) || !Array.isArray(value.exploded) || !Array.isArray(value.size)) {
    throw new Error(`Invalid spatial metadata for ${entity.id}`);
  }
  return value as SpatialMetadata;
}

function Outline({ position, size }: { readonly position: Vector3Tuple; readonly size: Vector3Tuple }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[size[0] + 0.09, size[1] + 0.09, size[2] + 0.09]} />
      <meshBasicMaterial color="#c3aa72" wireframe transparent opacity={0.95} />
    </mesh>
  );
}

function Part({ entity, position, size, selected, onSelect }: {
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
          roughness={entity.type === "DisplayModule" ? 0.2 : 0.62}
          metalness={entity.type === "ExternalInterface" ? 0.7 : 0.22}
        />
      </mesh>
      {selected ? <Outline position={position} size={size} /> : null}
    </group>
  );
}

export function TvAssembly({ session, selectedId, onSelect }: TvAssemblyProps) {
  const root = session.getEntity("tv.root");
  const opened = root.state === "open" || root.state === "exploded";
  const exploded = root.state === "exploded";
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
    <group position={[0, 1.35, 0]}>
      <mesh position={[0, 0, -0.22]} onClick={selectRoot} castShadow receiveShadow>
        <boxGeometry args={[6.05, 3.5, 0.26]} />
        <meshStandardMaterial color="#30322f" roughness={0.66} metalness={0.28} />
      </mesh>

      <mesh position={opened ? [-4.05, 0, -0.7] : [0, 0, 0.02]} onClick={selectRoot} castShadow>
        <boxGeometry args={[5.85, 3.3, 0.09]} />
        <meshStandardMaterial color={opened ? "#393b37" : "#151c1e"} roughness={opened ? 0.68 : 0.18} metalness={0.08} />
      </mesh>

      {!opened ? (
        <mesh position={[0, -1.78, -0.15]} onClick={selectRoot} castShadow>
          <boxGeometry args={[2.1, 0.16, 0.7]} />
          <meshStandardMaterial color="#3a3c38" roughness={0.72} metalness={0.22} />
        </mesh>
      ) : null}

      {opened ? components.map((entity) => {
        const meta = spatial(entity);
        const removed = entity.state === "removed";
        const position: Vector3Tuple = removed
          ? entity.id === "tv.psu"
            ? [-4.2, -1.0, 0.85]
            : entity.id === "tv.panel"
              ? [0, 0, 2.2]
              : meta.exploded
          : exploded
            ? meta.exploded
            : meta.position;
        return (
          <Part
            key={entity.id}
            entity={entity}
            position={position}
            size={meta.size}
            selected={selectedId === entity.id}
            onSelect={select}
          />
        );
      }) : null}

      {selectedId === root.id ? <Outline position={[0, 0, -0.1]} size={[6.18, 3.62, 0.58]} /> : null}

      <mesh position={[0, -2.0, -0.75]} receiveShadow>
        <boxGeometry args={[9.4, 0.16, 5.8]} />
        <meshStandardMaterial color="#232521" roughness={0.94} />
      </mesh>
    </group>
  );
}
