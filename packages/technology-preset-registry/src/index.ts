export const TECHNOLOGY_PRESET_REGISTRY_VERSION = "1" as const;
export const TECHNOLOGY_PRESET_REGISTRY_SIGNATURE = "Tehkné Solutions" as const;

export type TechnologyPresetRuntimeAdapter = "desktop" | "arm" | "smartphone" | "notebook" | "tablet" | "tv";
export type TechnologyPresetStatus = "alpha-ready";

export interface TechnologyPresetDefinition {
  readonly presetId: string;
  readonly version: typeof TECHNOLOGY_PRESET_REGISTRY_VERSION;
  readonly signature: typeof TECHNOLOGY_PRESET_REGISTRY_SIGNATURE;
  readonly displayName: string;
  readonly launcherLabel: string;
  readonly restoreLabel: string;
  readonly projectId: string;
  readonly rootEntityId: string;
  readonly productFamily: string;
  readonly runtimeAdapter: TechnologyPresetRuntimeAdapter;
  readonly persistenceKey: TechnologyPresetRuntimeAdapter;
  readonly routeAliases: readonly string[];
  readonly sourcePath: string;
  readonly status: TechnologyPresetStatus;
}

export interface TechnologyPresetManifest {
  readonly registryId: string;
  readonly registryVersion: typeof TECHNOLOGY_PRESET_REGISTRY_VERSION;
  readonly signature: typeof TECHNOLOGY_PRESET_REGISTRY_SIGNATURE;
  readonly presets: readonly TechnologyPresetDefinition[];
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Technology Preset Registry ${label} is required`);
  return value.trim();
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const runtimeAdapters = new Set<TechnologyPresetRuntimeAdapter>([
  "desktop", "arm", "smartphone", "notebook", "tablet", "tv"
]);

export function parseTechnologyPresetManifest(input: unknown): TechnologyPresetManifest {
  if (!record(input)) throw new Error("Technology Preset Registry manifest must be an object");
  const registryId = requiredString(input.registryId, "registryId");
  if (input.registryVersion !== TECHNOLOGY_PRESET_REGISTRY_VERSION) {
    throw new Error(`Unsupported Technology Preset Registry version: ${String(input.registryVersion)}`);
  }
  if (input.signature !== TECHNOLOGY_PRESET_REGISTRY_SIGNATURE) {
    throw new Error("Technology Preset Registry signature must be Tehkné Solutions");
  }
  if (!Array.isArray(input.presets) || input.presets.length === 0) {
    throw new Error("Technology Preset Registry requires at least one preset");
  }

  const presets: TechnologyPresetDefinition[] = [];
  const ids = new Set<string>();
  const projectIds = new Set<string>();
  const adapters = new Set<string>();
  const aliases = new Map<string, string>();

  for (const [index, candidate] of input.presets.entries()) {
    if (!record(candidate)) throw new Error(`Technology Preset Registry preset[${index}] must be an object`);
    const presetId = requiredString(candidate.presetId, `preset[${index}].presetId`);
    const projectId = requiredString(candidate.projectId, `${presetId}.projectId`);
    const runtimeAdapter = requiredString(candidate.runtimeAdapter, `${presetId}.runtimeAdapter`) as TechnologyPresetRuntimeAdapter;
    const persistenceKey = requiredString(candidate.persistenceKey, `${presetId}.persistenceKey`) as TechnologyPresetRuntimeAdapter;
    if (candidate.version !== TECHNOLOGY_PRESET_REGISTRY_VERSION) throw new Error(`${presetId} version must be ${TECHNOLOGY_PRESET_REGISTRY_VERSION}`);
    if (candidate.signature !== TECHNOLOGY_PRESET_REGISTRY_SIGNATURE) throw new Error(`${presetId} signature must be Tehkné Solutions`);
    if (!runtimeAdapters.has(runtimeAdapter)) throw new Error(`${presetId} uses unsupported runtimeAdapter: ${runtimeAdapter}`);
    if (persistenceKey !== runtimeAdapter) throw new Error(`${presetId} persistenceKey must match runtimeAdapter`);
    if (candidate.status !== "alpha-ready") throw new Error(`${presetId} status must be alpha-ready`);
    if (!Array.isArray(candidate.routeAliases) || candidate.routeAliases.length === 0) throw new Error(`${presetId} requires routeAliases`);
    if (ids.has(presetId)) throw new Error(`Technology Preset Registry repeats presetId: ${presetId}`);
    if (projectIds.has(projectId)) throw new Error(`Technology Preset Registry repeats projectId: ${projectId}`);
    if (adapters.has(runtimeAdapter)) throw new Error(`Technology Preset Registry repeats runtimeAdapter: ${runtimeAdapter}`);
    ids.add(presetId);
    projectIds.add(projectId);
    adapters.add(runtimeAdapter);

    const routeAliases = candidate.routeAliases.map((alias, aliasIndex) => requiredString(alias, `${presetId}.routeAliases[${aliasIndex}]`));
    for (const alias of routeAliases) {
      const normalized = normalize(alias);
      const owner = aliases.get(normalized);
      if (owner && owner !== presetId) throw new Error(`Technology Preset Registry route alias collision: ${alias} (${owner} / ${presetId})`);
      aliases.set(normalized, presetId);
    }

    presets.push({
      presetId,
      version: TECHNOLOGY_PRESET_REGISTRY_VERSION,
      signature: TECHNOLOGY_PRESET_REGISTRY_SIGNATURE,
      displayName: requiredString(candidate.displayName, `${presetId}.displayName`),
      launcherLabel: requiredString(candidate.launcherLabel, `${presetId}.launcherLabel`),
      restoreLabel: requiredString(candidate.restoreLabel, `${presetId}.restoreLabel`),
      projectId,
      rootEntityId: requiredString(candidate.rootEntityId, `${presetId}.rootEntityId`),
      productFamily: requiredString(candidate.productFamily, `${presetId}.productFamily`),
      runtimeAdapter,
      persistenceKey,
      routeAliases,
      sourcePath: requiredString(candidate.sourcePath, `${presetId}.sourcePath`),
      status: "alpha-ready"
    });
  }

  return {
    registryId,
    registryVersion: TECHNOLOGY_PRESET_REGISTRY_VERSION,
    signature: TECHNOLOGY_PRESET_REGISTRY_SIGNATURE,
    presets
  };
}

export class TechnologyPresetRegistry {
  readonly manifest: TechnologyPresetManifest;
  readonly #byId: Map<string, TechnologyPresetDefinition>;
  readonly #byAdapter: Map<TechnologyPresetRuntimeAdapter, TechnologyPresetDefinition>;
  readonly #aliases: readonly { readonly normalized: string; readonly preset: TechnologyPresetDefinition }[];

  constructor(input: unknown) {
    this.manifest = parseTechnologyPresetManifest(input);
    this.#byId = new Map(this.manifest.presets.map((preset) => [preset.presetId, preset]));
    this.#byAdapter = new Map(this.manifest.presets.map((preset) => [preset.runtimeAdapter, preset]));
    this.#aliases = this.manifest.presets
      .flatMap((preset) => preset.routeAliases.map((alias) => ({ normalized: normalize(alias), preset })))
      .sort((left, right) => right.normalized.length - left.normalized.length);
  }

  list(): readonly TechnologyPresetDefinition[] {
    return [...this.manifest.presets];
  }

  get(presetId: string): TechnologyPresetDefinition {
    const preset = this.#byId.get(presetId);
    if (!preset) throw new Error(`Unknown Technology Preset: ${presetId}`);
    return preset;
  }

  getByAdapter(adapter: TechnologyPresetRuntimeAdapter): TechnologyPresetDefinition {
    const preset = this.#byAdapter.get(adapter);
    if (!preset) throw new Error(`Unknown Technology Preset runtime adapter: ${adapter}`);
    return preset;
  }

  resolveUtterance(utterance: string): TechnologyPresetDefinition | null {
    const normalizedUtterance = ` ${normalize(utterance)} `;
    for (const candidate of this.#aliases) {
      if (normalizedUtterance.includes(` ${candidate.normalized} `)) return candidate.preset;
    }
    return null;
  }
}
