"use client";

import { useLoader } from "@react-three/fiber";
import { useMemo } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { EngineeringEntity } from "../../../packages/engineering-core/src/index";
import type { SpatialEntityBinding } from "../../../packages/spatial-runtime/src/index";

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
}

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
    sha256
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
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

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
      {selected ? (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.014, 0]}>
          <torusGeometry args={[0.044, 0.0015, 8, 40]} />
          <meshBasicMaterial color="#d7d2bd" />
        </mesh>
      ) : null}
    </group>
  );
}
