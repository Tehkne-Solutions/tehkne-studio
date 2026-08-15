"use client";

import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  ACESFilmicToneMapping,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MOTOR_URL = "/api/asset-forge/af001/motor/lod0";
const MIN_BENCHMARK_SAMPLES = 30;
const MAX_AVERAGE_FRAME_MS = 100;
const MAX_P95_FRAME_MS = 150;
const WARMUP_MS = 1_500;
const BENCHMARK_WINDOW_MS = 8_000;
const MAX_VALID_DELTA_MS = 1_000;

const REQUIRED_NODES = [
  "BODY_CAN",
  "FRONT_CAP",
  "REAR_CAP",
  "SHAFT",
  "TERMINAL_POS",
  "TERMINAL_NEG",
  "SOCKET_MECH_AXIS_OUT",
  "SOCKET_MECH_MOUNT_FRONT",
  "SOCKET_ELEC_POWER_POS",
  "SOCKET_ELEC_POWER_NEG"
] as const;

type CameraView = "three-quarter" | "front" | "side" | "rear" | "bearing" | "terminals";
type RuntimeStats = { readonly samples: number; readonly averageFrameMs: number; readonly p95FrameMs: number };
type AssetInspection = {
  readonly missingNodes: readonly string[];
  readonly meshCount: number;
  readonly materialCount: number;
};

const CAMERA_VIEWS: Record<CameraView, { position: [number, number, number]; target: [number, number, number] }> = {
  "three-quarter": { position: [0.065, 0.045, 0.080], target: [0, 0, 0] },
  front: { position: [0, 0.004, 0.078], target: [0, 0, 0.012] },
  side: { position: [0.082, 0.004, 0.005], target: [0, 0, 0] },
  rear: { position: [0, 0.004, -0.078], target: [0, 0, -0.010] },
  bearing: { position: [0.022, 0.012, 0.050], target: [0, 0, 0.018] },
  terminals: { position: [0.020, -0.002, -0.050], target: [0, -0.002, -0.019] }
};

function percentile(values: readonly number[], ratio: number): number {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * ratio))] ?? 0;
}

function inspectAndTune(root: Object3D): AssetInspection {
  let meshCount = 0;
  const materials = new Set<string>();

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    meshCount += 1;

    // AF-001I is a static product-review surface. Re-rendering shadow maps on
    // every browser frame adds GPU cost without adding engineering evidence.
    object.castShadow = false;
    object.receiveShadow = false;

    const source = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of source) {
      if (!(material instanceof MeshStandardMaterial)) continue;
      material.envMapIntensity = 0.75;
      material.needsUpdate = true;
      materials.add(material.name || material.uuid);
    }
  });

  return {
    missingNodes: REQUIRED_NODES.filter((name) => !root.getObjectByName(name)),
    meshCount,
    materialCount: materials.size
  };
}

function CameraRig({ view }: { readonly view: CameraView }) {
  const { camera } = useThree();
  useEffect(() => {
    const preset = CAMERA_VIEWS[view];
    camera.position.set(...preset.position);
    camera.lookAt(...preset.target);
    camera.updateProjectionMatrix();
  }, [camera, view]);
  return null;
}

function Motor({ onReady }: { readonly onReady: (inspection: AssetInspection) => void }) {
  const gltf = useLoader(GLTFLoader, MOTOR_URL);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  useEffect(() => onReady(inspectAndTune(scene)), [onReady, scene]);
  return <primitive object={scene} />;
}

function LoadingMotor() {
  return (
    <mesh>
      <boxGeometry args={[0.024, 0.018, 0.030]} />
      <meshStandardMaterial color="#70777d" metalness={0.7} roughness={0.4} />
    </mesh>
  );
}

function label(view: CameraView): string {
  if (view === "three-quarter") return "3/4";
  if (view === "front") return "Frontal";
  if (view === "side") return "Lateral";
  if (view === "rear") return "Traseira";
  if (view === "bearing") return "Eixo / bearing";
  return "Terminais";
}

