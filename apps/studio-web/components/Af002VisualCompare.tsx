"use client";

import { Canvas, useLoader } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const BASELINE_URL = "/api/asset-forge/af002/coupler";
const CANDIDATE_URL = "/api/asset-forge/af002/coupler-v040-candidate";

function Asset({ url, onReady }: { readonly url: string; readonly onReady: (socketOk: boolean) => void }) {
  const gltf = useLoader(GLTFLoader, url);
  const scene = useMemo<Object3D>(() => gltf.scene.clone(true), [gltf.scene]);
  useEffect(() => {
    const socketOk = Boolean(scene.getObjectByName("SOCKET_MECH_AXIS_IN") && scene.getObjectByName("SOCKET_MECH_AXIS_OUT"));
    onReady(socketOk);
  }, [onReady, scene]);
  return <primitive object={scene} />;
}

function Preview({ url, label, onReady }: { readonly url: string; readonly label: string; readonly onReady: (socketOk: boolean) => void }) {
  return (
    <section style={{ display: "grid", gridTemplateRows: "auto 1fr", border: "1px solid #303632", background: "#151917" }}>
      <header style={{ padding: "12px 16px", borderBottom: "1px solid #303632", fontSize: 13 }}>{label}</header>
      <div style={{ minHeight: 520 }}>
        <Canvas camera={{ position: [0.065, 0.055, 0.105], fov: 34 }}>
          <ambientLight intensity={1.4} />
          <directionalLight position={[0.12, 0.15, 0.2]} intensity={4.2} />
          <directionalLight position={[-0.12, 0.08, -0.08]} intensity={1.6} />
          <gridHelper args={[0.18, 18, "#343a38", "#242927"]} position={[0, -0.025, 0]} />
          <Suspense fallback={null}><Asset url={url} onReady={onReady} /></Suspense>
        </Canvas>
      </div>
    </section>
  );
}

export function Af002VisualCompare() {
  const [baselineReady, setBaselineReady] = useState(false);
  const [candidateReady, setCandidateReady] = useState(false);
  return (
    <main style={{ minHeight: "100vh", background: "#101311", color: "#e8e2d1", padding: 20 }}>
      <header style={{ marginBottom: 16 }}>
        <strong>AF-002 · Visual Quality A/B Review</strong>
        <div style={{ marginTop: 6, opacity: 0.72, fontSize: 13 }}>v0.3 runtime baseline × v0.4 visual-quality candidate · Tehkné Solutions</div>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Preview url={BASELINE_URL} label="v0.3 · Runtime Candidate · 1,792 tris" onReady={setBaselineReady} />
        <Preview url={CANDIDATE_URL} label="v0.4 · Visual Quality Candidate · 10,816 tris" onReady={setCandidateReady} />
      </div>
      <footer
        data-testid="af002-visual-compare-state"
        data-baseline-ready={baselineReady ? "true" : "false"}
        data-candidate-ready={candidateReady ? "true" : "false"}
        data-baseline-url={BASELINE_URL}
        data-candidate-url={CANDIDATE_URL}
        data-runtime-promoted="false"
        style={{ marginTop: 16, padding: "12px 14px", border: "1px solid #303632", display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13 }}
      >
        <span>Baseline sockets: <strong>{baselineReady ? "READY" : "WAIT"}</strong></span>
        <span>Candidate sockets: <strong>{candidateReady ? "READY" : "WAIT"}</strong></span>
        <span>Runtime promoted: <strong>NO</strong></span>
      </footer>
    </main>
  );
}
