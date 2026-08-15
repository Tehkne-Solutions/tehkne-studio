"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Quaternion, Vector3 } from "three";
import type { EngineeringEntity } from "../../../packages/engineering-core/src/index";
import { ComponentRegistry, parseComponentCatalog, type ComponentDefinition } from "../../../packages/component-library/src/index";
import { applyComponentCatalogExtension } from "../../../packages/component-library/src/extension";
import { applyComponentCatalogOverlay, type ComponentCatalogOverlay } from "../../../packages/component-library/src/overlay";
import { EngineeringSession } from "../../../packages/engineering-session/src/index";
import {
  coincidentFollowerPosition,
  deriveMechanicalAssemblyConstraints,
  endpointsAreCoincident,
  mechanicalAssemblyMembers,
  planMechanicalAssemblyRotation,
  planMechanicalAssemblyTranslation,
  type MechanicalAssemblyConstraint,
  type MechanicalRotationAxis
} from "../../../packages/invention-assembly-runtime/src/index";
import {
  INVENTION_SPATIAL_BOUNDS,
  InventionSpatialScene,
  parseInventionSpatialDocument,
  type InventionSpatialConnectionSegment
} from "../../../packages/invention-spatial-runtime/src/index";
import { InventionBuilder, createBlankInventionProject, type InventionPortRef } from "../../../packages/invention-runtime/src/index";
import { createSessionSnapshot, restoreSessionSnapshot } from "../../../packages/persistence-runtime/src/index";
import type { SpatialEntityBinding, SpatialVector3 } from "../../../packages/spatial-runtime/src/index";
import componentCatalog from "../../../library/components/catalog.json";
import assetForgeExtension from "../../../library/components/extensions/asset-forge-v1.json";
import displaySystemExtension from "../../../library/components/extensions/display-system-v1.json";
import mechanicalAssemblyExtension from "../../../library/components/extensions/mechanical-assembly-v1.json";
import displaySystemOverlay from "../../../library/components/overlays/display-system-v1.json";
import notebookOverlay from "../../../library/components/overlays/notebook-v1.json";
import tabletOverlay from "../../../library/components/overlays/tablet-v1.json";
import { browserProjectExists, loadBrowserProject, saveBrowserProject } from "../lib/projectPersistence";
import {
  AssetBackedComponent,
  spatialProxyForEntity,
  useSpatialPortEndpoint,
  visualAssetForEntity,
  type GltfVisualAssetDescriptor
} from "./InventionAssetVisual";
import styles from "./Invention3DWorkbench.module.css";

const baseCatalog = parseComponentCatalog(componentCatalog);
const notebookCatalog = applyComponentCatalogOverlay(baseCatalog, notebookOverlay as ComponentCatalogOverlay);
const tabletCatalog = applyComponentCatalogOverlay(notebookCatalog, tabletOverlay as ComponentCatalogOverlay);
const assetForgeCatalog = applyComponentCatalogExtension(tabletCatalog, assetForgeExtension);
const mechanicalCatalog = applyComponentCatalogExtension(assetForgeCatalog, mechanicalAssemblyExtension);
const displayExtendedCatalog = applyComponentCatalogExtension(mechanicalCatalog, displaySystemExtension);
const expandedCatalog = applyComponentCatalogOverlay(displayExtendedCatalog, displaySystemOverlay as ComponentCatalogOverlay);
const registry = new ComponentRegistry(expandedCatalog);
const MOVE_STEP = 0.05;
const ROTATE_STEP_RAD = Math.PI / 12;
type CameraPreset = "perspective" | "front" | "top";
interface RuntimeBundle { readonly session: EngineeringSession; readonly builder: InventionBuilder; readonly spatial: InventionSpatialScene; }
interface PortOption { readonly key: string; readonly ref: InventionPortRef; readonly label: string; }

