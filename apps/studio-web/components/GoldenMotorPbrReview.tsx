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
const REQUIRED_NODES = [
  "PIVOT_MAIN",
  "PIVOT_SHAFT",
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

const MAX_AVERAGE_FRAME_MS = 100;
const MAX_P95_FRAME_MS = 150;
const WARMUP_FRAMES = 30;
const BENCHMARK_SAMPLES = 180;

type CameraView = "three-quarter" | "front" | "side" | "rear" | "bearing" | "terminals";

interface RuntimeStats {
  readonly samples: number;
  readonly averageFrameMs: number;
  readonly p95FrameMs: number;
}

interface AssetInspection {
  readonly missingNodes: readonly string[];
  readonly meshCount: number;
  readonly materialCount: number;
}

const CAMERA_VIEWS: Record<CameraView, { position: [number, number, number]; target: [number, number, number] }> = {
  "three-quarter": { position: [0.065, 0.045, 0.080], target: [0, 0, 0] },
  front: { position: [0, 0.004, 0.078], target: [0, 0, 0.012] },
  side: { position: [0.082, 0.004, 0.005], target: [0, 0, 0] },
  rear: { position: [0, 0.004, -0.078], target: [0, 0, -0.010] },
  bearing: { position: [0.022, 0.012, 0.050], target: [0, 0, 0.018] },
  terminals: { position: [0.020, -0.002, -0.050], target: [0, -0.002, -0.019] }
};

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

function prepareScene(root: Object3D): AssetInspection {
  const materials = new Set<string>();
  let meshCount = 0;

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    meshCount += 1;
    object.castShadow = true;
    object.receiveShadow = true;

    const source = object.material;
    const list = Array.isArray(source) ? source : [source];

    for (const material of list) {
      if (material instanceof MeshStandardMaterial) {
        material.envMapIntensity = 0.75;
        material.needsUpdate = true;
        materials.add(material.name || material.uuid);
      }
    }
  });

  const missingNodes = REQUIRED_NODES.filter((nodeName) => !root.getObjectByName(nodeName));
  return {
    missingNodes,
    meshCount,
    materialCount: materials.size
  };
}

function GoldenMotorLod0({
  onReady
}: {
  readonly onReady: (inspection: AssetInspection) => void;
}) {
  const gltf = useLoader(GLTFLoader, MOTOR_URL);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useEffect(() => {
    onReady(prepareScene(scene));
  }, [onReady, scene]);

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

function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * ratio))] ?? 0;
}

function labelForView(view: CameraView): string {
  switch (view) {
    case "three-quarter": return "3/4";
    case "front": return "Frontal";
    case "side": return "Lateral";
    case "rear": return "Traseira";
    case "bearing": return "Eixo / bearing";
    case "terminals": return "Terminais";
  }
}

