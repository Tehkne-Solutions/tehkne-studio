export type EntityId = string;
export type PortId = string;

export type EngineeringPropertyValue = string | number | boolean | null;

export type PropertySource =
  | "user"
  | "manufacturer"
  | "measured"
  | "calculated"
  | "simulated"
  | "estimated"
  | "studio";

export interface EngineeringProperty {
  readonly id: string;
  value: EngineeringPropertyValue;
  unit?: string;
  source: PropertySource;
  confidence?: number;
  min?: number;
  max?: number;
}

export type PortKind =
  | "mechanical"
  | "electrical"
  | "signal"
  | "data"
  | "thermal"
  | "logical";

export type PortDirection = "in" | "out" | "bidirectional";

export interface EngineeringPort {
  readonly id: PortId;
  readonly kind: PortKind;
  readonly direction: PortDirection;
  readonly compatibility: readonly string[];
  state: "available" | "connected" | "disabled";
}

export interface CapabilityDefinition {
  readonly id: string;
  readonly label: string;
  readonly parameters?: Readonly<Record<string, "string" | "number" | "boolean">>;
}

export interface EngineeringEntity {
  readonly id: EntityId;
  readonly type: string;
  name: string;
  parentId?: EntityId;
  state: string;
  readonly properties: Record<string, EngineeringProperty>;
  readonly ports: Record<PortId, EngineeringPort>;
  readonly capabilities: readonly CapabilityDefinition[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface CreateEntityInput {
  readonly id: EntityId;
  readonly type: string;
  readonly name: string;
  readonly parentId?: EntityId;
  readonly state?: string;
  readonly properties?: Record<string, EngineeringProperty>;
  readonly ports?: Record<PortId, EngineeringPort>;
  readonly capabilities?: readonly CapabilityDefinition[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export function createEngineeringEntity(input: CreateEntityInput): EngineeringEntity {
  if (!input.id.trim()) throw new Error("EngineeringEntity id is required");
  if (!input.type.trim()) throw new Error("EngineeringEntity type is required");
  if (!input.name.trim()) throw new Error("EngineeringEntity name is required");

  const entity: EngineeringEntity = {
    id: input.id,
    type: input.type,
    name: input.name,
    state: input.state ?? "ready",
    properties: input.properties ?? {},
    ports: input.ports ?? {},
    capabilities: input.capabilities ?? [],
    metadata: input.metadata ?? {}
  };

  if (input.parentId !== undefined) entity.parentId = input.parentId;
  return entity;
}

export function hasCapability(entity: EngineeringEntity, capabilityId: string): boolean {
  return entity.capabilities.some((capability) => capability.id === capabilityId);
}

export function setEngineeringProperty(
  entity: EngineeringEntity,
  propertyId: string,
  value: EngineeringPropertyValue
): EngineeringEntity {
  const property = entity.properties[propertyId];
  if (!property) throw new Error(`Unknown property: ${propertyId}`);

  if (typeof value === "number") {
    if (property.min !== undefined && value < property.min) {
      throw new Error(`${propertyId} below minimum ${property.min}`);
    }
    if (property.max !== undefined && value > property.max) {
      throw new Error(`${propertyId} above maximum ${property.max}`);
    }
  }

  return {
    ...entity,
    properties: {
      ...entity.properties,
      [propertyId]: { ...property, value }
    }
  };
}