function createRuntime(): RuntimeBundle {
  const session = new EngineeringSession(createBlankInventionProject());
  return { session, builder: new InventionBuilder(session, registry), spatial: new InventionSpatialScene(session) };
}
function restoreRuntime(): RuntimeBundle {
  const snapshot = loadBrowserProject("invention");
  if (!snapshot) throw new Error("Não existe projeto de invenção salvo.");
  const session = restoreSessionSnapshot(snapshot);
  const builder = new InventionBuilder(session, registry);
  const hasSpatialEvidence = Object.prototype.hasOwnProperty.call(snapshot.extensions, "inventionSpatial");
  const spatial = hasSpatialEvidence ? new InventionSpatialScene(session, parseInventionSpatialDocument(snapshot.extensions.inventionSpatial)) : new InventionSpatialScene(session);
  if (!hasSpatialEvidence) for (const entity of builder.components()) spatial.ensureComponent(entity.id);
  return { session, builder, spatial };
}
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function portKey(ref: InventionPortRef): string { return `${ref.entityId}::${ref.portId}`; }
function parsePortKey(value: string): InventionPortRef | null { const [entityId, portId] = value.split("::"); return entityId && portId ? { entityId, portId } : null; }
function format(value: number): string { return value.toFixed(3); }
function cameraPosition(preset: CameraPreset): [number, number, number] {
  if (preset === "front") return [0, 0.05, 1.25];
  if (preset === "top") return [0, 1.25, 0.02];
  return [0.9, 0.72, 1.05];
}
function CameraRig({ preset }: { readonly preset: CameraPreset }) {
  const { camera, invalidate } = useThree();
  useEffect(() => {
    const position = cameraPosition(preset); camera.position.set(...position); camera.up.set(0, 1, 0);
    if (preset === "top") camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0.06); camera.updateProjectionMatrix(); invalidate();
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
  const color = selected ? "#d7d2bd" : domain === "energy" || domain === "power" ? "#756f61" : domain === "display" ? "#515b5d" : domain === "sensing" ? "#64645b" : "#5c605b";
  return <meshStandardMaterial color={color} metalness={0.42} roughness={0.52} />;
}
function ProxyAnchorMarkers({ entity }: { readonly entity: EngineeringEntity }) {
  const proxy = spatialProxyForEntity(entity); if (!proxy) return null;
  return Object.entries(proxy.portAnchors).map(([portId, anchor]) => (
    <mesh key={portId} name={`proxy-port-anchor-${entity.id}-${portId}-${anchor.name}`} position={[anchor.position.x, anchor.position.y, anchor.position.z]}>
      <sphereGeometry args={[0.003, 10, 8]} /><meshStandardMaterial color="#d7d2bd" metalness={0.12} roughness={0.35} />
    </mesh>
  ));
}
function ComponentProxy({ entity, binding, selected, onSelect }: { readonly entity: EngineeringEntity; readonly binding: SpatialEntityBinding; readonly selected: boolean; readonly onSelect: (entityId: string) => void; }) {
  const domain = String(entity.metadata.componentDomain ?? "generic"); const proxy = spatialProxyForEntity(entity);
  const click = (event: { stopPropagation: () => void }) => { event.stopPropagation(); onSelect(entity.id); };
  return (
    <group position={[binding.position.x, binding.position.y, binding.position.z]} rotation={[binding.rotation.x, binding.rotation.y, binding.rotation.z]} scale={[binding.scale.x, binding.scale.y, binding.scale.z]} name={`invention-3d-${entity.id}`}>
      {proxy?.kind === "wheel" ? (
        <group onClick={click}>
          <mesh><torusGeometry args={[proxy.dimensionsM.radius ?? 0.0325, Math.max((proxy.dimensionsM.width ?? 0.018) * 0.42, 0.004), 12, 32]} /><meshStandardMaterial color={selected ? "#d7d2bd" : "#343733"} metalness={0.12} roughness={0.86} /></mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[proxy.dimensionsM.hubRadius ?? 0.006, proxy.dimensionsM.hubRadius ?? 0.006, proxy.dimensionsM.width ?? 0.018, 18]} /><meshStandardMaterial color="#6b6d65" metalness={0.62} roughness={0.42} /></mesh>
        </group>
      ) : proxy?.kind === "motor-bracket" ? (
        <group onClick={click}>
          <mesh position={[0, -0.014, 0]}><boxGeometry args={[proxy.dimensionsM.width ?? 0.038, proxy.dimensionsM.thickness ?? 0.002, proxy.dimensionsM.depth ?? 0.018]} /><meshStandardMaterial color={selected ? "#d7d2bd" : "#666961"} metalness={0.74} roughness={0.4} /></mesh>
          <mesh position={[-0.018, 0, 0]}><boxGeometry args={[proxy.dimensionsM.thickness ?? 0.002, proxy.dimensionsM.height ?? 0.032, proxy.dimensionsM.depth ?? 0.018]} /><meshStandardMaterial color="#666961" metalness={0.74} roughness={0.4} /></mesh>
          <mesh position={[0.018, 0, 0]}><boxGeometry args={[proxy.dimensionsM.thickness ?? 0.002, proxy.dimensionsM.height ?? 0.032, proxy.dimensionsM.depth ?? 0.018]} /><meshStandardMaterial color="#666961" metalness={0.74} roughness={0.4} /></mesh>
        </group>
      ) : (
        <><mesh onClick={click}>{domainGeometry(domain)}{componentMaterial(domain, selected)}</mesh><mesh position={[0, -0.052, 0]}><boxGeometry args={[0.15, 0.008, 0.08]} /><meshStandardMaterial color="#2c302d" metalness={0.15} roughness={0.8} /></mesh></>
      )}
      {selected ? <ProxyAnchorMarkers entity={entity} /> : null}
    </group>
  );
}
function AssetLoadingPlaceholder({ entity, binding }: { readonly entity: EngineeringEntity; readonly binding: SpatialEntityBinding; }) {
  return <group position={[binding.position.x, binding.position.y, binding.position.z]} rotation={[binding.rotation.x, binding.rotation.y, binding.rotation.z]} scale={[binding.scale.x, binding.scale.y, binding.scale.z]} name={`invention-3d-loading-${entity.id}`}><mesh><boxGeometry args={[0.06, 0.04, 0.08]} /><meshBasicMaterial color="#77786f" wireframe transparent opacity={0.45} /></mesh></group>;
}
function ComponentVisual({ entity, binding, selected, socketSourceKey, compatibleTargetKeys, onSelect, onSocketSelect }: {
  readonly entity: EngineeringEntity; readonly binding: SpatialEntityBinding; readonly selected: boolean; readonly socketSourceKey: string; readonly compatibleTargetKeys: ReadonlySet<string>;
  readonly onSelect: (entityId: string) => void; readonly onSocketSelect: (entityId: string, portId: string) => void;
}) {
  const descriptor = visualAssetForEntity(entity);
  if (!descriptor) return <ComponentProxy entity={entity} binding={binding} selected={selected} onSelect={onSelect} />;
  return <Suspense fallback={<AssetLoadingPlaceholder entity={entity} binding={binding} />}><AssetBackedComponent entity={entity} binding={binding} descriptor={descriptor} selected={selected} socketSourceKey={socketSourceKey} compatibleTargetKeys={compatibleTargetKeys} onSelect={onSelect} onSocketSelect={onSocketSelect} /></Suspense>;
}
function ConnectionTube({ segment, sourceEntity, targetEntity, sourceBinding, targetBinding }: {
  readonly segment: InventionSpatialConnectionSegment; readonly sourceEntity: EngineeringEntity; readonly targetEntity: EngineeringEntity; readonly sourceBinding: SpatialEntityBinding; readonly targetBinding: SpatialEntityBinding;
}) {
  const sourceEndpoint = useSpatialPortEndpoint(sourceEntity, sourceBinding, segment.sourcePortId);
  const targetEndpoint = useSpatialPortEndpoint(targetEntity, targetBinding, segment.targetPortId);
  const start = useMemo(() => new Vector3(sourceEndpoint.position.x, sourceEndpoint.position.y, sourceEndpoint.position.z), [sourceEndpoint.position.x, sourceEndpoint.position.y, sourceEndpoint.position.z]);
  const end = useMemo(() => new Vector3(targetEndpoint.position.x, targetEndpoint.position.y, targetEndpoint.position.z), [targetEndpoint.position.x, targetEndpoint.position.y, targetEndpoint.position.z]);
  const delta = useMemo(() => end.clone().sub(start), [end, start]); const length = delta.length();
  const midpoint = useMemo(() => start.clone().add(end).multiplyScalar(0.5), [end, start]);
  const quaternion = useMemo(() => length === 0 ? new Quaternion() : new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.clone().normalize()), [delta, length]);
  return <mesh position={midpoint} quaternion={quaternion} name={`wire-${segment.relationshipId}`} userData={{ sourcePortId: segment.sourcePortId, targetPortId: segment.targetPortId, sourceSocket: sourceEndpoint.socketName, targetSocket: targetEndpoint.socketName, sourceEndpointSource: sourceEndpoint.source, targetEndpointSource: targetEndpoint.source }}><cylinderGeometry args={[0.005, 0.005, Math.max(length, 0.001), 8]} /><meshStandardMaterial color="#aaa58f" metalness={0.2} roughness={0.65} /></mesh>;
}
function EndpointAwareWireEvidence({ wire, sourceEntity, targetEntity, sourceBinding, targetBinding, onDisconnect }: {
  readonly wire: InventionSpatialConnectionSegment; readonly sourceEntity: EngineeringEntity; readonly targetEntity: EngineeringEntity; readonly sourceBinding: SpatialEntityBinding; readonly targetBinding: SpatialEntityBinding; readonly onDisconnect: () => void;
}) {
  const sourceEndpoint = useSpatialPortEndpoint(sourceEntity, sourceBinding, wire.sourcePortId);
  const targetEndpoint = useSpatialPortEndpoint(targetEntity, targetBinding, wire.targetPortId);
  const socketAware = sourceEndpoint.source !== "center-fallback" || targetEndpoint.source !== "center-fallback";
  const mechanical = wire.sharedInterfaces.some((token) => token.startsWith("mechanical."));
  return <div data-testid={`invention-3d-wire-${wire.relationshipId}`} data-source-port={wire.sourcePortId} data-target-port={wire.targetPortId} data-source-socket={sourceEndpoint.socketName} data-target-socket={targetEndpoint.socketName} data-source-endpoint-source={sourceEndpoint.source} data-target-endpoint-source={targetEndpoint.source} data-socket-aware={socketAware ? "true" : "false"} data-mechanical={mechanical ? "true" : "false"} data-source-x={format(sourceEndpoint.position.x)} data-source-y={format(sourceEndpoint.position.y)} data-source-z={format(sourceEndpoint.position.z)} data-target-x={format(targetEndpoint.position.x)} data-target-y={format(targetEndpoint.position.y)} data-target-z={format(targetEndpoint.position.z)}>
    <strong>{wire.sharedInterfaces.join(" · ")}</strong><small>{wire.relationshipId} · {wire.sourcePortId} → {wire.targetPortId}{` · ${sourceEndpoint.source.toUpperCase()} ${sourceEndpoint.socketName || "CENTER"} → ${targetEndpoint.source.toUpperCase()} ${targetEndpoint.socketName || "CENTER"}`}</small><button type="button" onClick={onDisconnect}>Desconectar</button>
  </div>;
}
function MechanicalConstraintSynchronizer({ constraint, sourceEntity, targetEntity, sourceBinding, targetBinding, spatial, onSnapped, onBlocked }: {
  readonly constraint: MechanicalAssemblyConstraint; readonly sourceEntity: EngineeringEntity; readonly targetEntity: EngineeringEntity; readonly sourceBinding: SpatialEntityBinding; readonly targetBinding: SpatialEntityBinding; readonly spatial: InventionSpatialScene;
  readonly onSnapped: (constraint: MechanicalAssemblyConstraint) => void; readonly onBlocked: (constraint: MechanicalAssemblyConstraint, cause: unknown) => void;
}) {
  const driverEndpoint = useSpatialPortEndpoint(sourceEntity, sourceBinding, constraint.driver.portId);
  const followerEndpoint = useSpatialPortEndpoint(targetEntity, targetBinding, constraint.follower.portId);
  const resolved = driverEndpoint.source !== "center-fallback" && followerEndpoint.source !== "center-fallback";
  const coincident = resolved && endpointsAreCoincident(driverEndpoint.position, followerEndpoint.position);
  useEffect(() => {
    if (!resolved || coincident) return;
    try { spatial.move(constraint.follower.entityId, coincidentFollowerPosition(driverEndpoint.position, followerEndpoint.position, targetBinding)); onSnapped(constraint); }
    catch (cause) { onBlocked(constraint, cause); }
  }, [coincident, constraint.follower.entityId, constraint.relationshipId, driverEndpoint.position.x, driverEndpoint.position.y, driverEndpoint.position.z, followerEndpoint.position.x, followerEndpoint.position.y, followerEndpoint.position.z, resolved, spatial, targetBinding.position.x, targetBinding.position.y, targetBinding.position.z]);
  return <div data-testid={`mechanical-constraint-${constraint.relationshipId}`} data-state={!resolved ? "waiting" : coincident ? "snapped" : "aligning"} data-driver-entity={constraint.driver.entityId} data-driver-port={constraint.driver.portId} data-driver-endpoint={driverEndpoint.socketName} data-driver-endpoint-source={driverEndpoint.source} data-follower-entity={constraint.follower.entityId} data-follower-port={constraint.follower.portId} data-follower-endpoint={followerEndpoint.socketName} data-follower-endpoint-source={followerEndpoint.source} data-driver-x={format(driverEndpoint.position.x)} data-driver-y={format(driverEndpoint.position.y)} data-driver-z={format(driverEndpoint.position.z)} data-follower-x={format(followerEndpoint.position.x)} data-follower-y={format(followerEndpoint.position.y)} data-follower-z={format(followerEndpoint.position.z)}><strong>ASSEMBLY · {constraint.sharedInterfaces.join(" · ")}</strong><small>{constraint.driver.portId} → {constraint.follower.portId} · {resolved ? (coincident ? "SNAPPED" : "ALIGNING") : "WAITING FOR PHYSICAL ENDPOINT"}</small></div>;
}
function Scene({ components, bindings, wires, selectedEntityId, socketSourceKey, compatibleTargetKeys, cameraPreset, onSelect, onSocketSelect }: {
  readonly components: readonly EngineeringEntity[]; readonly bindings: readonly SpatialEntityBinding[]; readonly wires: readonly InventionSpatialConnectionSegment[]; readonly selectedEntityId: string | null; readonly socketSourceKey: string; readonly compatibleTargetKeys: ReadonlySet<string>; readonly cameraPreset: CameraPreset; readonly onSelect: (entityId: string) => void; readonly onSocketSelect: (entityId: string, portId: string) => void;
}) {
  const bindingMap = useMemo(() => new Map(bindings.map((binding) => [binding.entityId, binding])), [bindings]);
  const componentMap = useMemo(() => new Map(components.map((entity) => [entity.id, entity])), [components]);
  return <><color attach="background" args={["#171916"]} /><ambientLight intensity={0.8} /><directionalLight position={[1.2, 1.8, 1.1]} intensity={2.5} /><directionalLight position={[-0.8, 0.4, 0.6]} intensity={0.75} /><gridHelper args={[1.4, 28, "#62665d", "#2b2e29"]} position={[0, -0.31, 0.08]} /><CameraRig preset={cameraPreset} />
    {wires.map((wire) => { const sourceEntity = componentMap.get(wire.sourceEntityId); const targetEntity = componentMap.get(wire.targetEntityId); const sourceBinding = bindingMap.get(wire.sourceEntityId); const targetBinding = bindingMap.get(wire.targetEntityId); if (!sourceEntity || !targetEntity || !sourceBinding || !targetBinding) return null; return <ConnectionTube key={wire.relationshipId} segment={wire} sourceEntity={sourceEntity} targetEntity={targetEntity} sourceBinding={sourceBinding} targetBinding={targetBinding} />; })}
    {components.map((entity) => { const binding = bindingMap.get(entity.id); if (!binding) return null; return <ComponentVisual key={entity.id} entity={entity} binding={binding} selected={selectedEntityId === entity.id} socketSourceKey={socketSourceKey} compatibleTargetKeys={compatibleTargetKeys} onSelect={onSelect} onSocketSelect={onSocketSelect} />; })}
  </>;
}
function visualDescriptor(entity: EngineeringEntity | null): GltfVisualAssetDescriptor | null { return entity ? visualAssetForEntity(entity) : null; }
function physicalEndpointDeclared(entity: EngineeringEntity, portId: string): boolean { return Boolean(visualAssetForEntity(entity)?.portSocketMap[portId] || spatialProxyForEntity(entity)?.portAnchors[portId]); }