export function GoldenMotorPbrReviewGateV065ContractAligned() {
  const [view, setView] = useState<CameraView>("three-quarter");
  const [inspection, setInspection] = useState<AssetInspection | null>(null);
  const [stats, setStats] = useState<RuntimeStats | null>(null);
  const [viewportContext, setViewportContext] = useState("pending");
  const markReady = useCallback((next: AssetInspection) => setInspection(next), []);
  const runtimeReady = inspection !== null;
  const nodeGatePass = Boolean(inspection && inspection.missingNodes.length === 0);

  useEffect(() => {
    setViewportContext(`${window.innerWidth}×${window.innerHeight} @ ${window.devicePixelRatio.toFixed(2)}x`);
  }, []);

  useEffect(() => {
    if (!runtimeReady || !nodeGatePass || stats) return;
    let cancelled = false;
    const startedAt = performance.now();
    let previous = startedAt;
    const samples: number[] = [];

    const sample = (now: number) => {
      if (cancelled) return;
      const delta = now - previous;
      previous = now;
      const elapsed = now - startedAt;
      if (elapsed >= WARMUP_MS && delta > 0 && delta <= MAX_VALID_DELTA_MS) samples.push(delta);

      if (elapsed >= WARMUP_MS + BENCHMARK_WINDOW_MS) {
        const average = samples.length
          ? samples.reduce((sum, value) => sum + value, 0) / samples.length
          : Number.POSITIVE_INFINITY;
        setStats({
          samples: samples.length,
          averageFrameMs: Number(average.toFixed(2)),
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
  }, [nodeGatePass, runtimeReady, stats]);

  const benchmarkPass = Boolean(
    stats &&
      stats.samples >= MIN_BENCHMARK_SAMPLES &&
      stats.averageFrameMs < MAX_AVERAGE_FRAME_MS &&
      stats.p95FrameMs < MAX_P95_FRAME_MS
  );
  const runtimePass = Boolean(runtimeReady && nodeGatePass && benchmarkPass);

  return (
    <section
      aria-label="AF-001I Golden Motor LOD0 PBR Runtime Review"
      data-runtime-ready={runtimeReady ? "true" : "false"}
      data-benchmark-ready={stats ? "true" : "false"}
      data-node-gate={nodeGatePass ? "pass" : runtimeReady ? "blocked" : "pending"}
      data-render-policy="static-pbr-key-fill-no-realtime-shadow-map"
      style={{ minHeight: "100dvh", background: "#0b0e11", color: "#edf1f3", padding: 22, display: "grid", gap: 16, gridTemplateRows: "auto auto 1fr auto" }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", gap: 24, alignItems: "end", flexWrap: "wrap" }}>
        <div>
          <span style={{ color: "#82aeb1", fontWeight: 800, letterSpacing: ".16em", fontSize: 11 }}>TEHKNÉ SOLUTIONS · ASSET FORGE</span>
          <h1 style={{ margin: "8px 0 0", fontSize: "clamp(26px, 4vw, 42px)" }}>AF-001I · HERO v0.6.5 Runtime Review</h1>
          <p style={{ color: "#9da7ae", margin: "8px 0 0" }}>Golden Motor HERO_CANDIDATE · LOD0 real de 3.292 tris · PBR estático key+fill · contrato DCC e sockets oficiais alinhados.</p>
        </div>
        <strong style={{ color: stats ? (runtimePass ? "#8dc9a0" : "#e08378") : "#d6ae6c" }}>
          {!stats ? "RUNTIME REVIEW EM EXECUÇÃO" : runtimePass ? "LOD0 RUNTIME PASS" : "LOD0 RUNTIME BLOCKED"}
        </strong>
      </header>

      <nav aria-label="AF-001I camera views" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {(Object.keys(CAMERA_VIEWS) as CameraView[]).map((cameraView) => (
          <button
            key={cameraView}
            type="button"
            data-testid={`camera-view-${cameraView}`}
            aria-pressed={view === cameraView}
            onClick={() => setView(cameraView)}
            style={{ border: view === cameraView ? "1px solid #aab6bc" : "1px solid #364048", background: view === cameraView ? "#e1e6e8" : "#151a1f", color: view === cameraView ? "#12171b" : "#b5c0c6", borderRadius: 9, padding: "9px 12px", fontWeight: 800 }}
          >
            {label(cameraView)}
          </button>
        ))}
      </nav>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 360px)", gap: 16, minHeight: 0 }}>
        <div data-testid="pbr-canvas-shell" data-camera-view={view} style={{ minHeight: 600, borderRadius: 18, overflow: "hidden", border: "1px solid #343d43", background: "#151a1e" }}>
          <Canvas
            camera={{ position: CAMERA_VIEWS["three-quarter"].position, fov: 30, near: 0.001, far: 5 }}
            dpr={1}
            gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
            onCreated={({ gl }) => {
              gl.outputColorSpace = SRGBColorSpace;
              gl.toneMapping = ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.05;
            }}
          >
            <color attach="background" args={["#14181b"]} />
            <ambientLight intensity={0.42} />
            <directionalLight position={[0.075, 0.11, 0.075]} intensity={4.2} />
            <directionalLight position={[-0.065, 0.025, 0.055]} intensity={1.65} />
            <CameraRig view={view} />
            <Suspense fallback={<LoadingMotor />}><Motor onReady={markReady} /></Suspense>
            <mesh position={[0, -0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.24, 0.24]} />
              <meshStandardMaterial color="#22272b" metalness={0.06} roughness={0.88} />
            </mesh>
          </Canvas>
        </div>

        <aside style={{ border: "1px solid #343d43", borderRadius: 18, padding: 20, background: "#11161a" }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Gate técnico</h2>
          <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px 16px", margin: 0 }}>
            <dt>Asset</dt><dd style={{ margin: 0, fontWeight: 800 }}>TS_ELEC_MOTOR_DC_A</dd>
            <dt>LOD / tris</dt><dd style={{ margin: 0, fontWeight: 800 }}>LOD0 · 3.292</dd>
            <dt>Meshes</dt><dd data-testid="mesh-count" style={{ margin: 0, fontWeight: 800 }}>{inspection?.meshCount ?? "—"}</dd>
            <dt>Materiais</dt><dd data-testid="material-count" style={{ margin: 0, fontWeight: 800 }}>{inspection?.materialCount ?? "—"}</dd>
            <dt>Nodes</dt><dd data-testid="node-gate-verdict" style={{ margin: 0, fontWeight: 900 }}>{nodeGatePass ? "PASS" : runtimeReady ? "BLOCKED" : "WAIT"}</dd>
            <dt>Frames</dt><dd data-testid="benchmark-samples-i" style={{ margin: 0, fontWeight: 800 }}>{stats?.samples ?? "—"}</dd>
            <dt>Avg frame</dt><dd data-testid="average-frame-ms-i" style={{ margin: 0, fontWeight: 800 }}>{stats ? `${stats.averageFrameMs} ms` : "—"}</dd>
            <dt>P95</dt><dd data-testid="p95-frame-ms-i" style={{ margin: 0, fontWeight: 800 }}>{stats ? `${stats.p95FrameMs} ms` : "—"}</dd>
            <dt>Viewport</dt><dd data-testid="viewport-context" style={{ margin: 0, fontWeight: 700 }}>{viewportContext}</dd>
          </dl>
          <div data-testid="lod0-pbr-verdict" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #2c353b", color: stats ? (runtimePass ? "#8dc9a0" : "#e08378") : "#d6ae6c", fontWeight: 900 }}>
            {!stats ? "BENCHMARKING" : runtimePass ? "LOD0 PBR RUNTIME PASS" : "LOD0 PBR RUNTIME BLOCKED"}
          </div>
        </aside>
      </div>

      <footer style={{ display: "flex", justifyContent: "space-between", color: "#78848b", fontSize: 12 }}>
        <span>HERO_CANDIDATE · static PBR · fail-closed</span>
        <span>Tehkné Solutions</span>
      </footer>
    </section>
  );
}
