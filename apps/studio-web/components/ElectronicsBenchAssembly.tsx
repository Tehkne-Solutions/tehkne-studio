"use client";

import { type ThreeEvent } from "@react-three/fiber";
import type { EngineeringEntity } from "../../../packages/engineering-core/src/index";
import type { EngineeringSession } from "../../../packages/engineering-session/src/index";
import { createSpatialBinding, resolveSpatialSelection } from "../../../packages/spatial-runtime/src/index";

interface ElectronicsBenchAssemblyProps {
  readonly session: EngineeringSession;
  readonly selectedId: string | null;
  readonly onSelect: (entity: EngineeringEntity) => void;
}

type V3 = [number, number, number];

const POSITIONS: Readonly<Record<string, V3>> = {
  "electronics.root": [0, 0, 0],
  "electronics.source": [-3.1, 0.45, 0.4],
  "electronics.switch": [-1.3, 0.3, 0.15],
  "electronics.resistor": [0.1, 0.3, 0.15],
  "electronics.led": [1.55, 0.43, 0.15],
  "electronics.multimeter": [3.15, 0.4, 0.35]
};

function selectAt(
  entity: EngineeringEntity,
  position: V3,
  onSelect: (entity: EngineeringEntity) => void
) {
  const binding = createSpatialBinding(entity, { position: { x: position[0], y: position[1], z: position[2] } });
  onSelect(resolveSpatialSelection(entity, binding).entity);
}

function Outline({ position, size }: { readonly position: V3; readonly size: V3 }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[size[0] + 0.12, size[1] + 0.12, size[2] + 0.12]} />
      <meshBasicMaterial wireframe color="#c3aa72" transparent opacity={0.95} />
    </mesh>
  );
}

export function ElectronicsBenchAssembly({ session, selectedId, onSelect }: ElectronicsBenchAssemblyProps) {
  const source = session.getEntity("electronics.source");
  const switchEntity = session.getEntity("electronics.switch");
  const resistor = session.getEntity("electronics.resistor");
  const led = session.getEntity("electronics.led");
  const meter = session.getEntity("electronics.multimeter");
  const ledOn = led.state === "on";
  const ledFault = led.state === "fault";
  const switchClosed = switchEntity.properties.closed?.value === true;

  const click = (entity: EngineeringEntity, position: V3) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    selectAt(entity, position, onSelect);
  };

  return (
    <group position={[0, 0.65, 0]}>
      <mesh position={[0, -0.42, 0]} receiveShadow>
        <boxGeometry args={[8.6, 0.18, 4.7]} />
        <meshStandardMaterial color="#252722" roughness={0.94} />
      </mesh>

      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[5.4, 0.16, 2.4]} />
        <meshStandardMaterial color="#d6d1bf" roughness={0.78} />
      </mesh>

      {Array.from({ length: 18 }).map((_, index) => (
        <group key={index}>
          <mesh position={[-2.35 + index * 0.28, 0.1, -0.72]}>
            <cylinderGeometry args={[0.035, 0.035, 0.025, 12]} />
            <meshStandardMaterial color="#4b4d47" />
          </mesh>
          <mesh position={[-2.35 + index * 0.28, 0.1, 0.72]}>
            <cylinderGeometry args={[0.035, 0.035, 0.025, 12]} />
            <meshStandardMaterial color="#4b4d47" />
          </mesh>
        </group>
      ))}

      <mesh position={POSITIONS["electronics.source"]} onClick={click(source, POSITIONS["electronics.source"])} castShadow>
        <boxGeometry args={[1.45, 0.82, 1.25]} />
        <meshStandardMaterial color="#4a4d47" roughness={0.66} metalness={0.28} />
      </mesh>
      <mesh position={[-3.1, 0.64, 1.04]}>
        <boxGeometry args={[0.78, 0.22, 0.04]} />
        <meshStandardMaterial color="#171b18" emissive="#263126" emissiveIntensity={0.35} />
      </mesh>

      <mesh position={POSITIONS["electronics.switch"]} onClick={click(switchEntity, POSITIONS["electronics.switch"])} castShadow>
        <boxGeometry args={[0.7, 0.28, 0.58]} />
        <meshStandardMaterial color="#615c4e" roughness={0.72} />
      </mesh>
      <mesh position={[-1.3, switchClosed ? 0.52 : 0.62, 0.15]} rotation={[0, 0, switchClosed ? 0 : -0.55]}>
        <boxGeometry args={[0.55, 0.08, 0.09]} />
        <meshStandardMaterial color="#b0a176" metalness={0.55} roughness={0.42} />
      </mesh>

      <group position={POSITIONS["electronics.resistor"]}>
        <mesh onClick={click(resistor, POSITIONS["electronics.resistor"])} castShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 0.7, 24]} />
          <meshStandardMaterial color="#b9a77a" roughness={0.7} />
        </mesh>
        <mesh position={[-0.52, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, 0.45, 10]} />
          <meshStandardMaterial color="#858781" metalness={0.7} />
        </mesh>
        <mesh position={[0.52, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, 0.45, 10]} />
          <meshStandardMaterial color="#858781" metalness={0.7} />
        </mesh>
      </group>

      <group position={POSITIONS["electronics.led"]}>
        <mesh onClick={click(led, POSITIONS["electronics.led"])} castShadow>
          <sphereGeometry args={[0.22, 28, 20]} />
          <meshStandardMaterial
            color={ledFault ? "#6f3e36" : "#8b5345"}
            emissive={ledOn ? "#8b5345" : "#000000"}
            emissiveIntensity={ledOn ? 2.2 : 0}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[-0.08, -0.42, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.62, 10]} />
          <meshStandardMaterial color="#888a84" metalness={0.75} />
        </mesh>
        <mesh position={[0.08, -0.48, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.74, 10]} />
          <meshStandardMaterial color="#888a84" metalness={0.75} />
        </mesh>
      </group>

      <mesh position={POSITIONS["electronics.multimeter"]} onClick={click(meter, POSITIONS["electronics.multimeter"])} castShadow>
        <boxGeometry args={[1.28, 0.78, 1.05]} />
        <meshStandardMaterial color="#a28c59" roughness={0.64} />
      </mesh>
      <mesh position={[3.15, 0.62, 0.89]}>
        <boxGeometry args={[0.74, 0.22, 0.04]} />
        <meshStandardMaterial color="#1b211d" emissive="#30402e" emissiveIntensity={0.45} />
      </mesh>

      <mesh position={[-2.15, 0.2, 0.42]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 1.25, 10]} />
        <meshStandardMaterial color="#7f3f32" />
      </mesh>
      <mesh position={[0.82, 0.2, 0.38]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 1.05, 10]} />
        <meshStandardMaterial color="#7f3f32" />
      </mesh>
      <mesh position={[0, 0.17, -0.58]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 4.1, 10]} />
        <meshStandardMaterial color="#3f4642" />
      </mesh>

      {selectedId && POSITIONS[selectedId] ? <Outline position={POSITIONS[selectedId]} size={[0.9, 0.9, 0.9]} /> : null}
    </group>
  );
}
