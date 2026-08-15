"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MOTOR_URL = "/asset-forge/af001/TS_ELEC_MOTOR_DC_A_LOD2_RUNTIME_PREVIEW.glb";

interface RuntimeStats {
  readonly samples: number;
  readonly averageFrameMs: number;
  readonly p95FrameMs: number;
}

function GoldenMotorModel({ onReady }: { readonly onReady: () => void }) {
  const group = useRef<Group>(null);
  const gltf = useLoader(GLTFLoader, MOTOR_URL);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.35;
  });

  return (
    <group ref={group} rotation={[-0.35, 0.65, -0.08]}>
      <primitive object={scene} />
    </group>
  );
}

function LoadingMotor() {
  return (
    <mesh>
      <boxGeometry args={[0.022, 0.016, 0.03]} />
      <meshStandardMaterial color="#2d353d" metalness={0.35} roughness={0.55} />
    </mesh>
  );
}

function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * ratio))] ?? 0;
}

export function GoldenMotorPreview() {
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<RuntimeStats | null>(null);

  const markReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    let previous = performance.now();
    const samples: number[] = [];

    const sample = (now: number) => {
      if (cancelled) return;
      const delta = now - previous;
      previous = now;
      if (delta > 0 && delta < 250) samples.push(delta);

      if (samples.length >= 120) {
        const averageFrameMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
        setStats({
          samples: samples.length,
          averageFrameMs: Number(averageFrameMs.toFixed(2)),
          p95FrameMs: Number(percentile(samples, 0.95).toFixed(2))
        });
        return;
      }
      requestAnimationFrame(sample);
    };

    const id = requestAnimationFrame(sample);
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [ready]);

  const smokePass = Boolean(stats && stats.averageFrameMs < 100 && stats.p95FrameMs < 150);

  return (
    <section
      aria-label="AF-001H Golden Motor Runtime Preview"
      data-runtime-ready={ready ? "true" : "false"}
      data-benchmark-ready={stats ? "true" : "false"}
      style={{
        minHeight: "100dvh",
        background: "#0c1116",
        color: "#eef4f6",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        padding: "24px",
        gap: "18px"
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "end" }}>
        <div>
          <span style={{ color: "#52cbd8", fontWeight: 800, letterSpacing: ".12em", fontSize: "12px" }}>
            TEHKNÉ SOLUTIONS · ASSET FORGE
          </span>
          <h1 style={{ margin: "8px 0 0", fontSize: "clamp(26px, 4vw, 44px)" }}>AF-001H · Golden Motor Runtime Preview</h1>
          <p style={{ color: "#9eabb5", margin: "8px 0 0" }}>
            GLB real · LOD2 smoke asset · PBR factors · fail-closed candidate
          </p>
        </div>
        <div style={{ textAlign: "right", color: ready ? "#78d69b" : "#e9b65c", fontWeight: 800 }}>
          {ready ? "GLB READY" : "LOADING GLB"}
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 340px)", gap: "18px", minHeight: 0 }}>
        <div style={{ border: "1px solid #303c46", borderRadius: "22px", overflow: "hidden", minHeight: "520px" }}>
          <Canvas
            camera={{ position: [0.07, 0.05, 0.085], fov: 34, near: 0.001, far: 5 }}
            dpr={[1, 1.5]}
            shadows
            gl={{ antialias: true, powerPreference: "high-performance" }}
          >
            <color attach="background" args={["#111820"]} />
            <ambientLight intensity={0.8} />
            <directionalLight position={[0.08, 0.12, 0.08]} intensity={4.5} castShadow />
            <directionalLight position={[-0.08, 0.04, -0.04]} intensity={1.8} />
            <pointLight position={[0, -0.02, 0.08]} intensity={1.2} />
            <Suspense fallback={<LoadingMotor />}>
              <GoldenMotorModel onReady={markReady} />
            </Suspense>
            <mesh position={[0, -0.016, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[0.22, 0.22]} />
              <meshStandardMaterial color="#171d23" metalness={0.08} roughness={0.82} />
            </mesh>
          </Canvas>
        </div>

        <aside style={{ border: "1px solid #303c46", borderRadius: "22px", padding: "22px", background: "#141b22" }}>
          <h2 style={{ marginTop: 0 }}>Runtime gate</h2>
          <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px 16px", margin: 0 }}>
            <dt style={{ color: "#9eabb5" }}>Asset</dt><dd style={{ margin: 0, fontWeight: 800 }}>TS_ELEC_MOTOR_DC_A</dd>
            <dt style={{ color: "#9eabb5" }}>Preview LOD</dt><dd style={{ margin: 0, fontWeight: 800 }}>LOD2</dd>
            <dt style={{ color: "#9eabb5" }}>Triangles</dt><dd style={{ margin: 0, fontWeight: 800 }}>824</dd>
            <dt style={{ color: "#9eabb5" }}>Payload</dt><dd style={{ margin: 0, fontWeight: 800 }}>21.5 KB</dd>
            <dt style={{ color: "#9eabb5" }}>GLB</dt><dd style={{ margin: 0, color: ready ? "#78d69b" : "#e9b65c", fontWeight: 800 }}>{ready ? "PASS" : "WAIT"}</dd>
            <dt style={{ color: "#9eabb5" }}>Frames</dt><dd style={{ margin: 0, fontWeight: 800 }}>{stats?.samples ?? "—"}</dd>
            <dt style={{ color: "#9eabb5" }}>Avg frame</dt><dd data-testid="average-frame-ms" style={{ margin: 0, fontWeight: 800 }}>{stats ? `${stats.averageFrameMs} ms` : "—"}</dd>
            <dt style={{ color: "#9eabb5" }}>P95</dt><dd data-testid="p95-frame-ms" style={{ margin: 0, fontWeight: 800 }}>{stats ? `${stats.p95FrameMs} ms` : "—"}</dd>
          </dl>

          <div
            data-testid="runtime-smoke-verdict"
            style={{
              marginTop: "24px",
              borderTop: "1px solid #303c46",
              paddingTop: "18px",
              color: stats ? (smokePass ? "#78d69b" : "#ec7f79") : "#e9b65c",
              fontWeight: 900
            }}
          >
            {!stats ? "BENCHMARKING" : smokePass ? "SMOKE PASS" : "SMOKE BLOCKED"}
          </div>

          <p style={{ color: "#9eabb5", fontSize: "13px", lineHeight: 1.5 }}>
            Este benchmark apenas prova carregamento e estabilidade básica no navegador. Não promove a arte nem substitui o benchmark Web/mobile final do LOD0.
          </p>
        </aside>
      </div>

      <footer style={{ display: "flex", justifyContent: "space-between", gap: "20px", color: "#7f8d98", fontSize: "13px" }}>
        <span>GOLDEN_ASSET_CANDIDATE · visual approval pending</span>
        <span>Tehkné Solutions</span>
      </footer>
    </section>
  );
}
