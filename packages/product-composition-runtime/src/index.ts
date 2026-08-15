import {
  createEngineeringEntity,
  type CapabilityDefinition,
  type EngineeringEntity,
  type EngineeringPort,
  type EntityId
} from "../../engineering-core/src/index.js";
import {
  ComponentRegistry,
  portsAreCompatible,
  type ProductFamily
} from "../../component-library/src/index.js";
import type { EngineeringRelationship } from "../../engineering-graph/src/index.js";
import type { TehkneStudioProject } from "../../project-format/src/index.js";

export const PRODUCT_COMPOSITION_VERSION = "1" as const;
export const PRODUCT_COMPOSITION_SIGNATURE = "Tehkné Solutions" as const;

export interface ProductSpatialProfile {
  readonly position: readonly [number, number, number];
  readonly exploded: readonly [number, number, number];
  readonly size: readonly [number, number, number];
}

export interface ProductSlotProfile {
  readonly slotId: string;
  readonly definitionId: string;
  readonly entityId: EntityId;
  readonly name: string;
  readonly teardown?: boolean;
  readonly voiceAliases?: readonly string[];
  readonly spatial: ProductSpatialProfile;
}

export interface ProductConnectionProfile {
  readonly id: string;
  readonly from: readonly [slotId: string, portId: string];
  readonly to: readonly [slotId: string, portId: string];
}

export interface ProductBootDependencyProfile {
  readonly slotId: string;
  readonly reason: string;
}

export interface ProductCompositionProfile {
  readonly compositionVersion: typeof PRODUCT_COMPOSITION_VERSION;
  readonly profileId: string;
  readonly projectId: string;
  readonly name: string;
  readonly signature: typeof PRODUCT_COMPOSITION_SIGNATURE;
  readonly productFamily: ProductFamily;
  readonly projectType?: TehkneStudioProject["projectType"];
  readonly root: {
    readonly id: EntityId;
    readonly name: string;
    readonly type: string;
    readonly formFactor: string;
    readonly voiceAliases: readonly string[];
    readonly simpleExplanation: string;
  };
  readonly boot: {
    readonly id: EntityId;
    readonly name: string;
    readonly voiceAliases: readonly string[];
    readonly simpleExplanation: string;
  };
  readonly requiredSlots: readonly string[];
  readonly slots: readonly ProductSlotProfile[];
  readonly connections: readonly ProductConnectionProfile[];
  readonly bootDependencies: readonly ProductBootDependencyProfile[];
}

