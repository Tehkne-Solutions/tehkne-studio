import {
  createEngineeringEntity,
  setEngineeringProperty,
  type CapabilityDefinition,
  type EngineeringEntity,
  type EngineeringPort,
  type EngineeringProperty,
  type EngineeringPropertyValue,
  type EntityId
} from "../../engineering-core/src/index.js";

export const COMPONENT_LIBRARY_VERSION = "1" as const;
export const COMPONENT_LIBRARY_SIGNATURE = "Tehkné Solutions" as const;

export type ComponentDomain =
  | "compute"
  | "memory"
  | "storage"
  | "power"
  | "energy"
  | "display"
  | "audio"
  | "sensing"
  | "actuation"
  | "control"
  | "thermal"
  | "communication"
  | "structural"
  | "interface";

export type ProductFamily =
  | "desktop"
  | "notebook"
  | "smartphone"
  | "tablet"
  | "robotics"
  | "embedded"
  | "display-system"
  | "generic";

export interface ComponentDefinition {
  readonly definitionId: string;
  readonly version: typeof COMPONENT_LIBRARY_VERSION;
  readonly name: string;
  readonly type: string;
  readonly domain: ComponentDomain;
  readonly productFamilies: readonly ProductFamily[];
  readonly tags: readonly string[];
  readonly defaultState: string;
  readonly properties: Readonly<Record<string, EngineeringProperty>>;
  readonly ports: Readonly<Record<string, EngineeringPort>>;
  readonly capabilities: readonly CapabilityDefinition[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ComponentCatalogManifest {
  readonly catalogId: string;
  readonly catalogVersion: typeof COMPONENT_LIBRARY_VERSION;
  readonly signature: typeof COMPONENT_LIBRARY_SIGNATURE;
  readonly components: readonly ComponentDefinition[];
}

export interface ComponentInstanceOverrides {
  readonly name?: string;
  readonly parentId?: EntityId;
  readonly state?: string;
  readonly propertyValues?: Readonly<Record<string, EngineeringPropertyValue>>;
  readonly portStates?: Readonly<Record<string, EngineeringPort["state"]>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ComponentLibraryQuery {
  readonly query?: string;
  readonly domain?: ComponentDomain;
  readonly productFamily?: ProductFamily;
  readonly tags?: readonly string[];
}

export interface ComponentCompatibilityMatch {
  readonly definition: ComponentDefinition;
  readonly portId: string;
  readonly sharedInterfaces: readonly string[];
}

const COMPONENT_DOMAINS = new Set<ComponentDomain>([
  "compute", "memory", "storage", "power", "energy", "display", "audio", "sensing",
  "actuation", "control", "thermal", "communication", "structural", "interface"
]);
const PRODUCT_FAMILIES = new Set<ProductFamily>([
  "desktop", "notebook", "smartphone", "tablet", "robotics", "embedded", "display-system", "generic"
]);
const PORT_KINDS = new Set(["mechanical", "electrical", "signal", "data", "thermal", "logical"]);
const PORT_DIRECTIONS = new Set(["in", "out", "bidirectional"]);
const PORT_STATES = new Set(["available", "connected", "disabled"]);
const PROPERTY_SOURCES = new Set(["user", "manufacturer", "measured", "calculated", "simulated", "estimated", "studio"]);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function validateProperty(key: string, value: unknown): string[] {
  const errors: string[] = [];
  if (!record(value)) return [`property ${key} must be an object`];
  if (value.id !== key) errors.push(`property ${key} id must match its key`);
  if (!PROPERTY_SOURCES.has(String(value.source))) errors.push(`property ${key} has unsupported source`);
  if (value.confidence !== undefined && (typeof value.confidence !== "number" || value.confidence < 0 || value.confidence > 1)) {
    errors.push(`property ${key} confidence must be between 0 and 1`);
  }
  if (value.min !== undefined && typeof value.min !== "number") errors.push(`property ${key} min must be numeric`);
  if (value.max !== undefined && typeof value.max !== "number") errors.push(`property ${key} max must be numeric`);
  if (typeof value.min === "number" && typeof value.max === "number" && value.min > value.max) {
    errors.push(`property ${key} min cannot exceed max`);
  }
  return errors;
}

function validatePort(key: string, value: unknown): string[] {
  const errors: string[] = [];
  if (!record(value)) return [`port ${key} must be an object`];
  if (value.id !== key) errors.push(`port ${key} id must match its key`);
  if (!PORT_KINDS.has(String(value.kind))) errors.push(`port ${key} has unsupported kind`);
  if (!PORT_DIRECTIONS.has(String(value.direction))) errors.push(`port ${key} has unsupported direction`);
  if (!PORT_STATES.has(String(value.state))) errors.push(`port ${key} has unsupported state`);
  if (!Array.isArray(value.compatibility) || value.compatibility.length === 0 || value.compatibility.some((item) => typeof item !== "string" || !item.trim())) {
    errors.push(`port ${key} requires at least one compatibility interface`);
  } else if (!unique(value.compatibility as string[])) {
    errors.push(`port ${key} compatibility interfaces must be unique`);
  }
  return errors;
}

export function validateComponentDefinition(definition: unknown): string[] {
  if (!record(definition)) return ["component definition must be an object"];
  const errors: string[] = [];
  if (typeof definition.definitionId !== "string" || !definition.definitionId.trim()) errors.push("definitionId is required");
  if (definition.version !== COMPONENT_LIBRARY_VERSION) errors.push(`component version must be ${COMPONENT_LIBRARY_VERSION}`);
  if (typeof definition.name !== "string" || !definition.name.trim()) errors.push("component name is required");
  if (typeof definition.type !== "string" || !definition.type.trim()) errors.push("component type is required");
  if (!COMPONENT_DOMAINS.has(definition.domain as ComponentDomain)) errors.push(`unsupported component domain: ${String(definition.domain)}`);
  if (typeof definition.defaultState !== "string" || !definition.defaultState.trim()) errors.push("defaultState is required");

  if (!Array.isArray(definition.productFamilies) || definition.productFamilies.length === 0) {
    errors.push("component requires at least one product family");
  } else {
    const families = definition.productFamilies as unknown[];
    if (families.some((family) => !PRODUCT_FAMILIES.has(family as ProductFamily))) errors.push("component contains unsupported product family");
    if (!unique(families.map(String))) errors.push("component product families must be unique");
  }

  if (!Array.isArray(definition.tags) || definition.tags.length === 0 || definition.tags.some((tag) => typeof tag !== "string" || !tag.trim())) {
    errors.push("component requires non-empty tags");
  } else if (!unique(definition.tags as string[])) {
    errors.push("component tags must be unique");
  }

  if (!record(definition.properties)) errors.push("component properties must be an object");
  else for (const [key, value] of Object.entries(definition.properties)) errors.push(...validateProperty(key, value));

  if (!record(definition.ports)) errors.push("component ports must be an object");
  else for (const [key, value] of Object.entries(definition.ports)) errors.push(...validatePort(key, value));

  if (!Array.isArray(definition.capabilities)) errors.push("component capabilities must be an array");
  else {
    const capabilityIds = definition.capabilities.map((item) => record(item) ? String(item.id ?? "") : "");
    if (capabilityIds.some((id) => !id.trim())) errors.push("component capability id is required");
    if (!unique(capabilityIds)) errors.push("component capability ids must be unique");
  }
  if (!record(definition.metadata)) errors.push("component metadata must be an object");
  return errors;
}

export function validateComponentCatalog(catalog: unknown): string[] {
  if (!record(catalog)) return ["component catalog must be an object"];
  const errors: string[] = [];
  if (typeof catalog.catalogId !== "string" || !catalog.catalogId.trim()) errors.push("catalogId is required");
  if (catalog.catalogVersion !== COMPONENT_LIBRARY_VERSION) errors.push(`catalogVersion must be ${COMPONENT_LIBRARY_VERSION}`);
  if (catalog.signature !== COMPONENT_LIBRARY_SIGNATURE) errors.push("component catalog signature must be Tehkné Solutions");
  if (!Array.isArray(catalog.components) || catalog.components.length === 0) {
    errors.push("component catalog cannot be empty");
    return errors;
  }
  const definitionIds: string[] = [];
  for (const [index, definition] of catalog.components.entries()) {
    if (record(definition) && typeof definition.definitionId === "string") definitionIds.push(definition.definitionId);
    for (const error of validateComponentDefinition(definition)) errors.push(`components[${index}]: ${error}`);
  }
  if (!unique(definitionIds)) errors.push("component definition IDs must be unique");
  return errors;
}

export function parseComponentCatalog(input: unknown): ComponentCatalogManifest {
  const errors = validateComponentCatalog(input);
  if (errors.length > 0) throw new Error(`Invalid component catalog: ${errors.join("; ")}`);
  return clone(input as ComponentCatalogManifest);
}

export function portsAreCompatible(a: EngineeringPort, b: EngineeringPort): boolean {
  if (a.kind !== b.kind) return false;
  if (a.state === "disabled" || b.state === "disabled") return false;
  if (a.direction === "in" && b.direction === "in") return false;
  if (a.direction === "out" && b.direction === "out") return false;
  return a.compatibility.some((token) => b.compatibility.includes(token));
}

export class ComponentRegistry {
  readonly #catalog: ComponentCatalogManifest;
  readonly #definitions = new Map<string, ComponentDefinition>();

  constructor(catalog: ComponentCatalogManifest) {
    this.#catalog = parseComponentCatalog(catalog);
    for (const definition of this.#catalog.components) this.#definitions.set(definition.definitionId, definition);
  }

  catalog(): ComponentCatalogManifest {
    return clone(this.#catalog);
  }

  get(definitionId: string): ComponentDefinition {
    const definition = this.#definitions.get(definitionId);
    if (!definition) throw new Error(`Unknown component definition: ${definitionId}`);
    return clone(definition);
  }

  list(query: ComponentLibraryQuery = {}): readonly ComponentDefinition[] {
    const text = query.query?.trim().toLowerCase() ?? "";
    const tags = query.tags?.map((tag) => tag.toLowerCase()) ?? [];
    return this.#catalog.components
      .filter((definition) => !query.domain || definition.domain === query.domain)
      .filter((definition) => !query.productFamily || definition.productFamilies.includes(query.productFamily))
      .filter((definition) => tags.length === 0 || tags.every((tag) => definition.tags.some((candidate) => candidate.toLowerCase() === tag)))
      .filter((definition) => {
        if (!text) return true;
        const haystack = [
          definition.definitionId,
          definition.name,
          definition.type,
          definition.domain,
          ...definition.tags,
          ...definition.productFamilies
        ].join(" ").toLowerCase();
        return haystack.includes(text);
      })
      .map(clone);
  }

  compatibleWithPort(port: EngineeringPort): readonly ComponentCompatibilityMatch[] {
    const matches: ComponentCompatibilityMatch[] = [];
    for (const definition of this.#catalog.components) {
      for (const candidate of Object.values(definition.ports)) {
        if (!portsAreCompatible(port, candidate)) continue;
        matches.push({
          definition: clone(definition),
          portId: candidate.id,
          sharedInterfaces: port.compatibility.filter((token) => candidate.compatibility.includes(token))
        });
      }
    }
    return matches;
  }

  instantiate(definitionId: string, instanceId: EntityId, overrides: ComponentInstanceOverrides = {}): EngineeringEntity {
    if (!instanceId.trim()) throw new Error("Component instance id is required");
    const definition = this.get(definitionId);
    let entity = createEngineeringEntity({
      id: instanceId,
      type: definition.type,
      name: overrides.name ?? definition.name,
      state: overrides.state ?? definition.defaultState,
      properties: clone(definition.properties),
      ports: clone(definition.ports),
      capabilities: clone(definition.capabilities),
      metadata: {
        ...clone(definition.metadata),
        componentDefinitionId: definition.definitionId,
        componentDefinitionVersion: definition.version,
        componentLibraryVersion: COMPONENT_LIBRARY_VERSION,
        componentDomain: definition.domain,
        productFamilies: [...definition.productFamilies],
        componentTags: [...definition.tags],
        provenance: "component-library",
        signature: COMPONENT_LIBRARY_SIGNATURE,
        ...(overrides.metadata ? clone(overrides.metadata) : {})
      },
      ...(overrides.parentId !== undefined ? { parentId: overrides.parentId } : {})
    });

    for (const [propertyId, value] of Object.entries(overrides.propertyValues ?? {})) {
      if (!entity.properties[propertyId]) throw new Error(`Unknown component property override: ${propertyId}`);
      entity = setEngineeringProperty(entity, propertyId, value);
    }

    if (overrides.portStates) {
      const ports = clone(entity.ports);
      for (const [portId, state] of Object.entries(overrides.portStates)) {
        const port = ports[portId];
        if (!port) throw new Error(`Unknown component port override: ${portId}`);
        ports[portId] = { ...port, state };
      }
      entity = { ...entity, ports };
    }
    return entity;
  }
}
