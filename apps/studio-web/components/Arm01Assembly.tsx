"use client";

import { ThreeEvent } from "@react-three/fiber";
import type { EngineeringEntity } from "../../../packages/engineering-core/src/index";
import type { EngineeringSession } from "../../../packages/engineering-session/src/index";

interface Arm01AssemblyProps {
  readonly session: EngineeringSession;
  readonly selectedId: string | null;
  readonly onSelect: (entity: EngineeringEntity) => void;
}

const DEG_TO_RAD = Math.PI / 180;

function numberValue(entity: EngineeringEntity, propertyId: string): number {
  const value = entity.properties[propertyId]?.value;
  return typeof value === "number" ? value : 0;
}

export function Arm01Assembly({ session, selectedId, onSelect }: Arm01AssemblyProps) {
  const robot = session.getEntity("arm.root");
  const baseJoint = session.getEntity("arm.joint.base");
  const shoulderJoint = session.getEntity("arm.joint.shoulder");
  const elbowJoint = session.getEntity("arm.joint.elbow");
  const upper = session.getEntity("arm.link.upper");
  const forearm = session.getEntity("arm.link.forearm");
  const gripper = session.getEntity("arm.gripper");
  const cube = session.getEntity("object.cube.red");

  const upperLength = numberValue(upper, "lengthM");
  const forearmLength = numberValue(forearm, "lengthM");
  const baseYaw = numberValue(baseJoint, "angleDeg") * DEG_TO_RAD;
  const shoulder = numberValue(shoulderJoint, "angleDeg") * DEG_TO_RAD;
  const elbow = numberValue(elbowJoint, "angleDeg") * DEG_TO_RAD;
  const openingM = numberValue(gripper, "openingMm") / 1000;
  const cubeSize = numberValue(cube, "sizeM");
  const cubePosition: [number, number, number] = [
    numberValue(cube, "xM"),
    numberValue(cube, "yM"),
    numberValue(cube, "zM")
  ];

  const select = (entity: EngineeringEntity) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(entity);
  };
  const material = (entityId: string, normal: string) => selectedId === entityId ? "#d7c395" : normal;

  return (
    <group position={[0, -0.53, 0]}>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[4.4, 0.08, 3.3]} />
        <meshStandardMaterial color="#262822" roughness={0.88} />
      </mesh>

      <mesh position={[0, 0.18, 0]} castShadow receiveShadow onClick={select(robot)}>
        <cylinderGeometry args={[0.38, 0.44, 0.36, 32]} />
        <meshStandardMaterial color={material(robot.id, "#4a4c46")} metalness={0.55} roughness={0.42} />
      </mesh>

      <group position={[0, 0.35, 0]} rotation={[0, -baseYaw, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} onClick={select(baseJoint)} castShadow>
          <cylinderGeometry args={[0.19, 0.19, 0.18, 28]} />
          <meshStandardMaterial color={material(baseJoint.id, "#8a7348")} metalness={0.48} roughness={0.38} />
        </mesh>

        <group rotation={[0, 0, shoulder]}>
          <mesh position={[upperLength / 2, 0, 0]} onClick={select(upper)} castShadow>
            <boxGeometry args={[upperLength, 0.16, 0.18]} />
            <meshStandardMaterial color={material(upper.id, "#5a5d55")} metalness={0.5} roughness={0.38} />
          </mesh>
          <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} onClick={select(shoulderJoint)} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.22, 28]} />
            <meshStandardMaterial color={material(shoulderJoint.id, "#967d50")} metalness={0.48} roughness={0.36} />
          </mesh>

          <group position={[upperLength, 0, 0]} rotation={[0, 0, elbow]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} onClick={select(elbowJoint)} castShadow>
              <cylinderGeometry args={[0.17, 0.17, 0.2, 28]} />
              <meshStandardMaterial color={material(elbowJoint.id, "#967d50")} metalness={0.48} roughness={0.36} />
            </mesh>
            <mesh position={[forearmLength / 2, 0, 0]} onClick={select(forearm)} castShadow>
              <boxGeometry args={[forearmLength, 0.13, 0.15]} />
              <meshStandardMaterial color={material(forearm.id, "#62655d")} metalness={0.48} roughness={0.4} />
            </mesh>

            <group position={[forearmLength, 0, 0]} onClick={select(gripper)}>
              <mesh castShadow>
                <boxGeometry args={[0.18, 0.12, 0.22]} />
                <meshStandardMaterial color={material(gripper.id, "#343630")} metalness={0.55} roughness={0.36} />
              </mesh>
              <mesh position={[0.12, openingM / 2 + 0.045, 0]} castShadow>
                <boxGeometry args={[0.24, 0.055, 0.065]} />
                <meshStandardMaterial color="#b29b69" metalness={0.5} roughness={0.35} />
              </mesh>
              <mesh position={[0.12, -(openingM / 2 + 0.045), 0]} castShadow>
                <boxGeometry args={[0.24, 0.055, 0.065]} />
                <meshStandardMaterial color="#b29b69" metalness={0.5} roughness={0.35} />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      <mesh position={cubePosition} onClick={select(cube)} castShadow receiveShadow>
        <boxGeometry args={[cubeSize, cubeSize, cubeSize]} />
        <meshStandardMaterial color={material(cube.id, "#8f4337")} roughness={0.48} />
      </mesh>

      <mesh position={[0.9, 0.31, 0.65]} receiveShadow>
        <boxGeometry args={[1.1, 0.08, 1.0]} />
        <meshStandardMaterial color="#3b3d37" metalness={0.3} roughness={0.68} />
      </mesh>
    </group>
  );
}
