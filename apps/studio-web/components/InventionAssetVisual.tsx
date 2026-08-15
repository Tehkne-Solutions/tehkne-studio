"use client";

import { useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Euler, Vector3 } from "three";
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

export interface AssetSocketEvidence {
  readonly entityId: string;
  readonly portId: string;
  readonly socketName: string;
  readonly position: SpatialVector3;
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

export function portSocketNameForEntity(entity: EngineeringEntity, portId: string): string | null {
  const visual = visualAssetForEntity(entity);
  return visual?.portSocketMap[portId] ?? null;
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
  socketSourceKey = "",
  compatibleTargetKeys,
  onSelect,
  onSocketSelect
}: {
  readonly entity: EngineeringEntity;
  readonly binding: SpatialEntityBinding;
  readonly descriptor: GltfVisualAssetDescriptor;
  readonly selected: boolean;
  readonly socketSourceKey?: string;
  readonly compatibleTargetKeys?: ReadonlySet<string>;
  readonly onSelect: (entityId: string) => void;
  readonly onSocketSelect?: (entityId: string, portId: string) => void;
}) {
  const gltf = useLoader(GLTFLoader, descriptor.runtimeUrl);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const localSockets = useMemo(() => {
    scene.updateMatrixWorld(true);
    return Object.entries(descriptor.portSocketMap).map(([portId, socketName]) => {
      const node = scene.getObjectByName(socketName);
      if (!node) {
        throw new Error(`Asset ${descriptor.assetId} missing required socket node ${socketName} for ${entity.id}:${portId}`);
      }
      const position = node.getWorldPosition(new Vector3());
      return { portId, socketName, position };
    });
  }, [descriptor.assetId, descriptor.portSocketMap, entity.id, scene]);

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

  const showSockets = selected || Boolean(socketSourceKey);

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
      {showSockets ? localSockets.map(({ portId, socketName, position }) => {
        const key = socketKey(entity.id, portId);
        const port = entity.ports[portId];
        const isSource = key === socketSourceKey;
        const compatible = socketSourceKey
          ? Boolean(compatibleTargetKeys?.has(key))
          : Boolean(port && port.state === "available" && port.direction !== "in");
        const interactive = Boolean(onSocketSelect && port && port.state === "available" && (isSource || compatible));
        const color = isSource ? "#d6ae6c" : compatible ? "#9eb8a6" : "#555953";
        const state = isSource ? "source" : compatible ? "compatible" : "blocked";
        return (
          <mesh
            key={portId}
            name={`port-socket-${entity.id}-${portId}-${socketName}`}
            position={[position.x, position.y, position.z]}
            userData={{ entityId: entity.id, portId, socketName, socketAuthoringState: state }}
            onClick={interactive ? (event) => {
              event.stopPropagation();
              onSelect(entity.id);
              onSocketSelect?.(entity.id, portId);
            } : undefined}
          >
            <sphereGeometry args={[interactive ? 0.005 : 0.003, 12, 10]} />
            <meshStandardMaterial color={color} metalness={0.15} roughness={0.35} />
          </mesh>
        );
      }) : null}
      {selected ? (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.014, 0]}>
          <torusGeometry args={[0.044, 0.0015, 8, 40]} />
          <meshBasicMaterial color="#d7d2bd" />
        </mesh>
      ) : null}
    </group>
  );
}