export function Invention3DWorkbench() {
  const [open, setOpen] = useState(false); const [runtime, setRuntime] = useState<RuntimeBundle>(() => createRuntime()); const [revision, setRevision] = useState(0); const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState(""); const [selectedDefinitionId, setSelectedDefinitionId] = useState(() => registry.list()[0]?.definitionId ?? ""); const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [sourceKey, setSourceKey] = useState(""); const [targetKey, setTargetKey] = useState(""); const [cameraPreset, setCameraPreset] = useState<CameraPreset>("perspective");
  const [message, setMessage] = useState("Bancada 3D pronta. O Engineering Graph continua sendo a fonte de verdade."); const [error, setError] = useState(false);
  useEffect(() => setSaved(browserProjectExists("invention")), []);
  const definitions = useMemo(() => registry.list(query.trim() ? { query } : {}), [query]);
  const selectedDefinition = definitions.find((definition) => definition.definitionId === selectedDefinitionId) ?? definitions[0] ?? null;
  const components = useMemo(() => runtime.builder.components(), [runtime, revision]); const connections = useMemo(() => runtime.builder.connections(), [runtime, revision]); const document = useMemo(() => runtime.builder.document(), [runtime, revision]);
  const bindings = useMemo(() => runtime.spatial.bindings(), [runtime, revision]); const wires = useMemo(() => runtime.spatial.connectionSegments(connections), [connections, runtime, revision]);
  const mechanicalConstraints = useMemo(() => deriveMechanicalAssemblyConstraints(runtime.session, connections), [connections, runtime, revision]);
  const selectedEntity = selectedEntityId ? components.find((entity) => entity.id === selectedEntityId) ?? null : null; const selectedBinding = selectedEntityId ? bindings.find((binding) => binding.entityId === selectedEntityId) ?? null : null;
  const selectedVisual = visualDescriptor(selectedEntity); const selectedProxy = selectedEntity ? spatialProxyForEntity(selectedEntity) : null;
  const assetBackedCount = components.reduce((count, entity) => count + (visualAssetForEntity(entity) ? 1 : 0), 0); const proxyCount = components.length - assetBackedCount;
  const componentMap = useMemo(() => new Map(components.map((entity) => [entity.id, entity])), [components]); const bindingMap = useMemo(() => new Map(bindings.map((binding) => [binding.entityId, binding])), [bindings]);
  const socketAwareWireCount = wires.reduce((count, wire) => { const source = componentMap.get(wire.sourceEntityId); const target = componentMap.get(wire.targetEntityId); return count + ((source && physicalEndpointDeclared(source, wire.sourcePortId)) || (target && physicalEndpointDeclared(target, wire.targetPortId)) ? 1 : 0); }, 0);
  const sourceOptions = useMemo<readonly PortOption[]>(() => components.flatMap((entity) => Object.values(entity.ports).filter((port) => port.state === "available" && port.direction !== "in").map((port) => ({ key: portKey({ entityId: entity.id, portId: port.id }), ref: { entityId: entity.id, portId: port.id }, label: `${entity.name} · ${port.id}` }))), [components]);
  const sourceRef = parsePortKey(sourceKey);
  const compatibleTargetKeys = useMemo(() => { const from = parsePortKey(sourceKey); return new Set((from ? runtime.builder.compatibleTargets(from) : []).map(portKey)); }, [runtime, revision, sourceKey]);
  const targetOptions = useMemo<readonly PortOption[]>(() => components.flatMap((entity) => Object.values(entity.ports).filter((port) => port.state === "available" && port.direction !== "out").map((port) => ({ key: portKey({ entityId: entity.id, portId: port.id }), ref: { entityId: entity.id, portId: port.id }, label: `${entity.name} · ${port.id}` }))).filter((option) => !sourceKey || compatibleTargetKeys.has(option.key)), [components, compatibleTargetKeys, sourceKey]);
  const changed = (nextMessage: string): void => { setMessage(nextMessage); setError(false); setRevision((current) => current + 1); };
  const blocked = (cause: unknown): void => { setError(true); setMessage(cause instanceof Error ? cause.message : "Operação 3D bloqueada."); };
  const openWorkbench = (): void => { try { if (browserProjectExists("invention")) { const restored = restoreRuntime(); setRuntime(restored); setMessage(`Projeto salvo carregado no 3D · ${restored.builder.components().length} componentes · sem replay.`); } setSaved(browserProjectExists("invention")); setOpen(true); setError(false); setRevision((current) => current + 1); } catch (cause) { blocked(cause); setOpen(true); } };
  const newProject = (): void => { setRuntime(createRuntime()); setSelectedEntityId(null); setSourceKey(""); setTargetKey(""); changed("Novo projeto 3D em branco criado. Nenhum preset foi materializado."); };
  const addSelected = (): void => { if (!selectedDefinition) return; try { const entity = runtime.builder.addComponent(selectedDefinition.definitionId); try { runtime.spatial.ensureComponent(entity.id); } catch (cause) { runtime.builder.removeComponent(entity.id); throw cause; } setSelectedEntityId(entity.id); const visual = visualAssetForEntity(entity); const proxy = spatialProxyForEntity(entity); changed(`${entity.name} materializado na mesma Engineering Entity e binding espacial · ${visual ? `ASSET ${visual.assetId}` : proxy ? `PROXY ${proxy.kind}` : "PROXY EXPLÍCITO"}.`); } catch (cause) { blocked(cause); } };
  const moveSelected = (axis: keyof SpatialVector3, requestedDelta: number): void => {
    if (!selectedEntityId || !selectedBinding) return;
    try {
      const { min, max } = INVENTION_SPATIAL_BOUNDS; const clamped = clamp(selectedBinding.position[axis] + requestedDelta, min[axis], max[axis]); const deltaValue = clamped - selectedBinding.position[axis];
      const delta: SpatialVector3 = { x: 0, y: 0, z: 0, [axis]: deltaValue }; const members = mechanicalAssemblyMembers(mechanicalConstraints, selectedEntityId); const plan = planMechanicalAssemblyTranslation(bindings, members, delta);
      for (const move of plan) runtime.spatial.move(move.entityId, move.to);
      const moved = runtime.spatial.binding(selectedEntityId); changed(`Transform 3D · ${selectedEntity?.name ?? selectedEntityId} · x ${format(moved.position.x)} · y ${format(moved.position.y)} · z ${format(moved.position.z)} · assembly ${members.length} peça(s).`);
    } catch (cause) { blocked(cause); }
  };
  const rotateSelected = (axis: MechanicalRotationAxis, radians: number): void => {
    if (!selectedEntityId || !selectedBinding) return;
    try {
      const members = mechanicalAssemblyMembers(mechanicalConstraints, selectedEntityId);
      const plan = planMechanicalAssemblyRotation(bindings, members, selectedEntityId, axis, radians);
      for (const entry of plan) {
        runtime.spatial.move(entry.entityId, entry.toPosition);
        runtime.spatial.rotate(entry.entityId, entry.toRotation);
      }
      const rotated = runtime.spatial.binding(selectedEntityId);
      changed(`Rotate 3D · ${selectedEntity?.name ?? selectedEntityId} · rx ${format(rotated.rotation.x)} · ry ${format(rotated.rotation.y)} · rz ${format(rotated.rotation.z)} · pivot ${selectedEntityId} · assembly ${members.length} peça(s).`);
    } catch (cause) { blocked(cause); }
  };
  const validateMechanicalConnection = (from: InventionPortRef, to: InventionPortRef): boolean => {
    const sourceEntity = componentMap.get(from.entityId); const targetEntity = componentMap.get(to.entityId); if (!sourceEntity || !targetEntity) throw new Error("Componentes da conexão não estão materializados.");
    const sourcePort = sourceEntity.ports[from.portId]; const targetPort = targetEntity.ports[to.portId]; if (!sourcePort || !targetPort) throw new Error("Portas da conexão não existem mais.");
    const mechanical = sourcePort.kind === "mechanical" || targetPort.kind === "mechanical";
    if (mechanical) {
      if (sourcePort.kind !== "mechanical" || targetPort.kind !== "mechanical") throw new Error("Montagem mecânica exige duas portas mecânicas.");
      if (!physicalEndpointDeclared(sourceEntity, from.portId) || !physicalEndpointDeclared(targetEntity, to.portId)) throw new Error("Montagem mecânica bloqueada: ambas as portas precisam de socket Asset Forge ou âncora proxy explícita.");
    }
    return mechanical;
  };
  const connect = (): void => {
    const from = parsePortKey(sourceKey); const to = parsePortKey(targetKey); if (!from || !to) { blocked(new Error("Selecione origem e destino compatíveis.")); return; }
    try { const mechanical = validateMechanicalConnection(from, to); const connection = runtime.builder.connect(from, to); setSourceKey(""); setTargetKey(""); changed(`${mechanical ? "Assembly constraint" : "Wire 3D"} criado a partir da relação connectedTo · ${connection.sharedInterfaces.join(", ")} · mesma topologia autoritativa.`); } catch (cause) { blocked(cause); }
  };
  const selectSocket = (entityId: string, portId: string): void => {
    const ref: InventionPortRef = { entityId, portId }; const key = portKey(ref); const entity = components.find((candidate) => candidate.id === entityId); const port = entity?.ports[portId];
    if (!entity || !port) { blocked(new Error(`Socket de autoria desconhecido: ${key}`)); return; }
    if (port.state !== "available") { blocked(new Error(`Socket já ocupado ou indisponível: ${key}`)); return; }
    if (!sourceRef) { if (port.direction === "in") { blocked(new Error(`Socket somente de entrada não pode iniciar um wire: ${key}`)); return; } setSelectedEntityId(entityId); setSourceKey(key); setTargetKey(""); setError(false); setMessage(`Socket origem armado · ${entity.name} · ${portId}. Selecione um socket compatível em outro componente.`); return; }
    if (key === sourceKey) { setSourceKey(""); setTargetKey(""); setError(false); setMessage(`Autoria por socket cancelada · ${entity.name} · ${portId}.`); return; }
    if (!compatibleTargetKeys.has(key)) { blocked(new Error(`Socket incompatível com a origem armada: ${sourceKey} → ${key}`)); return; }
    try { const mechanical = validateMechanicalConnection(sourceRef, ref); const connection = runtime.builder.connect(sourceRef, ref); setSelectedEntityId(entityId); setSourceKey(""); setTargetKey(""); changed(`${mechanical ? "Assembly criado diretamente por sockets" : "Wire criado diretamente por sockets"} · ${connection.id} · ${connection.sharedInterfaces.join(", ")} · Engineering Graph permanece autoritativo.`); } catch (cause) { blocked(cause); }
  };
  const save = (): void => { try { saveBrowserProject("invention", createSessionSnapshot(runtime.session, { extensions: { invention: runtime.builder.document(), inventionSpatial: runtime.spatial.document() } })); setSaved(true); changed(`Bancada 3D salva · ${components.length} componentes · ${connections.length} conexões · ${bindings.length} bindings · ${mechanicalConstraints.length} constraints derivadas · sem simulação implícita.`); } catch (cause) { blocked(cause); } };
  const restore = (): void => { try { const restored = restoreRuntime(); setRuntime(restored); setSelectedEntityId(null); setSourceKey(""); setTargetKey(""); changed(`Bancada 3D restaurada · ${restored.builder.components().length} componentes · ${restored.builder.connections().length} conexões · sem replay.`); } catch (cause) { blocked(cause); } };
  const assemblySnapped = (constraint: MechanicalAssemblyConstraint): void => { setMessage(`Assembly ${constraint.relationshipId} encaixado por endpoints físicos · ${constraint.sharedInterfaces.join(", ")} · constraint derivada do Engineering Graph.`); setError(false); setRevision((current) => current + 1); };
  const assemblyBlocked = (constraint: MechanicalAssemblyConstraint, cause: unknown): void => { try { runtime.builder.disconnect(constraint.relationshipId); } catch {} setError(true); setMessage(cause instanceof Error ? `Assembly ${constraint.relationshipId} bloqueado: ${cause.message}` : `Assembly ${constraint.relationshipId} bloqueado.`); setRevision((current) => current + 1); };

  return <><button type="button" className={styles.trigger} data-testid="invention-3d-trigger" onClick={openWorkbench}>3D INVENTION WORKBENCH</button>
    {open ? <section className={styles.overlay} aria-label="3D Invention Workbench"><div className={styles.shell}>
      <header className={styles.header}><div><span>TEHKNÉ SOLUTIONS · S2.17</span><strong>Rigid Assembly Rotation · Mechanical Assembly · Direct Socket Wiring · 3D Invention Workbench</strong></div><div className={styles.actions}><button type="button" onClick={newProject}>Novo projeto</button><button type="button" onClick={save}>Guardar 3D</button>{saved ? <button type="button" onClick={restore}>Restaurar 3D</button> : null}<button type="button" onClick={() => setOpen(false)} aria-label="Fechar 3D Invention Workbench">Fechar</button></div></header>
      <div className={styles.status} data-testid="invention-3d-status" data-real-assets={assetBackedCount} data-proxies={proxyCount} data-socket-aware-wires={socketAwareWireCount} data-direct-socket-mode={sourceRef ? "armed" : "idle"} data-direct-socket-source={sourceKey} data-mechanical-assemblies={mechanicalConstraints.length} data-rigid-assembly-rotation="enabled">
        <strong>INVENTION 3D · {components.length} COMPONENTES · {connections.length} RELAÇÕES</strong><span>MESMO ENGINEERING GRAPH · {bindings.length} BINDINGS · SIMULAÇÃO {document.simulationStatus.toUpperCase()}</span><span>VISUAL · {assetBackedCount} REAL ASSET · {proxyCount} PROXY · {socketAwareWireCount} SOCKET-AWARE · {mechanicalConstraints.length} ASSEMBLY</span><span>SOCKET AUTHORING · {sourceRef ? `ORIGEM ${sourceKey} · ${compatibleTargetKeys.size} ALVOS` : "IDLE · CLIQUE UM SOCKET REAL"}</span>
      </div>
      <div className={styles.body}>
        <aside className={styles.library}><label>Componente canônico<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="battery, regulator, motor, wheel, bracket..." /></label><select aria-label="Definição 3D" value={selectedDefinition?.definitionId ?? ""} onChange={(event) => setSelectedDefinitionId(event.target.value)}>{definitions.map((definition: ComponentDefinition) => <option key={definition.definitionId} value={definition.definitionId}>{definition.name} · {definition.domain}</option>)}</select><button type="button" onClick={addSelected} disabled={!selectedDefinition}>Adicionar ao 3D</button><span>ENTIDADES</span><div className={styles.entityList}>{components.map((entity) => { const visual = visualAssetForEntity(entity); const proxy = spatialProxyForEntity(entity); return <button type="button" key={entity.id} data-selected={selectedEntityId === entity.id} data-visual-source={visual ? "asset" : "proxy"} data-proxy-kind={proxy?.kind ?? ""} onClick={() => setSelectedEntityId(runtime.spatial.select(entity.id).entity.id)}><strong>{entity.name}</strong><small>{entity.id} · {visual ? "REAL ASSET" : proxy ? `PROXY ${proxy.kind.toUpperCase()}` : "PROXY"}</small></button>; })}</div></aside>
        <main className={styles.viewport} data-testid="invention-3d-workbench"><div className={styles.cameraBar}><button type="button" onClick={() => setCameraPreset("perspective")} data-selected={cameraPreset === "perspective"}>Perspectiva</button><button type="button" onClick={() => setCameraPreset("front")} data-selected={cameraPreset === "front"}>Frontal</button><button type="button" onClick={() => setCameraPreset("top")} data-selected={cameraPreset === "top"}>Superior</button></div><Canvas frameloop="demand" camera={{ position: cameraPosition("perspective"), fov: 42, near: 0.01, far: 10 }} dpr={1} onPointerMissed={() => setSelectedEntityId(null)}><Scene components={components} bindings={bindings} wires={wires} selectedEntityId={selectedEntityId} socketSourceKey={sourceKey} compatibleTargetKeys={compatibleTargetKeys} cameraPreset={cameraPreset} onSelect={setSelectedEntityId} onSocketSelect={selectSocket} /></Canvas>{components.length === 0 ? <div className={styles.empty}><strong>VOLUME DE INVENÇÃO VAZIO</strong><span>Adicione componentes canônicos para materializar a cena.</span></div> : null}</main>
        <aside className={styles.inspector}><span>TRANSFORM 3D</span>{selectedEntity && selectedBinding ? <><div className={styles.selected} data-testid="invention-3d-selected" data-x={format(selectedBinding.position.x)} data-y={format(selectedBinding.position.y)} data-z={format(selectedBinding.position.z)} data-rx={format(selectedBinding.rotation.x)} data-ry={format(selectedBinding.rotation.y)} data-rz={format(selectedBinding.rotation.z)}><strong>{selectedEntity.name}</strong><small>x {format(selectedBinding.position.x)} · y {format(selectedBinding.position.y)} · z {format(selectedBinding.position.z)} · rx {format(selectedBinding.rotation.x)} · ry {format(selectedBinding.rotation.y)} · rz {format(selectedBinding.rotation.z)}</small></div><div className={styles.selected} data-testid="invention-3d-visual-source" data-source={selectedVisual ? "asset" : "proxy"} data-asset-id={selectedVisual?.assetId ?? ""} data-asset-version={selectedVisual?.version ?? ""} data-asset-lod={selectedVisual?.lod ?? ""} data-socket-count={selectedVisual ? Object.keys(selectedVisual.portSocketMap).length : 0} data-sockets={selectedVisual ? Object.values(selectedVisual.portSocketMap).join(",") : ""} data-proxy-kind={selectedProxy?.kind ?? ""} data-anchor-count={selectedProxy ? Object.keys(selectedProxy.portAnchors).length : 0} data-anchors={selectedProxy ? Object.values(selectedProxy.portAnchors).map((anchor) => anchor.name).join(",") : ""}><strong>{selectedVisual ? "REAL ASSET" : "PROXY EXPLÍCITO"}</strong><small>{selectedVisual ? `${selectedVisual.assetId} · ${selectedVisual.version} · ${selectedVisual.lod} · ${Object.keys(selectedVisual.portSocketMap).length} SOCKETS` : selectedProxy ? `${selectedProxy.kind.toUpperCase()} · ${Object.keys(selectedProxy.portAnchors).length} ÂNCORA(S) FÍSICA(S)` : "Ainda sem arte Asset Forge cadastrada."}</small></div>
          {selectedVisual ? <div className={styles.wireEvidence} aria-label="Sockets 3D interativos" data-testid="invention-3d-socket-authoring" data-source-key={sourceKey}>{Object.entries(selectedVisual.portSocketMap).map(([portId, socketName]) => { const key = portKey({ entityId: selectedEntity.id, portId }); const port = selectedEntity.ports[portId]; const isSource = key === sourceKey; const readySource = Boolean(port && port.state === "available" && port.direction !== "in"); const compatibleTarget = Boolean(sourceRef && compatibleTargetKeys.has(key)); const enabled = Boolean(port && port.state === "available" && (isSource || (!sourceRef && readySource) || compatibleTarget)); const socketState = isSource ? "source" : sourceRef ? compatibleTarget ? "compatible" : "blocked" : readySource ? "ready" : "blocked"; return <button type="button" key={portId} data-testid={`invention-3d-socket-${selectedEntity.id}-${portId}`} data-socket-name={socketName} data-socket-state={socketState} disabled={!enabled} onClick={() => selectSocket(selectedEntity.id, portId)}><strong>{portId}</strong><small>{socketName} · {socketState.toUpperCase()}</small></button>; })}</div> : null}
          <div className={styles.axisGrid}><button type="button" onClick={() => moveSelected("x", -MOVE_STEP)}>X −</button><button type="button" onClick={() => moveSelected("x", MOVE_STEP)}>X +</button><button type="button" onClick={() => moveSelected("y", -MOVE_STEP)}>Y −</button><button type="button" onClick={() => moveSelected("y", MOVE_STEP)}>Y +</button><button type="button" onClick={() => moveSelected("z", -MOVE_STEP)}>Z −</button><button type="button" onClick={() => moveSelected("z", MOVE_STEP)}>Z +</button><button type="button" onClick={() => rotateSelected("x", -ROTATE_STEP_RAD)}>RX −</button><button type="button" onClick={() => rotateSelected("x", ROTATE_STEP_RAD)}>RX +</button><button type="button" onClick={() => rotateSelected("y", -ROTATE_STEP_RAD)}>RY −</button><button type="button" onClick={() => rotateSelected("y", ROTATE_STEP_RAD)}>RY +</button><button type="button" onClick={() => rotateSelected("z", -ROTATE_STEP_RAD)}>RZ −</button><button type="button" onClick={() => rotateSelected("z", ROTATE_STEP_RAD)}>RZ +</button></div></> : <p>Selecione uma entidade na lista ou diretamente na viewport.</p>}
          <span>WIRING REAL · FALLBACK ACESSÍVEL</span><label>Origem<select aria-label="Origem 3D" value={sourceKey} onChange={(event) => { setSourceKey(event.target.value); setTargetKey(""); }}><option value="">Selecione...</option>{sourceOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label><label>Destino compatível<select aria-label="Destino 3D" value={targetKey} onChange={(event) => setTargetKey(event.target.value)} disabled={!sourceRef}><option value="">Selecione...</option>{targetOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label><button type="button" onClick={connect} disabled={!sourceRef || !targetKey}>Conectar no 3D</button>
          <div className={styles.wireEvidence} aria-label="3D wire evidence">{wires.map((wire) => { const sourceEntity = componentMap.get(wire.sourceEntityId); const targetEntity = componentMap.get(wire.targetEntityId); const sourceBinding = bindingMap.get(wire.sourceEntityId); const targetBinding = bindingMap.get(wire.targetEntityId); if (!sourceEntity || !targetEntity || !sourceBinding || !targetBinding) return null; return <EndpointAwareWireEvidence key={wire.relationshipId} wire={wire} sourceEntity={sourceEntity} targetEntity={targetEntity} sourceBinding={sourceBinding} targetBinding={targetBinding} onDisconnect={() => { try { runtime.builder.disconnect(wire.relationshipId); changed(`${wire.relationshipId} desconectado do Engineering Graph e removido da viewport 3D.`); } catch (cause) { blocked(cause); } }} />; })}</div>
          <div className={styles.wireEvidence} aria-label="Mechanical assembly constraints">{mechanicalConstraints.map((constraint) => { const sourceEntity = componentMap.get(constraint.driver.entityId); const targetEntity = componentMap.get(constraint.follower.entityId); const sourceBinding = bindingMap.get(constraint.driver.entityId); const targetBinding = bindingMap.get(constraint.follower.entityId); if (!sourceEntity || !targetEntity || !sourceBinding || !targetBinding) return null; return <MechanicalConstraintSynchronizer key={constraint.relationshipId} constraint={constraint} sourceEntity={sourceEntity} targetEntity={targetEntity} sourceBinding={sourceBinding} targetBinding={targetBinding} spatial={runtime.spatial} onSnapped={assemblySnapped} onBlocked={assemblyBlocked} />; })}</div>
        </aside>
      </div><div className={error ? styles.feedbackError : styles.feedback} data-testid="invention-3d-feedback"><strong>{error ? "BLOCKED" : "ENGINEERING STATE"}</strong><span>{message}</span></div>
    </div></section> : null}
  </>;
}