export function GoldenMotorPbrReview() {
  const [view, setView] = useState<CameraView>("three-quarter");
  const [inspection, setInspection] = useState<AssetInspection | null>(null);
  const [stats, setStats] = useState<RuntimeStats | null>(null);

  const markReady = useCallback((nextInspection: AssetInspection) => {
    setInspection(nextInspection);
  }, []);

  const runtimeReady = Boolean(inspection);
  const nodeGatePass = Boolean(inspection && inspection.missingNodes.length === 0);

  useEffect(() => {
    if (!runtimeReady || !nodeGatePass) return;

    let cancelled = false;
    let previous = performance.now();
    let warmup = 0;
    const samples: number[] = [];

    const sample = (now: number) => {
      if (cancelled) return;
      const delta = now - previous;
      previous = now;

      if (warmup < WARMUP_FRAMES) {
        warmup += 1;
      } else if (delta > 0 && delta < 250) {
        samples.push(delta);
      }

      if (samples.length >= BENCHMARK_SAMPLES) {
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
  }, [nodeGatePass, runtimeReady]);

  const benchmarkPass = Boolean(
    stats &&
    stats.averageFrameMs < MAX_AVERAGE_FRAME_MS &&
    stats.p95FrameMs < MAX_P95_FRAME_MS
  );
  const runtimePass = Boolean(runtimeReady && nodeGatePass && benchmarkPass);

  const viewportContext = typeof window === "undefined"
    ? "server"
    : `${window.innerWidth}×${window.innerHeight} @ ${window.devicePixelRatio.toFixed(2)}x`;

  return (
    <section
      aria-label="AF-001I Golden Motor LOD0 PBR Runtime Review"
      data-runtime-ready={runtimeReady ? "true" : "false"}
      data-benchmark-ready={stats ? "true" : "false"}
      data-node-gate={nodeGatePass ? "pass" : runtimeReady ? "blocked" : "pending"}
      style={{
        minHeight: "100dvh",
        background: "#0b0e11",
        color: "#edf1f3",
        padding: "22px",
        display: "grid",
        gap: "16px",
        gridTemplateRows: "auto auto 1fr auto"
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", gap: "24px", alignItems: "end", flexWrap: "wrap" }}>
        <div>
          <span style={{ color: "#82aeb1", fontWeight: 800, letterSpacing: ".16em", fontSize: "11px" }}>
            TEHKNÉ SOLUTIONS · ASSET FORGE
          </span>
          <h1 style={{ margin: "8px 0 0", fontSize: "clamp(26px, 4vw, 42px)", letterSpacing: "-.03em" }}>
            AF-001I · LOD0 PBR Runtime Review
          </h1>
          <p style={{ color: "#9da7ae", margin: "8px 0 0", maxWidth: "820px", lineHeight: 1.55 }}>
            Golden Motor Hero v0.5.1 · LOD0 real de 3.904 tris · iluminação de produto · closes técnicos · benchmark fail-closed.
          </p>
        </div>

        <div style={{
          border: `1px solid ${runtimePass ? "#51765f" : "#62533a"}`,
          background: runtimePass ? "#142019" : "#201b14",
          padding: "10px 14px",
          borderRadius: "12px",
          color: runtimePass ? "#8dc9a0" : "#d6ae6c",
          fontWeight: 900
        }}>
          {!stats ? "RUNTIME REVIEW EM EXECUÇÃO" : runtimePass ? "LOD0 RUNTIME PASS" : "LOD0 RUNTIME BLOCKED"}
        </div>
      </header>

      <nav
        aria-label="AF-001I camera views"
        style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}
      >
        {(Object.keys(CAMERA_VIEWS) as CameraView[]).map((cameraView) => (
          <button
            key={cameraView}
            type="button"
            data-testid={`camera-view-${cameraView}`}
            aria-pressed={view === cameraView}
            onClick={() => setView(cameraView)}
            style={{
              border: view === cameraView ? "1px solid #aab6bc" : "1px solid #364048",
              background: view === cameraView ? "#e1e6e8" : "#151a1f",
              color: view === cameraView ? "#12171b" : "#b5c0c6",
              borderRadius: "9px",
              padding: "9px 12px",
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            {labelForView(cameraView)}
          </button>
        ))}
      </nav>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 360px)", gap: "16px", minHeight: 0 }}>
        <div
          data-testid="pbr-canvas-shell"
          data-camera-view={view}
          style={{
            minHeight: "600px",
            borderRadius: "18px",
            overflow: "hidden",
            border: "1px solid #343d43",
            background: "#151a1e"
          }}
        >
          <Canvas
            camera={{ position: CAMERA_VIEWS["three-quarter"].position, fov: 30, near: 0.001, far: 5 }}
            dpr={[1, 1.5]}
            shadows
            gl={{ antialias: true, powerPreference: "high-performance" }}
            onCreated={({ gl }) => {
              gl.outputColorSpace = SRGBColorSpace;
              gl.toneMapping = ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.05;
            }}
          >
            <color attach="background" args={["#14181b"]} />
            <fog attach="fog" args={["#14181b", 0.16, 0.35]} />
            <ambientLight intensity={0.28} />
            <directionalLight
              position={[0.075, 0.11, 0.075]}
              intensity={4.2}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
            />
            <directionalLight position={[-0.065, 0.025, 0.055]} intensity={1.45} />
            <spotLight
              position={[0.0, 0.09, -0.075]}
              intensity={2.4}
              angle={0.62}
              penumbra={0.86}
              color="#d7e2e5"
            />
            <spotLight
              position={[-0.08, 0.02, -0.015]}
              intensity={1.0}
              angle={0.78}
              penumbra={0.9}
              color="#9aaeb0"
            />
            <CameraRig view={view} />
            <Suspense fallback={<LoadingMotor />}>
              <GoldenMotorLod0 onReady={markReady} />
            </Suspense>

            <mesh position={[0, -0.018, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[0.24, 0.24]} />
              <meshStandardMaterial color="#22272b" metalness={0.06} roughness={0.88} />
            </mesh>
            <mesh position={[0, 0.025, -0.085]} receiveShadow>
              <planeGeometry args={[0.24, 0.14]} />
              <meshStandardMaterial color="#181d21" metalness={0.02} roughness={0.94} />
            </mesh>
          </Canvas>
        </div>

        <aside style={{
          border: "1px solid #343d43",
          borderRadius: "18px",
          padding: "20px",
          background: "#11161a",
          alignSelf: "stretch"
        }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "18px" }}>Gate técnico</h2>
          <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px 16px", margin: 0 }}>
            <dt style={{ color: "#8e9aa2" }}>Asset</dt><dd style={{ margin: 0, fontWeight: 800 }}>TS_ELEC_MOTOR_DC_A</dd>
            <dt style={{ color: "#8e9aa2" }}>Versão</dt><dd style={{ margin: 0, fontWeight: 800 }}>v0.5.1</dd>
            <dt style={{ color: "#8e9aa2" }}>LOD</dt><dd style={{ margin: 0, fontWeight: 800 }}>LOD0</dd>
            <dt style={{ color: "#8e9aa2" }}>Triângulos</dt><dd style={{ margin: 0, fontWeight: 800 }}>3.904</dd>
            <dt style={{ color: "#8e9aa2" }}>Payload</dt><dd style={{ margin: 0, fontWeight: 800 }}>74.472 B</dd>
            <dt style={{ color: "#8e9aa2" }}>Meshes</dt><dd data-testid="mesh-count" style={{ margin: 0, fontWeight: 800 }}>{inspection?.meshCount ?? "—"}</dd>
            <dt style={{ color: "#8e9aa2" }}>Materiais</dt><dd data-testid="material-count" style={{ margin: 0, fontWeight: 800 }}>{inspection?.materialCount ?? "—"}</dd>
            <dt style={{ color: "#8e9aa2" }}>Nodes</dt>
            <dd data-testid="node-gate-verdict" style={{ margin: 0, fontWeight: 900, color: nodeGatePass ? "#8dc9a0" : runtimeReady ? "#e08378" : "#d6ae6c" }}>
              {nodeGatePass ? "PASS" : runtimeReady ? "BLOCKED" : "WAIT"}
            </dd>
            <dt style={{ color: "#8e9aa2" }}>Frames</dt><dd style={{ margin: 0, fontWeight: 800 }}>{stats?.samples ?? "—"}</dd>
            <dt style={{ color: "#8e9aa2" }}>Avg frame</dt><dd data-testid="average-frame-ms-i" style={{ margin: 0, fontWeight: 800 }}>{stats ? `${stats.averageFrameMs} ms` : "—"}</dd>
            <dt style={{ color: "#8e9aa2" }}>P95</dt><dd data-testid="p95-frame-ms-i" style={{ margin: 0, fontWeight: 800 }}>{stats ? `${stats.p95FrameMs} ms` : "—"}</dd>
            <dt style={{ color: "#8e9aa2" }}>Viewport</dt><dd data-testid="viewport-context" style={{ margin: 0, fontWeight: 700, textAlign: "right" }}>{viewportContext}</dd>
          </dl>

          {inspection && inspection.missingNodes.length > 0 && (
            <div data-testid="missing-nodes" style={{ marginTop: "16px", color: "#e08378", fontSize: "12px", lineHeight: 1.5 }}>
              {inspection.missingNodes.join(", ")}
            </div>
          )}

          <div style={{ borderTop: "1px solid #2c353b", marginTop: "20px", paddingTop: "18px" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: "15px" }}>Leitura material obrigatória</h3>
            <ul style={{ color: "#9ca7ae", paddingLeft: "18px", margin: 0, lineHeight: 1.7, fontSize: "13px" }}>
              <li>carcaça metálica estampada</li>
              <li>aço usinado do eixo / bearing</li>
              <li>polímero técnico traseiro</li>
              <li>cobre dos terminais</li>
              <li>isoladores elétricos</li>
              <li>badge Tehkné discreto</li>
            </ul>
          </div>

          <div
            data-testid="lod0-pbr-verdict"
            style={{
              marginTop: "20px",
              paddingTop: "16px",
              borderTop: "1px solid #2c353b",
              color: stats ? (runtimePass ? "#8dc9a0" : "#e08378") : "#d6ae6c",
              fontWeight: 900
            }}
          >
            {!stats ? "BENCHMARKING" : runtimePass ? "LOD0 PBR RUNTIME PASS" : "LOD0 PBR RUNTIME BLOCKED"}
          </div>

          <p style={{ color: "#7f8a92", fontSize: "12px", lineHeight: 1.55, marginBottom: 0 }}>
            PASS aqui valida import, nodes, iluminação e custo do LOD0. A promoção para GOLDEN_ASSET continua bloqueada por master DCC e aprovação visual humana final.
          </p>
        </aside>
      </div>

      <footer style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", color: "#78848b", fontSize: "12px" }}>
        <span>HERO_CANDIDATE · no glow · neutral product lighting · fail-closed</span>
        <span>Tehkné Solutions</span>
      </footer>
    </section>
  );
}
