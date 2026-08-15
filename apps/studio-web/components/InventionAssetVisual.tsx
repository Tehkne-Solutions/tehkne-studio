"use client";

import { useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Euler, Object3D, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { EngineeringEntity } from "../../../packages/engineering-core/src/index";
import type {
  SpatialEntityBinding,
  SpatialVector3
} from "../../../packages/spatial-runtime/src/index";

export interface GltfVisualAssetDescriptor {
  readonly kind: "gltf";
  readonly assetId: string;
  readonly version: string;
  readonly status: string;
  readonly lod: string;
  readonly runtimeUrl: string;
  readonly triangles: number;
  readonly bytes: number;
  readonly sha256: string;
  readonly portSocketMap: Readonly<Record<string, string>>;
}

export interface SpatialProxyPortAnchor {
  readonly name: string;
  readonly position: SpatialVector3;
}

export interface SpatialProxyDescriptor {
  readonly kind: "wheel" | "motor-bracket";
  readonly status: "PROXY_EXPLICIT";
  readonly dimensionsM: Readonly<Record<string, number>>;
  readonly portAnchors: Readonly<Record<string, SpatialProxyPortAnchor>>;
}

export interface AssetSocketEvidence {
  readonly entityId: string;
  readonly portId: string;
  readonly socketName: string;
  readonly position: SpatialVector3;
}

export interface SpatialPortEndpointEvidence extends AssetSocketEvidence {
  readonly source: "asset-socket" | "proxy-anchor" | "center-fallback";
}

interface PreparedAssetScene {
  readonly scene: Object3D;
  readonly localSockets: readonly {
    readonly portId: string;
    readonly socketName: string;
    readonly position: Vector3;
  }[];
}

const socketEndpoints = new Map<string, AssetSocketEvidence>();
const socketListeners = new Set<() => void>();
let socketRevision = 0;

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Visual asset ${key} is required`);
  return value;
}

function requiredPositiveInteger(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (!Number.isInteger(value) || Number(value) <= 0) throw new Error(`Visual asset ${key} must be a positive integer`);
  return Number(value);
}

function parsePortSocketMap(entity: EngineeringEntity): Readonly<Record<string, string>> {
  const raw = entity.metadata.portSocketMap;
  if (raw === undefined) return {};
  if (!record(raw)) throw new Error(`Port socket map must be an object: ${entity.id}`);

  const mapping: Record<string, string> = {};
  for (const [portId, socketName] of Object.entries(raw)) {
    if (!entity.ports[portId]) throw new Error(`Port socket map references unknown port ${entity.id}:${portId}`);
    if (typeof socketName !== "string" || !socketName.trim()) {
      throw new Error(`Port socket map requires a socket node for ${entity.id}:${portId}`);
    }
    mapping[portId] = socketName;
  }
  return Object.freeze(mapping);
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return value;
}

function parseProxyAnchor(entity: EngineeringEntity, portId: string, value: unknown): SpatialProxyPortAnchor {
  if (!entity.ports[portId]) throw new Error(`Spatial proxy references unknown port ${entity.id}:${portId}`);
  if (!record(value)) throw new Error(`Spatial proxy anchor must be an object: ${entity.id}:${portId}`);
  const name = requiredString(value, "name");
  const position = value.position;
  if (!Array.isArray(position) || position.length !== 3) {
    throw new Error(`Spatial proxy anchor position must be [x,y,z]: ${entity.id}:${portId}`);
  }
  return {
    name,
    position: {
      x: finiteNumber(position[0], `${entity.id}:${portId} x`),
      y: finiteNumber(position[1], `${entity.id}:${portId} y`),
      z: finiteNumber(position[2], `${entity.id}:${portId} z`)
    }
  };
}

function socketKey(entityId: string, portId: string): string {
  return `${entityId}::${portId}`;
}

function publishSocketEvidence(evidence: readonly AssetSocketEvidence[]): void {
  let changed = false;
  for (const item of evidence) {
    const key = socketKey(item.entityId, item.portId);
    const current = socketEndpoints.get(key);
    if (
      !current ||
      current.socketName !== item.socketName ||
      current.position.x !== item.position.x ||
      current.position.y !== item.position.y ||
      current.position.z !== item.position.z
    ) {
      socketEndpoints.set(key, item);
      changed = true;
    }
  }
  if (!changed) return;
  socketRevision += 1;
  for (const listener of socketListeners) listener();
}

function clearSocketEvidence(entityId: string): void {
  let changed = false;
  for (const [key, evidence] of socketEndpoints) {
    if (evidence.entityId !== entityId) continue;
    socketEndpoints.delete(key);
    changed = true;
  }
  if (!changed) return;
  socketRevision += 1;
  for (const listener of socketListeners) listener();
}

function subscribeSockets(listener: () => void): () => void {
  socketListeners.add(listener);
  return () => socketListeners.delete(listener);
}

function socketSnapshot(): number {
  return socketRevision;
}

function transformSocketPosition(local: Vector3, binding: SpatialEntityBinding): SpatialVector3 {
  const transformed = local
    .clone()
    .multiply(new Vector3(binding.scale.x, binding.scale.y, binding.scale.z))
    .applyEuler(new Euler(binding.rotation.x, binding.rotation.y, binding.rotation.z))
    .add(new Vector3(binding.position.x, binding.position.y, binding.position.z));
  return { x: transformed.x, y: transformed.y, z: transformed.z };
}

function prepareAssetScene(
  source: Object3D,
  assetId: string,
  entityId: string,
  socketEntries: readonly (readonly [string, string])[]
): PreparedAssetScene {
  // Clone and resolve socket coordinates in the same pre-mount operation.
  // The clone has no external R3F parent yet, so getWorldPosition() produces
  // asset-local physical coordinates exactly once. Spatial bindings are applied
  // later by transformSocketPosition().
  const scene = source.clone(true);
  scene.updateMatrixWorld(true);
  const localSockets = socketEntries.map(([portId, socketName]) => {
    const node = scene.getObjectByName(socketName);
    if (!node) {
      throw new Error(`Asset ${assetId} missing required socket node ${socketName} for ${entityId}:${portId}`);
    }
    return {
      portId,
      socketName,
      position: node.getWorldPosition(new Vector3())
    };
  });
  return { scene, localSockets };
}

export function portSocketNameForEntity(entity: EngineeringEntity, portId: string): string | null {
  const visual = visualAssetForEntity(entity);
  return visual?.portSocketMap[portId] ?? null;
}

export function spatialProxyForEntity(entity: EngineeringEntity): SpatialProxyDescriptor | null {
  const raw = entity.metadata.spatialProxy;
  if (raw === undefined) return null;
  if (!record(raw)) throw new Error(`Spatial proxy metadata must be an object: ${entity.id}`);
  if (raw.kind !== "wheel" && raw.kind !== "motor-bracket") {
    throw new Error(`Unsupported spatial proxy kind for ${entity.id}: ${String(raw.kind)}`);
  }
  if (raw.status !== "PROXY_EXPLICIT") throw new Error(`Spatial proxy status must remain explicit: ${entity.id}`);
  if (!record(raw.dimensionsM)) throw new Error(`Spatial proxy dimensions missing: ${entity.id}`);
  const dimensionsM: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw.dimensionsM)) dimensionsM[key] = finiteNumber(value, `${entity.id} ${key}`);
  if (!record(raw.portAnchors)) throw new Error(`Spatial proxy portAnchors missing: ${entity.id}`);
  const portAnchors: Record<string, SpatialProxyPortAnchor> = {};
  for (const [portId, anchor] of Object.entries(raw.portAnchors)) {
    portAnchors[portId] = parseProxyAnchor(entity, portId, anchor);
  }
  return {
    kind: raw.kind,
    status: "PROXY_EXPLICIT",
    dimensionsM: Object.freeze(dimensionsM),
    portAnchors: Object.freeze(portAnchors)
  };
}

export function useAssetSocketEndpoint(
  entityId: string,
  portId: string,
  fallback: SpatialVector3
): AssetSocketEvidence {
  useSyncExternalStore(subscribeSockets, socketSnapshot, socketSnapshot);
  return socketEndpoints.get(socketKey(entityId, portId)) ?? {
    entityId,
    portId,
    socketName: "",
    position: fallback
  };
}

export function useSpatialPortEndpoint(
  entity: EngineeringEntity,
  binding: SpatialEntityBinding,
  portId: string
): SpatialPortEndpointEvidence {
  useSyncExternalStore(subscribeSockets, socketSnapshot, socketSnapshot);
  const socket = socketEndpoints.get(socketKey(entity.id, portId));
  if (socket) return { ...socket, source: "asset-socket" };
  const anchor = spatialProxyForEntity(entity)?.portAnchors[portId];
  if (anchor) {
    return {
      entityId: entity.id,
      portId,
      socketName: anchor.name,
      position: transformSocketPosition(new Vector3(anchor.position.x, anchor.position.y, anchor.position.z), binding),
      source: "proxy-anchor"
    };
  }
  return {
    entityId: entity.id,
    portId,
    socketName: "",
    position: { ...binding.position },
    source: "center-fallback"
  };
}

export function visualAssetForEntity(entity: EngineeringEntity): GltfVisualAssetDescriptor | null {
  const raw = entity.metadata.visualAsset;
  if (raw === undefined) return null;
  if (!record(raw)) throw new Error(`Visual asset metadata must be an object: ${entity.id}`);
  if (raw.kind !== "gltf") throw new Error(`Unsupported visual asset kind for ${entity.id}: ${String(raw.kind)}`);

  const runtimeUrl = requiredString(raw, "runtimeUrl");
  if (!runtimeUrl.startsWith("/api/asset-forge/")) {
    throw new Error(`Visual asset runtimeUrl must use the Asset Forge API: ${entity.id}`);
  }

  const sha256 = requiredString(raw, "sha256");
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error(`Visual asset sha256 is invalid: ${entity.id}`);

  return {
    kind: "gltf",
    assetId: requiredString(raw, "assetId"),
    version: requiredString(raw, "version"),
    status: requiredString(raw, "status"),
    lod: requiredString(raw, "lod"),
    runtimeUrl,
    triangles: requiredPositiveInteger(raw, "triangles"),
    bytes: requiredPositiveInteger(raw, "bytes"),
    sha256,
    portSocketMap: parsePortSocketMap(entity)
  };
}

export function AssetBackedComponent({
  entity,
  binding,
  descriptor,
  selected,
  onSelect
}: {
  readonly entity: EngineeringEntity;
  readonly binding: SpatialEntityBinding;
  readonly descriptor: GltfVisualAssetDescriptor;
  readonly selected: boolean;
  readonly onSelect: (entityId: string) => void;
}) {
  const gltf = useLoader(GLTFLoader, descriptor.runtimeUrl);
  const portSocketSignature = JSON.stringify(
    Object.entries(descriptor.portSocketMap).sort(([left], [right]) => left.localeCompare(right))
  );
  const { scene, localSockets } = useMemo(() => {
    const socketEntries = JSON.parse(portSocketSignature) as [string, string][];
    return prepareAssetScene(gltf.scene, descriptor.assetId, entity.id, socketEntries);
  }, [
    descriptor.assetId,
    descriptor.runtimeUrl,
    descriptor.sha256,
    descriptor.version,
    entity.id,
    gltf.scene,
    portSocketSignature
  ]);

  useEffect(() => {
    publishSocketEvidence(localSockets.map(({ portId, socketName, position }) => ({
      entityId: entity.id,
      portId,
      socketName,
      position: transformSocketPosition(position, binding)
    })));
    return () => clearSocketEvidence(entity.id);
  }, [
    binding.position.x,
    binding.position.y,
    binding.position.z,
    binding.rotation.x,
    binding.rotation.y,
    binding.rotation.z,
    binding.scale.x,
    binding.scale.y,
    binding.scale.z,
    entity.id,
    localSockets
  ]);

  return (
    <group
      position={[binding.position.x, binding.position.y, binding.position.z]}
      rotation={[binding.rotation.x, binding.rotation.y, binding.rotation.z]}
      scale={[binding.scale.x, binding.scale.y, binding.scale.z]}
      name={`invention-3d-${entity.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(entity.id);
      }}
    >
      <primitive object={scene} />
      {selected ? localSockets.map(({ portId, socketName, position }) => (
        <mesh
          key={portId}
          name={`port-socket-${entity.id}-${portId}-${socketName}`}
          position={[position.x, position.y, position.z]}
        >
          <sphereGeometry args={[0.003, 10, 8]} />
          <meshStandardMaterial color="#d7d2bd" metalness={0.15} roughness={0.35} />
        </mesh>
      )) : null}
      {selected ? (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.014, 0]}>
          <torusGeometry args={[0.044, 0.0015, 8, 40]} />
          <meshBasicMaterial color="#d7d2bd" />
        </mesh>
      ) : null}
    </group>
  );
}
