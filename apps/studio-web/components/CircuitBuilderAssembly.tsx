"use client";

import { type ThreeEvent } from "@react-three/fiber";
import type { EngineeringEntity } from "../../../packages/engineering-core/src/index";
import type { EngineeringSession } from "../../../packages/engineering-session/src/index";
import { CIRCUIT_ROOT_ID } from "../../../packages/circuit-runtime/src/index";

type Vector3Tuple = [number, number, number];

interface CircuitBuilderAssemblyProps {
  readonly session: EngineeringSession;
  readonly selectedId: string | null;
  readonly onSelect: (entity: EngineeringEntity) => void;
}

const colors: Readonly<Record<string, string>> = {
  DcPowerSource: "#8f7a50",
  CircuitSwitch: "#66705b",
  Resistor: "#a08a5b",
  Led: "#8b5147",
  VoltageProbe: "#8b8d86"
};

function componentPosition(index: number, total: number): Vector3Tuple {
  const spacing = 1.75;
  const start = -((Math.max(total, 1) - 1) * spacing) / 2;
  return [start + index * spacing, 0.25, 0];
}

function Wire({ from, to }: { readonly from: Vector3Tuple; readonly to: Vector3Tuple }) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);
  const position: Vector3Tuple = [(from[0] + to[0]) / 2, 0.08, (from[2] + to[2]) / 2];
  return (
    <mesh position={position} rotation={[0, -angle, 0]}>
      <boxGeometry args={[Math.max(length, 0.08), 0.045, 0.045]} />
      <meshStandardMaterial color="#b09762" roughness={0.48} metalness={0.22} />
    </mesh>
  );
}

export function CircuitBuilderAssembly({ session, selectedId, onSelect }: CircuitBuilderAssemblyProps) {
  const root = session.getEntity(CIRCUIT_ROOT_ID);
  const entities = session.graph.snapshot().entities
    .filter((entity) => entity.parentId === CIRCUIT_ROOT_ID && entity.type !== "VoltageProbe")
    .sort((a, b) => a.id.localeCompare(b.id));
  const probes = session.graph.snapshot().entities.filter((entity) => entity.parentId === CIRCUIT_ROOT_ID && entity.type === "VoltageProbe");
  const positions = new Map<string, Vector3Tuple>();
  entities.forEach((entity, index) => positions.set(entity.id, componentPosition(index, entities.length)));
  const wires = session.graph.snapshot().relationships.filter((relationship) => relationship.type === "connectedTo" && relationship.metadata.circuitBuilder === true);

  const select = (entity: EngineeringEntity) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(entity);
  };

  return (
    <group position={[0, 0.75, 0]}>
      <mesh position={[0, -0.42, 0]} receiveShadow onClick={select(root)}>
        <boxGeometry args={[10.6, 0.18, 4.7]} />
        <meshStandardMaterial color="#292b26" roughness={0.9} />
      </mesh>

      {wires.map((wire) => {
        const from = positions.get(wire.source);
        const to = positions.get(wire.target);
        return from && to ? <Wire key={wire.id} from={from} to={to} /> : null;
      })}

      {entities.map((entity) => {
        const position = positions.get(entity.id)!;
        const selected = selectedId === entity.id;
        const fault = entity.state === "fault";
        return (
          <group key={entity.id}>
            <mesh position={position} onClick={select(entity)} castShadow>
              {entity.type === "Led" ? <cylinderGeometry args={[0.28, 0.34, 0.55, 24]} /> : <boxGeometry args={[1.15, 0.58, 0.78]} />}
              <meshStandardMaterial color={fault ? "#78453e" : colors[entity.type] ?? "#64665d"} roughness={0.62} metalness={0.18} />
            </mesh>
            {selected ? (
              <mesh position={position}>
                <boxGeometry args={[1.28, 0.7, 0.92]} />
                <meshBasicMaterial color="#c3aa72" wireframe transparent opacity={0.95} />
              </mesh>
            ) : null}
          </group>
        );
      })}

      {probes.map((probe, index) => {
        const position: Vector3Tuple = [-4.6 + index * 0.75, 1.25, 1.5];
        return (
          <mesh key={probe.id} position={position} onClick={select(probe)} castShadow>
            <boxGeometry args={[0.55, 0.28, 0.78]} />
            <meshStandardMaterial color={colors.VoltageProbe} roughness={0.58} metalness={0.3} />
          </mesh>
        );
      })}

      {entities.length === 0 ? (
        <mesh position={[0, 0.15, 0]} onClick={select(root)}>
          <boxGeometry args={[3.6, 0.12, 1.2]} />
          <meshStandardMaterial color="#3b3d36" roughness={0.82} />
        </mesh>
      ) : null}
    </group>
  );
}