export interface ProductMaterializationResult {
  readonly project: TehkneStudioProject;
  readonly slotEntities: Readonly<Record<string, EntityId>>;
  readonly connectionCount: number;
  readonly componentCount: number;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function contextualTeardown(entity: EngineeringEntity): EngineeringEntity {
  const contextualCapabilities: CapabilityDefinition[] = [
    ...entity.capabilities,
    ...(!entity.capabilities.some((capability) => capability.id === "remove") ? [{ id: "remove", label: "Remover" }] : []),
    ...(!entity.capabilities.some((capability) => capability.id === "insert") ? [{ id: "insert", label: "Reinstalar" }] : [])
  ];
  return {
    ...entity,
    state: "connected",
    properties: {
      ...entity.properties,
      connected: { id: "connected", value: true, source: "studio", confidence: 1 }
    },
    capabilities: contextualCapabilities,
    metadata: { ...entity.metadata, teardownContext: true }
  };
}

function createRoot(profile: ProductCompositionProfile): EngineeringEntity {
  return createEngineeringEntity({
    id: profile.root.id,
    type: profile.root.type,
    name: profile.root.name,
    state: "closed",
    properties: {
      formFactor: { id: "formFactor", value: profile.root.formFactor, source: "studio", confidence: 1 },
      powerState: { id: "powerState", value: "off", source: "simulated", confidence: 1 }
    },
    ports: {},
    capabilities: [
      { id: "inspect", label: "Inspecionar" },
      { id: "explain", label: "Explicar" },
      { id: "open", label: "Abrir" },
      { id: "explode", label: "Explodir" },
      { id: "powerOn", label: "Ligar" }
    ],
    metadata: {
      preset: true,
      profileId: profile.profileId,
      productFamily: profile.productFamily,
      voiceAliases: [...profile.root.voiceAliases],
      simpleExplanation: profile.root.simpleExplanation,
      signature: PRODUCT_COMPOSITION_SIGNATURE
    }
  });
}

function createBoot(profile: ProductCompositionProfile): EngineeringEntity {
  return createEngineeringEntity({
    id: profile.boot.id,
    type: "BootProcess",
    name: profile.boot.name,
    state: "idle",
    parentId: profile.root.id,
    properties: {
      status: { id: "status", value: "idle", source: "simulated", confidence: 1 },
      stage: { id: "stage", value: "IDLE", source: "simulated", confidence: 1 },
      faultCode: { id: "faultCode", value: null, source: "simulated", confidence: 1 },
      faultEntityId: { id: "faultEntityId", value: null, source: "simulated", confidence: 1 },
      faultReason: { id: "faultReason", value: null, source: "simulated", confidence: 1 }
    },
    ports: {},
    capabilities: [
      { id: "inspect", label: "Inspecionar" },
      { id: "explain", label: "Explicar" },
      { id: "why", label: "Por quê?" }
    ],
    metadata: {
      voiceAliases: [...profile.boot.voiceAliases],
      simpleExplanation: profile.boot.simpleExplanation,
      productFamily: profile.productFamily,
      signature: PRODUCT_COMPOSITION_SIGNATURE
    }
  });
}

function slotMap(profile: ProductCompositionProfile): Map<string, ProductSlotProfile> {
  return new Map(profile.slots.map((slot) => [slot.slotId, slot]));
}

function connectedPortStates(profile: ProductCompositionProfile, slotId: string): Record<string, EngineeringPort["state"]> {
  const states: Record<string, EngineeringPort["state"]> = {};
  for (const connection of profile.connections) {
    if (connection.from[0] === slotId) states[connection.from[1]] = "connected";
    if (connection.to[0] === slotId) states[connection.to[1]] = "connected";
  }
  return states;
}

export function validateProductCompositionProfile(
  profile: ProductCompositionProfile,
  registry: ComponentRegistry
): string[] {
  const errors: string[] = [];
  if (profile.compositionVersion !== PRODUCT_COMPOSITION_VERSION) errors.push(`compositionVersion must be ${PRODUCT_COMPOSITION_VERSION}`);
  if (!profile.profileId.trim()) errors.push("profileId is required");
  if (!profile.projectId.trim()) errors.push("projectId is required");
  if (!profile.name.trim()) errors.push("name is required");
  if (profile.signature !== PRODUCT_COMPOSITION_SIGNATURE) errors.push("product profile signature must be Tehkné Solutions");
  if (!profile.productFamily) errors.push("productFamily is required");
  if (!profile.root.id.trim() || !profile.root.type.trim() || !profile.root.formFactor.trim()) errors.push("product root contract is invalid");
  if (!profile.boot.id.trim() || !profile.boot.name.trim()) errors.push("product boot contract is invalid");
  if (profile.slots.length === 0) errors.push("product profile requires component slots");
  if (!unique(profile.requiredSlots)) errors.push("required slot IDs must be unique");
  if (!unique(profile.slots.map((slot) => slot.slotId))) errors.push("product slot IDs must be unique");
  if (!unique(profile.slots.map((slot) => slot.entityId))) errors.push("product entity IDs must be unique");
  if (!unique(profile.connections.map((connection) => connection.id))) errors.push("product connection IDs must be unique");

  const slots = slotMap(profile);
  for (const required of profile.requiredSlots) {
    if (!slots.has(required)) errors.push(`required product slot missing: ${required}`);
  }

  for (const slot of profile.slots) {
    try {
      const definition = registry.get(slot.definitionId);
      if (!definition.productFamilies.includes(profile.productFamily)) {
        errors.push(`${slot.slotId} component ${slot.definitionId} is not declared for ${profile.productFamily} products`);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `unknown component definition ${slot.definitionId}`);
    }
    if (!slot.spatial || slot.spatial.position.length !== 3 || slot.spatial.exploded.length !== 3 || slot.spatial.size.length !== 3) {
      errors.push(`${slot.slotId} requires complete spatial metadata`);
    }
  }

  for (const connection of profile.connections) {
    const fromSlot = slots.get(connection.from[0]);
    const toSlot = slots.get(connection.to[0]);
    if (!fromSlot || !toSlot) {
      errors.push(`connection ${connection.id} references unknown slot`);
      continue;
    }
    try {
      const fromDefinition = registry.get(fromSlot.definitionId);
      const toDefinition = registry.get(toSlot.definitionId);
      const fromPort = fromDefinition.ports[connection.from[1]];
      const toPort = toDefinition.ports[connection.to[1]];
      if (!fromPort) errors.push(`connection ${connection.id} missing source port ${connection.from[1]}`);
      if (!toPort) errors.push(`connection ${connection.id} missing target port ${connection.to[1]}`);
      if (fromPort && toPort && !portsAreCompatible(fromPort, toPort)) {
        errors.push(`connection ${connection.id} uses incompatible interfaces ${connection.from[1]} → ${connection.to[1]}`);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `connection ${connection.id} cannot be validated`);
    }
  }

  for (const dependency of profile.bootDependencies) {
    if (!slots.has(dependency.slotId)) errors.push(`boot dependency references unknown slot: ${dependency.slotId}`);
    if (!dependency.reason.trim()) errors.push(`boot dependency reason is required: ${dependency.slotId}`);
  }
  return errors;
}

export function materializeProductComposition(
  profile: ProductCompositionProfile,
  registry: ComponentRegistry
): ProductMaterializationResult {
  const errors = validateProductCompositionProfile(profile, registry);
  if (errors.length > 0) throw new Error(`Invalid product composition profile: ${errors.join("; ")}`);

  const root = createRoot(profile);
  const boot = createBoot(profile);
  const entities: EngineeringEntity[] = [root, boot];
  const relationships: EngineeringRelationship[] = [
    { id: `${profile.projectId}-contains-boot`, source: root.id, target: boot.id, type: "contains", metadata: { role: "boot" } }
  ];
  const slots = slotMap(profile);
  const slotEntities: Record<string, EntityId> = {};

  for (const slot of profile.slots) {
    let entity = registry.instantiate(slot.definitionId, slot.entityId, {
      name: slot.name,
      parentId: root.id,
      portStates: connectedPortStates(profile, slot.slotId),
      metadata: {
        productSlotId: slot.slotId,
        [`${profile.productFamily}SlotId`]: slot.slotId,
        spatial: clone(slot.spatial),
        profileId: profile.profileId,
        voiceAliases: [...(slot.voiceAliases ?? [slot.name])]
      }
    });
    if (slot.teardown) entity = contextualTeardown(entity);
    entities.push(entity);
    slotEntities[slot.slotId] = entity.id;
    relationships.push({
      id: `${profile.projectId}-contains-${slot.slotId}`,
      source: root.id,
      target: entity.id,
      type: "contains",
      metadata: { slotId: slot.slotId, definitionId: slot.definitionId }
    });
  }

  for (const connection of profile.connections) {
    const fromSlot = slots.get(connection.from[0])!;
    const toSlot = slots.get(connection.to[0])!;
    const fromDefinition = registry.get(fromSlot.definitionId);
    const toDefinition = registry.get(toSlot.definitionId);
    const fromPort = fromDefinition.ports[connection.from[1]]!;
    const toPort = toDefinition.ports[connection.to[1]]!;
    const sharedInterfaces = fromPort.compatibility.filter((token) => toPort.compatibility.includes(token));
    relationships.push({
      id: connection.id,
      source: fromSlot.entityId,
      target: toSlot.entityId,
      type: "connectedTo",
      metadata: {
        sourcePortId: connection.from[1],
        targetPortId: connection.to[1],
        sharedInterfaces,
        validatedBy: "component-library"
      }
    });
  }

  for (const dependency of profile.bootDependencies) {
    relationships.push({
      id: `${profile.projectId}-boot-depends-${dependency.slotId}`,
      source: boot.id,
      target: slotEntities[dependency.slotId]!,
      type: "dependsOn",
      metadata: { reason: dependency.reason }
    });
  }

  const catalog = registry.catalog();
  const project: TehkneStudioProject = {
    schemaVersion: "0.1",
    projectId: profile.projectId,
    name: profile.name,
    projectType: profile.projectType ?? "teardown",
    rootEntityId: root.id,
    entities,
    relationships,
    metadata: {
      preset: true,
      profileId: profile.profileId,
      productFamily: profile.productFamily,
      materializedFrom: catalog.catalogId,
      componentLibraryVersion: catalog.catalogVersion,
      productCompositionVersion: PRODUCT_COMPOSITION_VERSION,
      signature: PRODUCT_COMPOSITION_SIGNATURE
    }
  };

  return {
    project,
    slotEntities,
    connectionCount: profile.connections.length,
    componentCount: profile.slots.length
  };
}
