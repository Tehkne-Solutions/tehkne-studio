"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Quaternion, Vector3 } from "three";
import type { EngineeringEntity } from "../../../packages/engineering-core/src/index";
import {
  ComponentRegistry,
  parseComponentCatalog,
  type ComponentDefinition
} from "../../../packages/component-library/src/index";
import { applyComponentCatalogExtension } from "../../../packages/component-library/src/extension";
import {
  applyComponentCatalogOverlay,
  type ComponentCatalogOverlay
} from "../../../packages/component-library/src/overlay";
import { EngineeringSession } from "../../../packages/engineering-session/src/index";
import {
  INVENTION_SPATIAL_BOUNDS,
  InventionSpatialScene,
  parseInventionSpatialDocument,
  type InventionSpatialConnectionSegment
} from "../../../packages/invention-spatial-runtime/src/index";
import {
  InventionBuilder,
  createBlankInventionProject,
  type InventionPortRef
} from "../../../packages/invention-runtime/src/index";
import {
  createSessionSnapshot,
  restoreSessionSnapshot
} from "../../../packages/persistence-runtime/src/index";
import type {
  SpatialEntityBinding,
  SpatialVector3
} from "../../../packages/spatial-runtime/src/index";
import componentCatalog from "../../../library/components/catalog.json";
import assetForgeExtension from "../../../library/components/extensions/asset-forge-v1.json";
import displaySystemExtension from "../../../library/components/extensions/display-system-v1.json";
import displaySystemOverlay from "../../../library/components/overlays/display-system-v1.json";
import notebookOverlay from "../../../library/components/overlays/notebook-v1.json";
import tabletOverlay from "../../../library/components/overlays/tablet-v1.json";
import {
  browserProjectExists,
  loadBrowserProject,
  saveBrowserProject
} from "../lib/projectPersistence";
import {
  AssetBackedComponent,
  visualAssetForEntity,
  type GltfVisualAssetDescriptor
} from "./InventionAssetVisual";
import styles from "./Invention3DWorkbench.module.css";

const baseCatalog = parseComponentCatalog(componentCatalog);
const notebookCatalog = applyComponentCatalogOverlay(baseCatalog, notebookOverlay as ComponentCatalogOverlay);
const tabletCatalog = applyComponentCatalogOverlay(notebookCatalog, tabletOverlay as ComponentCatalogOverlay);
const assetForgeCatalog = applyComponentCatalogExtension(tabletCatalog, assetForgeExtension);
const displayExtendedCatalog = applyComponentCatalogExtension(assetForgeCatalog, displaySystemExtension);
const expandedCatalog = applyComponentCatalogOverlay(displayExtendedCatalog, displaySystemOverlay as ComponentCatalogOverlay);
const registry = new ComponentRegistry(expandedCatalog);

const MOVE_STEP = 0.05;

type CameraPreset = "perspective" | "front" | "top";

interface RuntimeBundle {
  readonly session: EngineeringSession;
  readonly builder: InventionBuilder;
  readonly spatial: InventionSpatialScene;
}

interface PortOption {
  readonly key: string;
  readonly ref: InventionPortRef;
  readonly label: string;
}

function createRuntime(): RuntimeBundle {
  const session = new EngineeringSession(createBlankInventionProject());
  return {
    session,
    builder: new InventionBuilder(session, registry),
    spatial: new InventionSpatialScene(session)
  };
}

function restoreRuntime(): RuntimeBundle {
  const snapshot = loadBrowserProject("invention");
  if (!snapshot) throw new Error("Não existe projeto de invenção salvo.");
  const session = restoreSessionSnapshot(snapshot);
  const builder = new InventionBuilder(session, registry);
  const hasSpatialEvidence = Object.prototype.hasOwnProperty.call(snapshot.extensions, "inventionSpatial");
  const spatial = hasSpatialEvidence
    ? new InventionSpatialScene(session, parseInventionSpatialDocument(snapshot.extensions.inventionSpatial))
    : new InventionSpatialScene(session);
  if (!hasSpatialEvidence) {
    for (const entity of builder.components()) spatial.ensureComponent(entity.id);
  }
  return { session, builder, spatial };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function portKey(ref: InventionPortRef): string {
  return `${ref.entityId}::${ref.portId}`;
}

function parsePortKey(value: string): InventionPortRef | null {
  const [entityId, portId] = value.split("::");
  return entityId && portId ? { entityId, portId } : null;
}

function format(value: number): string {
  return value.toFixed(3);
}

function cameraPosition(preset: CameraPreset): [number, number, number] {
  if (preset === "front") return [0, 0.05, 1.25];
  if (preset === "top") return [0, 1.25, 0.02];
  return [0.9, 0.72, 1.05];
}

function CameraRig({ preset }: { readonly preset: CameraPreset }) {
  const { camera, invalidate } = useThree();
  useEffect(() => {
    const position = cameraPosition(preset);
    camera.position.set(...position);
    camera.up.set(0, 1, 0);
    if (preset === "top") camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0.06);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, preset]);
  return null;
}

