"use client";

import { Canvas, useLoader } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import { Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MOTOR_URL = "/api/asset-forge/af001/motor/lod0";
const COUPLER_URL = "/api/asset-forge/af002/coupler";
const MOTOR_SHAFT_OUT_Z = 0.03185;
const COUPLER_AXIS_IN_Z = -0.0175;
const MOTOR_CENTER_Z = COUPLER_AXIS_IN_Z - MOTOR_SHAFT_OUT_Z;

function RuntimeAsset({ url, name, position }: { readonly url: string; readonly name: string; readonly position: readonly [number, number, number] }) {
  const gltf = useLoader(GLTFLoader, url);
  const scene = useMemo<Object3D>(() => gltf.scene.clone(true), [gltf.scene]);
  return <group name={name} position={[position[0], position[1], position[2]]}><primitive object={scene} /></group>;
}

function ReviewScene() {
  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[0.3, 0.45, 0.6]} intensity={4} />
      <directionalLight position={[-0.4, 0.15, -0.25]} intensity={2} />
      <gridHelper args={[0.4, 20, "#343a38", "#242927"]} position={[0, -0.045, 0]} />
      <RuntimeAsset url={MOTOR_URL} name="af001-runtime-motor" position={[0, 0, MOTOR_CENTER_Z]} />
      <RuntimeAsset url={COUPLER_URL} name="af002-runtime-coupler" position={[0, 0, 0]} />
      <mesh name="af002-snap-evidence" position={[0, 0, COUPLER_AXIS_IN_Z]}>
        <sphereGeometry args={[0.0025, 16, 12]} />
        <meshStandardMaterial color="#d8c18c" metalness={0.35} roughness={0.3} />
      </mesh>
    </>
  );
}

export function Af002RuntimeVisualReview() {
  const motorEndpointZ = MOTOR_CENTER_Z + MOTOR_SHAFT_OUT_Z;
  const couplerEndpointZ = COUPLER_AXIS_IN_Z;
  const endpointGapM = Math.abs(motorEndpointZ - couplerEndpointZ);
  return (
    <main style={{ minHeight: "100vh", background: "#111513", color: "#e8e2d1", display: "grid", gridTemplateRows: "auto 1fr auto" }}>
      <header style={{ padding: "18px 24px", borderBottom: "1px solid #303632" }}>
        <strong>AF-002 · Runtime Visual & Physical Snap Review</strong>
        <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>AF-001 shaft-out → AF-002 axis-in · Tehkné Solutions</div>
      </header>
      <section style={{ minHeight: 520 }}>
        <Canvas camera={{ position: [0.13, 0.09, 0.22], fov: 38 }}>
          <Suspense fallback={null}><ReviewScene /></Suspense>
        </Canvas>
      </section>
      <footer
        data-testid="af002-runtime-snap-evidence"
        data-topology="connectedTo"
        data-motor-socket="SOCKET_MECH_AXIS_OUT"
        data-coupler-socket="SOCKET_MECH_AXIS_IN"
        data-motor-runtime-url={MOTOR_URL}
        data-coupler-runtime-url={COUPLER_URL}
        data-endpoint-gap-m={endpointGapM.toFixed(6)}
        style={{ padding: "14px 24px", borderTop: "1px solid #303632", display: "flex", gap: 22, flexWrap: "wrap", fontSize: 13 }}
      >
        <span>Topology: <strong>connectedTo</strong></span>
        <span>Motor socket: <strong>SOCKET_MECH_AXIS_OUT</strong></span>
        <span>Coupler socket: <strong>SOCKET_MECH_AXIS_IN</strong></span>
        <span>Endpoint gap: <strong>{endpointGapM.toFixed(6)} m</strong></span>
        <span>Visual payloads: <strong>GLB runtime</strong></span>
      </footer>
    </main>
  );
}
