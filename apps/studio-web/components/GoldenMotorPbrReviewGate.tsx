"use client";

import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  ACESFilmicToneMapping,
  BufferGeometry,
  Group,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const MOTOR_URL = "/api/asset-forge/af001/motor/lod0";
const MAX_AVERAGE_FRAME_MS = 100;
const MAX_P95_FRAME_MS = 150;
const WARMUP_MS = 1_500;
const BENCHMARK_WINDOW_MS = 8_000;
const MAX_VALID_DELTA_MS = 1_000;
const MIN_BENCHMARK_SAMPLES = 30;

// AF-001 v0.6 replaced the v0.5 helper-pivot convention with explicit
// engineering sockets authored and QA-checked by the Blender DCC source.
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

type RuntimeStats = {
  readonly samples: number;
  readonly averageFrameMs: number;
  readonly p95FrameMs: number;
};

type AssetInspection = {
  readonly missingNodes: readonly string[];
  readonly sourceMeshCount: number;
  readonly renderMeshCount: number;
  readonly materialCount: number;
};

type MergeBucket = {
  readonly material: Material;
  readonly meshes: Mesh[];
  readonly geometries: BufferGeometry[];
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
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * ratio))] ?? 0;
}

function geometrySignature(geometry: BufferGeometry): string {
  const attributes = Object.entries(geometry.attributes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.normalized ? 1 : 0}`)
    .join("|");
  return `${geometry.index ? "indexed" : "non-indexed"}::${attributes}`;
}

function tuneMaterial(material: Material): void {
  if (!(material instanceof MeshStandardMaterial)) return;
  material.envMapIntensity = 0.75;
  material.needsUpdate = true;
}

function batchStaticMeshes(root: Object3D): AssetInspection {
  root.updateMatrixWorld(true);
  const rootInverse = new Matrix4().copy(root.matrixWorld).invert();
  const sourceMeshes: Mesh[] = [];
  const materials = new Set<string>();
  const buckets = new Map<string, MergeBucket>();
  const unbatchable: Mesh[] = [];

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    sourceMeshes.push(object);
    object.castShadow = false;
    object.receiveShadow = false;

    if (Array.isArray(object.material)) {
      unbatchable.push(object);
      for (const material of object.material) {
        tuneMaterial(material);
        materials.add(material.name || material.uuid);
      }
      return;
    }

    tuneMaterial(object.material);
    materials.add(object.material.name || object.material.uuid);

    const geometry = object.geometry.clone();
    const relativeMatrix = new Matrix4().multiplyMatrices(rootInverse, object.matrixWorld);
    geometry.applyMatrix4(relativeMatrix);
    const key = `${object.material.uuid}::${geometrySignature(geometry)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.meshes.push(object);
      bucket.geometries.push(geometry);
    } else {
      buckets.set(key, { material: object.material, meshes: [object], geometries: [geometry] });
    }
  });

  const runtimeGroup = new Group();
  runtimeGroup.name = "AF001_RUNTIME_MATERIAL_BATCHES";
  const renderMeshes: Mesh[] = [...unbatchable];
  let batchIndex = 0;

  for (const bucket of buckets.values()) {
    if (bucket.geometries.length < 2) {
      bucket.geometries[0]?.dispose();
      const source = bucket.meshes[0];
      if (source) renderMeshes.push(source);
      continue;
    }

    const merged = mergeGeometries(bucket.geometries, false);
    for (const geometry of bucket.geometries) geometry.dispose();
    if (!merged) {
      renderMeshes.push(...bucket.meshes);
      continue;
    }

    for (const source of bucket.meshes) source.visible = false;
    const batch = new Mesh(merged, bucket.material);
    batch.name = `AF001_RUNTIME_BATCH_${String(batchIndex).padStart(2, "0")}`;
    batch.castShadow = false;
    batch.receiveShadow = false;
    batch.frustumCulled = true;
    runtimeGroup.add(batch);
    renderMeshes.push(batch);
    batchIndex += 1;
  }

  root.add(runtimeGroup);
  root.updateMatrixWorld(true);

  return {
    missingNodes: REQUIRED_NODES.filter((name) => !root.getObjectByName(name)),
    sourceMeshCount: sourceMeshes.length,
    renderMeshCount: renderMeshes.filter((mesh) => mesh.visible).length,
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

function GoldenMotor({ onReady }: { readonly onReady: (inspection: AssetInspection) => void }) {
  const gltf = useLoader(GLTFLoader, MOTOR_URL);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useEffect(() => {
    onReady(batchStaticMeshes(scene));
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

function viewLabel(view: CameraView): string {
  if (view === "three-quarter") return "3/4";
  if (view === "front") return "Frontal";
  if (view === "side") return "Lateral";
  if (view === "rear") return "Traseira";
  if (view === "bearing") return "Eixo / bearing";
  return "Terminais";
}

export function GoldenMotorPbrReviewGate() {
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

      if (elapsed >= WARMUP_MS && delta > 0 && delta <= MAX_VALID_DELTA_MS) {
        // Slow frames remain evidence. Runtime batching reduces draw calls while
        // the benchmark policy and thresholds remain unchanged.
        samples.push(delta);
      }

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
      data-source-meshes={inspection?.sourceMeshCount ?? 0}
      data-render-meshes={inspection?.renderMeshCount ?? 0}
      data-render-policy="static-pbr-material-batched-no-realtime-shadow-map"
      style={{ minHeight: "100dvh", background: "#0b0e11", color: "#edf1f3", padding: 22, display: "grid", gap: 16, gridTemplateRows: "auto auto 1fr auto" }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", gap: 24, alignItems: "end", flexWrap: "wrap" }}>
        <div>
          <span style={{ color: "#82aeb1", fontWeight: 800, letterSpacing: ".16em", fontSize: 11 }}>TEHKNÉ SOLUTIONS · ASSET FORGE</span>
          <h1 style={{ margin: "8px 0 0", fontSize: "clamp(26px, 4vw, 42px)", letterSpacing: "-.03em" }}>AF-001I · LOD0 PBR Runtime Review</h1>
          <p style={{ color: "#9da7ae", margin: "8px 0 0", maxWidth: 820, lineHeight: 1.55 }}>
            Golden Motor Hero v0.6.5 · LOD0 real de 3.292 tris · batching runtime por material · PBR/UVs preservados · benchmark fail-closed.
          </p>
        </div>
        <div style={{ border: `1px solid ${runtimePass ? "#51765f" : "#62533a"}`, background: runtimePass ? "#142019" : "#201b14", padding: "10px 14px", borderRadius: 12, color: runtimePass ? "#8dc9a0" : stats ? "#e08378" : "#d6ae6c", fontWeight: 900 }}>
          {!stats ? "RUNTIME REVIEW EM EXECUÇÃO" : runtimePass ? "LOD0 RUNTIME PASS" : "LOD0 RUNTIME BLOCKED"}
        </div>
      </header>

      <nav aria-label="AF-001I camera views" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {(Object.keys(CAMERA_VIEWS) as CameraView[]).map((cameraView) => (
          <button key={cameraView} type="button" data-testid={`camera-view-${cameraView}`} aria-pressed={view === cameraView} onClick={() => setView(cameraView)} style={{ border: view === cameraView ? "1px solid #aab6bc" : "1px solid #364048", background: view === cameraView ? "#e1e6e8" : "#151a1f", color: view === cameraView ? "#12171b" : "#b5c0c6", borderRadius: 9, padding: "9px 12px", fontWeight: 800, cursor: "pointer" }}>
            {viewLabel(cameraView)}
          </button>
        ))}
      </nav>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 360px)", gap: 16, minHeight: 0 }}>
        <div data-testid="pbr-canvas-shell" data-camera-view={view} style={{ minHeight: 600, borderRadius: 18, overflow: "hidden", border: "1px solid #343d43", background: "#151a1e" }}>
          <Canvas camera={{ position: CAMERA_VIEWS["three-quarter"].position, fov: 30, near: 0.001, far: 5 }} dpr={1} gl={{ antialias: true, powerPreference: "high-performance", alpha: false }} onCreated={({ gl }) => { gl.outputColorSpace = SRGBColorSpace; gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}>
            <color attach="background" args={["#14181b"]} />
            <ambientLight intensity={0.42} />
            <directionalLight position={[0.075, 0.11, 0.075]} intensity={4.2} />
            <directionalLight position={[-0.065, 0.025, 0.055]} intensity={1.65} />
            <CameraRig view={view} />
            <Suspense fallback={<LoadingMotor />}><GoldenMotor onReady={markReady} /></Suspense>
            <mesh position={[0, -0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.24, 0.24]} /><meshStandardMaterial color="#22272b" metalness={0.06} roughness={0.88} /></mesh>
          </Canvas>
        </div>

        <aside style={{ border: "1px solid #343d43", borderRadius: 18, padding: 20, background: "#11161a" }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Gate técnico</h2>
          <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px 16px", margin: 0 }}>
            <dt>Asset</dt><dd style={{ margin: 0, fontWeight: 800 }}>TS_ELEC_MOTOR_DC_A</dd>
            <dt>LOD / tris</dt><dd style={{ margin: 0, fontWeight: 800 }}>LOD0 · 3.292</dd>
            <dt>Meshes fonte</dt><dd data-testid="mesh-count" style={{ margin: 0, fontWeight: 800 }}>{inspection?.sourceMeshCount ?? "—"}</dd>
            <dt>Meshes runtime</dt><dd data-testid="render-mesh-count" style={{ margin: 0, fontWeight: 800 }}>{inspection?.renderMeshCount ?? "—"}</dd>
            <dt>Materiais</dt><dd data-testid="material-count" style={{ margin: 0, fontWeight: 800 }}>{inspection?.materialCount ?? "—"}</dd>
            <dt>Nodes</dt><dd data-testid="node-gate-verdict" style={{ margin: 0, fontWeight: 900, color: nodeGatePass ? "#8dc9a0" : "#e08378" }}>{nodeGatePass ? "PASS" : runtimeReady ? "BLOCKED" : "WAIT"}</dd>
            <dt>Frames</dt><dd data-testid="benchmark-samples-i" style={{ margin: 0, fontWeight: 800 }}>{stats?.samples ?? "—"}</dd>
            <dt>Avg frame</dt><dd data-testid="average-frame-ms-i" style={{ margin: 0, fontWeight: 800 }}>{stats ? `${stats.averageFrameMs} ms` : "—"}</dd>
            <dt>P95</dt><dd data-testid="p95-frame-ms-i" style={{ margin: 0, fontWeight: 800 }}>{stats ? `${stats.p95FrameMs} ms` : "—"}</dd>
            <dt>Viewport</dt><dd data-testid="viewport-context" style={{ margin: 0, fontWeight: 700 }}>{viewportContext}</dd>
          </dl>
          <div data-testid="lod0-pbr-verdict" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #2c353b", color: stats ? runtimePass ? "#8dc9a0" : "#e08378" : "#d6ae6c", fontWeight: 900 }}>
            {!stats ? "BENCHMARKING" : runtimePass ? "LOD0 PBR RUNTIME PASS" : "LOD0 PBR RUNTIME BLOCKED"}
          </div>
          <p style={{ color: "#7f8a92", fontSize: 12, lineHeight: 1.55 }}>
            PASS exige ≥{MIN_BENCHMARK_SAMPLES} frames válidos, média &lt; {MAX_AVERAGE_FRAME_MS} ms e P95 &lt; {MAX_P95_FRAME_MS} ms. Batching é apenas otimização de draw calls; o GLB autorado e a promoção artística continuam separados.
          </p>
        </aside>
      </div>

      <footer style={{ display: "flex", justifyContent: "space-between", color: "#78848b", fontSize: 12 }}><span>HERO_CANDIDATE · material-batched static PBR · fail-closed</span><span>Tehkné Solutions</span></footer>
    </section>
  );
}
