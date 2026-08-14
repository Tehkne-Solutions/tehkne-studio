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

interface DesktopPcAssemblyProps {
  readonly session: EngineeringSession;
  readonly selectedId: string | null;
  readonly onSelect: (entity: EngineeringEntity) => void;
}

const PART_COLORS: Readonly<Record<string, string>> = {
  Motherboard: "#405247",
  Processor: "#b7a16f",
  MemoryModule: "#9c8354",
  GraphicsCard: "#4c5550",
  PowerSupply: "#343a38",
  StorageDevice: "#65716b",
  CoolingSystem: "#6d716b"
};

function readSpatial(entity: EngineeringEntity): SpatialMetadata {
  const candidate = entity.metadata.spatial;
  if (!candidate || typeof candidate !== "object") {
    throw new Error(`Missing spatial metadata for ${entity.id}`);
  }
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
      <meshBasicMaterial color="#c3aa72" wireframe transparent opacity={0.92} />
    </mesh>
  );
}

function ComponentMesh({
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

  if (entity.type === "CoolingSystem") {
    return (
      <group>
        <mesh position={position} rotation={[Math.PI / 2, 0, 0]} onClick={click} castShadow>
          <cylinderGeometry args={[size[0] / 2, size[0] / 2, size[2], 24]} />
          <meshStandardMaterial color={PART_COLORS[entity.type]} roughness={0.64} metalness={0.3} />
        </mesh>
        {selected ? <SelectionOutline position={position} size={size} /> : null}
      </group>
    );
  }

  return (
    <group>
      <mesh position={position} onClick={click} castShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={PART_COLORS[entity.type] ?? "#666860"} roughness={0.62} metalness={0.24} />
      </mesh>
      {selected ? <SelectionOutline position={position} size={size} /> : null}
    </group>
  );
}

export function DesktopPcAssembly({ session, selectedId, onSelect }: DesktopPcAssemblyProps) {
  const root = session.getEntity("pc.root");
  const exploded = root.state === "exploded";
  const opened = root.state === "open" || exploded;
  const componentIds = session.graph
    .getDependencies(root.id, "contains")
    .filter((entity) => entity.type !== "BootProcess")
    .map((entity) => entity.id);

  const select = (entity: EngineeringEntity, position: Vector3Tuple) => {
    const binding = createSpatialBinding(entity, { position: { x: position[0], y: position[1], z: position[2] } });
    onSelect(resolveSpatialSelection(entity, binding).entity);
  };

  const selectRoot = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    select(root, [0, 0.55, 0]);
  };

  return (
    <group position={[0, -0.15, 0]}>
      <mesh position={[0, 0.55, -0.36]} onClick={selectRoot} castShadow receiveShadow>
        <boxGeometry args={[2.72, 2.12, 0.08]} />
        <meshStandardMaterial color="#30322f" roughness={0.78} metalness={0.2} />
      </mesh>

      <mesh
        position={opened ? [-1.72, 0.62, 0.2] : [-1.37, 0.55, 0.38]}
        rotation={opened ? [0, 0.06, -0.08] : [0, 0, 0]}
        onClick={selectRoot}
        castShadow
      >
        <boxGeometry args={[0.08, 1.94, 1.48]} />
        <meshStandardMaterial color="#3a3c38" roughness={0.82} metalness={0.22} />
      </mesh>

      <mesh position={[1.36, 0.55, 0.38]} onClick={selectRoot} castShadow>
        <boxGeometry args={[0.08, 2.1, 1.48]} />
        <meshStandardMaterial color="#2b2d2a" roughness={0.82} metalness={0.22} />
      </mesh>

      <mesh position={[0, -0.48, 0.38]} onClick={selectRoot} castShadow>
        <boxGeometry args={[2.72, 0.08, 1.48]} />
        <meshStandardMaterial color="#2d2f2c" roughness={0.82} metalness={0.22} />
      </mesh>

      {opened
        ? componentIds.map((id) => {
            const entity = session.getEntity(id);
            const spatial = readSpatial(entity);
            const removed = entity.state === "removed";
            const position: Vector3Tuple = removed
              ? [-2.35, -0.15, 1.05]
              : exploded
                ? spatial.exploded
                : spatial.position;
            return (
              <ComponentMesh
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

      {selectedId === root.id ? (
        <SelectionOutline position={[0, 0.55, 0]} size={[2.84, 2.24, 1.62]} />
      ) : null}

      <mesh position={[0, -0.62, 0]} receiveShadow>
        <boxGeometry args={[7.4, 0.18, 4.8]} />
        <meshStandardMaterial color="#232521" roughness={0.92} />
      </mesh>
    </group>
  );
}