function domainGeometry(domain: string) {
  if (domain === "energy" || domain === "power") return <cylinderGeometry args={[0.055, 0.055, 0.11, 18]} />;
  if (domain === "display") return <boxGeometry args={[0.16, 0.09, 0.018]} />;
  if (domain === "sensing") return <sphereGeometry args={[0.055, 18, 12]} />;
  if (domain === "actuation") return <cylinderGeometry args={[0.05, 0.05, 0.12, 18]} />;
  return <boxGeometry args={[0.12, 0.07, 0.055]} />;
}

function componentMaterial(domain: string, selected: boolean) {
  const color = selected
    ? "#d7d2bd"
    : domain === "energy" || domain === "power"
      ? "#756f61"
      : domain === "display"
        ? "#515b5d"
        : domain === "sensing"
          ? "#64645b"
          : "#5c605b";
  return <meshStandardMaterial color={color} metalness={0.42} roughness={0.52} />;
}

function ComponentProxy({
  entity,
  binding,
  selected,
  onSelect
}: {
  readonly entity: EngineeringEntity;
  readonly binding: SpatialEntityBinding;
  readonly selected: boolean;
  readonly onSelect: (entityId: string) => void;
}) {
  const domain = String(entity.metadata.componentDomain ?? "generic");
  return (
    <group
      position={[binding.position.x, binding.position.y, binding.position.z]}
      rotation={[binding.rotation.x, binding.rotation.y, binding.rotation.z]}
      scale={[binding.scale.x, binding.scale.y, binding.scale.z]}
      name={`invention-3d-${entity.id}`}
    >
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect(entity.id);
        }}
      >
        {domainGeometry(domain)}
        {componentMaterial(domain, selected)}
      </mesh>
      <mesh position={[0, -0.052, 0]}>
        <boxGeometry args={[0.15, 0.008, 0.08]} />
        <meshStandardMaterial color="#2c302d" metalness={0.15} roughness={0.8} />
      </mesh>
    </group>
  );
}

