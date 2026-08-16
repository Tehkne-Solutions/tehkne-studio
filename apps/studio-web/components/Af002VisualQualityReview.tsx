"use client";

import { Canvas, useLoader } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import { Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const RUNTIME_URL = "/api/asset-forge/af002/coupler";
const CANDIDATE_URL = "/api/asset-forge/af002/coupler-v04";

function Asset({ url, name }: { readonly url: string; readonly name: string }) {
  const gltf = useLoader(GLTFLoader, url);
  const scene = useMemo<Object3D>(() => gltf.scene.clone(true), [gltf.scene]);
  return <group name={name}><primitive object={scene} /></group>;
}

function Viewer({ url, name }: { readonly url: string; readonly name: string }) {
  return (
    <div style={{ minHeight: 430, border: "1px solid #303632", background: "#111513" }}>
      <Canvas camera={{ position: [0.08, 0.06, 0.12], fov: 36 }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[0.2, 0.35, 0.4]} intensity={4} />
        <directionalLight position={[-0.25, 0.1, -0.15]} intensity={2} />
        <gridHelper args={[0.18, 18, "#343a38", "#242927"]} position={[0, -0.025, 0]} />
        <Suspense fallback={null}><Asset url={url} name={name} /></Suspense>
      </Canvas>
    </div>
  );
}

export function Af002VisualQualityReview() {
  return (
    <main style={{ minHeight: "100vh", background: "#0d100f", color: "#e8e2d1", padding: 24 }}>
      <header style={{ marginBottom: 18 }}>
        <strong>AF-002 · v0.3 Runtime vs v0.4 Visual Quality Candidate</strong>
        <div style={{ marginTop: 6, opacity: 0.74, fontSize: 13 }}>Review-only comparison · runtime promotion: false · Tehkné Solutions</div>
      </header>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))", gap: 18 }}>
        <article data-testid="af002-runtime-v03" data-stage="RUNTIME_CANDIDATE" data-bytes="22600" data-triangles="1792" data-sha256="48e8363cdc38b5ae93ace0b975c42498663e03c922970fb2b60e80c65d26b50e">
          <h2 style={{ fontSize: 15 }}>v0.3 · Current runtime</h2>
          <Viewer url={RUNTIME_URL} name="af002-runtime-v03" />
        </article>
        <article data-testid="af002-candidate-v04" data-stage="VISUAL_QUALITY_CANDIDATE" data-bytes="59436" data-triangles="10816" data-sha256="451d97b50ed9321c45b8dfb7e679cf6f273ec335da837d2c49d377426b98f122" data-runtime-promoted="false">
          <h2 style={{ fontSize: 15 }}>v0.4 · Visual-quality candidate</h2>
          <Viewer url={CANDIDATE_URL} name="af002-candidate-v04" />
        </article>
      </section>
      <footer data-testid="af002-v04-review-authority" data-axis-in="-0.0175" data-axis-out="0.0175" data-runtime-url={RUNTIME_URL} data-candidate-url={CANDIDATE_URL} data-runtime-promoted="false" style={{ marginTop: 18, borderTop: "1px solid #303632", paddingTop: 14, fontSize: 13 }}>
        Canonical sockets preserved: SOCKET_MECH_AXIS_IN −17.5 mm · SOCKET_MECH_AXIS_OUT +17.5 mm · no HERO/Golden/runtime promotion.
      </footer>
    </main>
  );
}