function AssetLoadingPlaceholder({
  entity,
  binding
}: {
  readonly entity: EngineeringEntity;
  readonly binding: SpatialEntityBinding;
}) {
  return (
    <group
      position={[binding.position.x, binding.position.y, binding.position.z]}
      rotation={[binding.rotation.x, binding.rotation.y, binding.rotation.z]}
      scale={[binding.scale.x, binding.scale.y, binding.scale.z]}
      name={`invention-3d-loading-${entity.id}`}
    >
      <mesh>
        <boxGeometry args={[0.06, 0.04, 0.08]} />
        <meshBasicMaterial color="#77786f" wireframe transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

function ComponentVisual({
  entity,
  binding,
  selected,
  onSelect
}: {
  readonly entity: EngineeringEntity;
  readonly binding: SpatialEntityBinding;
  readonly selected: boolean;
  readonly onSelect: (entityId: string) => void;
}) {
  const descriptor = visualAssetForEntity(entity);
  if (!descriptor) {
    return <ComponentProxy entity={entity} binding={binding} selected={selected} onSelect={onSelect} />;
  }
  return (
    <Suspense fallback={<AssetLoadingPlaceholder entity={entity} binding={binding} />}>
      <AssetBackedComponent
        entity={entity}
        binding={binding}
        descriptor={descriptor}
        selected={selected}
        onSelect={onSelect}
      />
    </Suspense>
  );
}

function ConnectionTube({ segment }: { readonly segment: InventionSpatialConnectionSegment }) {
  const start = useMemo(() => new Vector3(segment.source.x, segment.source.y, segment.source.z), [segment]);
  const end = useMemo(() => new Vector3(segment.target.x, segment.target.y, segment.target.z), [segment]);
  const delta = useMemo(() => end.clone().sub(start), [end, start]);
  const length = delta.length();
  const midpoint = useMemo(() => start.clone().add(end).multiplyScalar(0.5), [end, start]);
  const quaternion = useMemo(() => {
    if (length === 0) return new Quaternion();
    return new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.clone().normalize());
  }, [delta, length]);

  return (
    <mesh position={midpoint} quaternion={quaternion} name={`wire-${segment.relationshipId}`}>
      <cylinderGeometry args={[0.005, 0.005, Math.max(length, 0.001), 8]} />
      <meshStandardMaterial color="#aaa58f" metalness={0.2} roughness={0.65} />
    </mesh>
  );
}

function Scene({
  components,
  bindings,
  wires,
  selectedEntityId,
  cameraPreset,
  onSelect
}: {
  readonly components: readonly EngineeringEntity[];
  readonly bindings: readonly SpatialEntityBinding[];
  readonly wires: readonly InventionSpatialConnectionSegment[];
  readonly selectedEntityId: string | null;
  readonly cameraPreset: CameraPreset;
  readonly onSelect: (entityId: string) => void;
}) {
  const bindingMap = useMemo(() => new Map(bindings.map((binding) => [binding.entityId, binding])), [bindings]);
  return (
    <>
      <color attach="background" args={["#171916"]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[1.2, 1.8, 1.1]} intensity={2.5} />
      <directionalLight position={[-0.8, 0.4, 0.6]} intensity={0.75} />
      <gridHelper args={[1.4, 28, "#62665d", "#2b2e29"]} position={[0, -0.31, 0.08]} />
      <CameraRig preset={cameraPreset} />
      {wires.map((wire) => <ConnectionTube key={wire.relationshipId} segment={wire} />)}
      {components.map((entity) => {
        const binding = bindingMap.get(entity.id);
        if (!binding) return null;
        return (
          <ComponentVisual
            key={entity.id}
            entity={entity}
            binding={binding}
            selected={selectedEntityId === entity.id}
            onSelect={onSelect}
          />
        );
      })}
    </>
  );
}

function visualDescriptor(entity: EngineeringEntity | null): GltfVisualAssetDescriptor | null {
  return entity ? visualAssetForEntity(entity) : null;
}

export function Invention3DWorkbench() {
  const [open, setOpen] = useState(false);
  const [runtime, setRuntime] = useState<RuntimeBundle>(() => createRuntime());
  const [revision, setRevision] = useState(0);
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedDefinitionId, setSelectedDefinitionId] = useState(() => registry.list()[0]?.definitionId ?? "");
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [sourceKey, setSourceKey] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("perspective");
  const [message, setMessage] = useState("Bancada 3D pronta. O Engineering Graph continua sendo a fonte de verdade.");
  const [error, setError] = useState(false);

  useEffect(() => setSaved(browserProjectExists("invention")), []);

  const definitions = useMemo(() => registry.list(query.trim() ? { query } : {}), [query]);
  const selectedDefinition = definitions.find((definition) => definition.definitionId === selectedDefinitionId) ?? definitions[0] ?? null;
  const components = useMemo(() => runtime.builder.components(), [runtime, revision]);
  const connections = useMemo(() => runtime.builder.connections(), [runtime, revision]);
  const document = useMemo(() => runtime.builder.document(), [runtime, revision]);
  const bindings = useMemo(() => runtime.spatial.bindings(), [runtime, revision]);
  const wires = useMemo(() => runtime.spatial.connectionSegments(connections), [connections, runtime, revision]);
  const selectedEntity = selectedEntityId ? components.find((entity) => entity.id === selectedEntityId) ?? null : null;
  const selectedBinding = selectedEntityId ? bindings.find((binding) => binding.entityId === selectedEntityId) ?? null : null;
  const selectedVisual = visualDescriptor(selectedEntity);
  const assetBackedCount = components.reduce((count, entity) => count + (visualAssetForEntity(entity) ? 1 : 0), 0);
  const proxyCount = components.length - assetBackedCount;

  const sourceOptions = useMemo<readonly PortOption[]>(() => components.flatMap((entity) =>
    Object.values(entity.ports)
      .filter((port) => port.state === "available" && port.direction !== "in")
      .map((port) => ({
        key: portKey({ entityId: entity.id, portId: port.id }),
        ref: { entityId: entity.id, portId: port.id },
        label: `${entity.name} · ${port.id}`
      }))
  ), [components]);
  const sourceRef = parsePortKey(sourceKey);
  const compatibleTargetKeys = new Set((sourceRef ? runtime.builder.compatibleTargets(sourceRef) : []).map(portKey));
  const targetOptions = useMemo<readonly PortOption[]>(() => components.flatMap((entity) =>
    Object.values(entity.ports)
      .filter((port) => port.state === "available" && port.direction !== "out")
      .map((port) => ({
        key: portKey({ entityId: entity.id, portId: port.id }),
        ref: { entityId: entity.id, portId: port.id },
        label: `${entity.name} · ${port.id}`
      }))
  ).filter((option) => !sourceRef || compatibleTargetKeys.has(option.key)), [components, compatibleTargetKeys, sourceRef]);

  const changed = (nextMessage: string): void => {
    setMessage(nextMessage);
    setError(false);
    setRevision((current) => current + 1);
  };

  const blocked = (cause: unknown): void => {
    setError(true);
    setMessage(cause instanceof Error ? cause.message : "Operação 3D bloqueada.");
  };

  const openWorkbench = (): void => {
    try {
      if (browserProjectExists("invention")) {
        const restored = restoreRuntime();
        setRuntime(restored);
        setMessage(`Projeto salvo carregado no 3D · ${restored.builder.components().length} componentes · sem replay.`);
      }
      setSaved(browserProjectExists("invention"));
      setOpen(true);
      setError(false);
      setRevision((current) => current + 1);
    } catch (cause) {
      blocked(cause);
      setOpen(true);
    }
  };

  const newProject = (): void => {
    setRuntime(createRuntime());
    setSelectedEntityId(null);
    setSourceKey("");
    setTargetKey("");
    changed("Novo projeto 3D em branco criado. Nenhum preset foi materializado.");
  };

  const addSelected = (): void => {
    if (!selectedDefinition) return;
    try {
      const entity = runtime.builder.addComponent(selectedDefinition.definitionId);
      try {
        runtime.spatial.ensureComponent(entity.id);
      } catch (cause) {
        runtime.builder.removeComponent(entity.id);
        throw cause;
      }
      setSelectedEntityId(entity.id);
      const visual = visualAssetForEntity(entity);
      changed(`${entity.name} materializado na mesma Engineering Entity e binding espacial · ${visual ? `ASSET ${visual.assetId}` : "PROXY EXPLÍCITO"}.`);
    } catch (cause) {
      blocked(cause);
    }
  };

  const moveSelected = (axis: keyof SpatialVector3, delta: number): void => {
    if (!selectedEntityId || !selectedBinding) return;
    try {
      const { min, max } = INVENTION_SPATIAL_BOUNDS;
      const next: SpatialVector3 = {
        x: selectedBinding.position.x,
        y: selectedBinding.position.y,
        z: selectedBinding.position.z,
        [axis]: clamp(selectedBinding.position[axis] + delta, min[axis], max[axis])
      };
      const moved = runtime.spatial.move(selectedEntityId, next);
      changed(`Transform 3D · ${selectedEntity?.name ?? selectedEntityId} · x ${format(moved.position.x)} · y ${format(moved.position.y)} · z ${format(moved.position.z)}.`);
    } catch (cause) {
      blocked(cause);
    }
  };

  const connect = (): void => {
    const from = parsePortKey(sourceKey);
    const to = parsePortKey(targetKey);
    if (!from || !to) {
      blocked(new Error("Selecione origem e destino compatíveis."));
      return;
    }
    try {
      const connection = runtime.builder.connect(from, to);
      setSourceKey("");
      setTargetKey("");
      changed(`Wire 3D criado a partir da relação connectedTo · ${connection.sharedInterfaces.join(", ")}.`);
    } catch (cause) {
      blocked(cause);
    }
  };

  const save = (): void => {
    try {
      saveBrowserProject("invention", createSessionSnapshot(runtime.session, {
        extensions: {
          invention: runtime.builder.document(),
          inventionSpatial: runtime.spatial.document()
        }
      }));
      setSaved(true);
      changed(`Bancada 3D salva · ${components.length} componentes · ${connections.length} conexões · ${bindings.length} bindings · sem simulação implícita.`);
    } catch (cause) {
      blocked(cause);
    }
  };

  const restore = (): void => {
    try {
      const restored = restoreRuntime();
      setRuntime(restored);
      setSelectedEntityId(null);
      setSourceKey("");
      setTargetKey("");
      changed(`Bancada 3D restaurada · ${restored.builder.components().length} componentes · ${restored.builder.connections().length} conexões · sem replay.`);
    } catch (cause) {
      blocked(cause);
    }
  };

  return (
    <>
      <button type="button" className={styles.trigger} data-testid="invention-3d-trigger" onClick={openWorkbench}>
        3D INVENTION WORKBENCH
      </button>

      {open ? (
        <section className={styles.overlay} aria-label="3D Invention Workbench">
          <div className={styles.shell}>
            <header className={styles.header}>
              <div>
                <span>TEHKNÉ SOLUTIONS · S2.13</span>
                <strong>Asset-Backed 3D Invention Workbench</strong>
              </div>
              <div className={styles.actions}>
                <button type="button" onClick={newProject}>Novo projeto</button>
                <button type="button" onClick={save}>Guardar 3D</button>
                {saved ? <button type="button" onClick={restore}>Restaurar 3D</button> : null}
                <button type="button" onClick={() => setOpen(false)} aria-label="Fechar 3D Invention Workbench">Fechar</button>
              </div>
            </header>

            <div className={styles.status} data-testid="invention-3d-status" data-real-assets={assetBackedCount} data-proxies={proxyCount}>
              <strong>INVENTION 3D · {components.length} COMPONENTES · {connections.length} WIRES</strong>
              <span>MESMO ENGINEERING GRAPH · {bindings.length} BINDINGS · SIMULAÇÃO {document.simulationStatus.toUpperCase()}</span>
              <span>VISUAL · {assetBackedCount} REAL ASSET · {proxyCount} PROXY</span>
            </div>

            <div className={styles.body}>
              <aside className={styles.library}>
                <label>
                  Componente canônico
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="battery, regulator, motor, sensor..." />
                </label>
                <select
                  aria-label="Definição 3D"
                  value={selectedDefinition?.definitionId ?? ""}
                  onChange={(event) => setSelectedDefinitionId(event.target.value)}
                >
                  {definitions.map((definition: ComponentDefinition) => (
                    <option key={definition.definitionId} value={definition.definitionId}>{definition.name} · {definition.domain}</option>
                  ))}
                </select>
                <button type="button" onClick={addSelected} disabled={!selectedDefinition}>Adicionar ao 3D</button>

                <span>ENTIDADES</span>
                <div className={styles.entityList}>
                  {components.map((entity) => {
                    const visual = visualAssetForEntity(entity);
                    return (
                      <button
                        type="button"
                        key={entity.id}
                        data-selected={selectedEntityId === entity.id}
                        data-visual-source={visual ? "asset" : "proxy"}
                        onClick={() => setSelectedEntityId(runtime.spatial.select(entity.id).entity.id)}
                      >
                        <strong>{entity.name}</strong>
                        <small>{entity.id} · {visual ? "REAL ASSET" : "PROXY"}</small>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <main className={styles.viewport} data-testid="invention-3d-workbench">
                <div className={styles.cameraBar}>
                  <button type="button" onClick={() => setCameraPreset("perspective")} data-selected={cameraPreset === "perspective"}>Perspectiva</button>
                  <button type="button" onClick={() => setCameraPreset("front")} data-selected={cameraPreset === "front"}>Frontal</button>
                  <button type="button" onClick={() => setCameraPreset("top")} data-selected={cameraPreset === "top"}>Superior</button>
                </div>
                <Canvas
                  frameloop="demand"
                  camera={{ position: cameraPosition("perspective"), fov: 42, near: 0.01, far: 10 }}
                  dpr={1}
                  onPointerMissed={() => setSelectedEntityId(null)}
                >
                  <Scene
                    components={components}
                    bindings={bindings}
                    wires={wires}
                    selectedEntityId={selectedEntityId}
                    cameraPreset={cameraPreset}
                    onSelect={setSelectedEntityId}
                  />
                </Canvas>

                {components.length === 0 ? (
                  <div className={styles.empty}>
                    <strong>VOLUME DE INVENÇÃO VAZIO</strong>
                    <span>Adicione componentes canônicos para materializar a cena.</span>
                  </div>
                ) : null}
              </main>

              <aside className={styles.inspector}>
                <span>TRANSFORM 3D</span>
                {selectedEntity && selectedBinding ? (
                  <>
                    <div
                      className={styles.selected}
                      data-testid="invention-3d-selected"
                      data-x={format(selectedBinding.position.x)}
                      data-y={format(selectedBinding.position.y)}
                      data-z={format(selectedBinding.position.z)}
                    >
                      <strong>{selectedEntity.name}</strong>
                      <small>x {format(selectedBinding.position.x)} · y {format(selectedBinding.position.y)} · z {format(selectedBinding.position.z)}</small>
                    </div>
                    <div
                      className={styles.selected}
                      data-testid="invention-3d-visual-source"
                      data-source={selectedVisual ? "asset" : "proxy"}
                      data-asset-id={selectedVisual?.assetId ?? ""}
                      data-asset-version={selectedVisual?.version ?? ""}
                      data-asset-lod={selectedVisual?.lod ?? ""}
                    >
                      <strong>{selectedVisual ? "REAL ASSET" : "PROXY EXPLÍCITO"}</strong>
                      <small>{selectedVisual ? `${selectedVisual.assetId} · ${selectedVisual.version} · ${selectedVisual.lod}` : "Ainda sem arte Asset Forge cadastrada."}</small>
                    </div>
                    <div className={styles.axisGrid}>
                      <button type="button" onClick={() => moveSelected("x", -MOVE_STEP)}>X −</button>
                      <button type="button" onClick={() => moveSelected("x", MOVE_STEP)}>X +</button>
                      <button type="button" onClick={() => moveSelected("y", -MOVE_STEP)}>Y −</button>
                      <button type="button" onClick={() => moveSelected("y", MOVE_STEP)}>Y +</button>
                      <button type="button" onClick={() => moveSelected("z", -MOVE_STEP)}>Z −</button>
                      <button type="button" onClick={() => moveSelected("z", MOVE_STEP)}>Z +</button>
                    </div>
                  </>
                ) : <p>Selecione uma entidade na lista ou diretamente na viewport.</p>}

                <span>WIRING REAL</span>
                <label>
                  Origem
                  <select aria-label="Origem 3D" value={sourceKey} onChange={(event) => { setSourceKey(event.target.value); setTargetKey(""); }}>
                    <option value="">Selecione...</option>
                    {sourceOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                  </select>
                </label>
                <label>
                  Destino compatível
                  <select aria-label="Destino 3D" value={targetKey} onChange={(event) => setTargetKey(event.target.value)} disabled={!sourceRef}>
                    <option value="">Selecione...</option>
                    {targetOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                  </select>
                </label>
                <button type="button" onClick={connect} disabled={!sourceRef || !targetKey}>Conectar no 3D</button>

                <div className={styles.wireEvidence} aria-label="3D wire evidence">
                  {wires.map((wire) => (
                    <div
                      key={wire.relationshipId}
                      data-testid={`invention-3d-wire-${wire.relationshipId}`}
                      data-source-x={format(wire.source.x)}
                      data-source-y={format(wire.source.y)}
                      data-source-z={format(wire.source.z)}
                      data-target-x={format(wire.target.x)}
                      data-target-y={format(wire.target.y)}
                      data-target-z={format(wire.target.z)}
                    >
                      <strong>{wire.sharedInterfaces.join(" · ")}</strong>
                      <small>{wire.relationshipId}</small>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            runtime.builder.disconnect(wire.relationshipId);
                            changed(`${wire.relationshipId} desconectado do Engineering Graph e removido da viewport 3D.`);
                          } catch (cause) {
                            blocked(cause);
                          }
                        }}
                      >
                        Desconectar
                      </button>
                    </div>
                  ))}
                </div>
              </aside>
            </div>

            <div className={error ? styles.feedbackError : styles.feedback} data-testid="invention-3d-feedback">
              <strong>{error ? "BLOCKED" : "ENGINEERING STATE"}</strong>
              <span>{message}</span>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
