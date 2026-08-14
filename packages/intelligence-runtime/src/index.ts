import type { EntityId } from "../../engineering-core/src/index.js";

export interface IntelligenceEntityDescriptor {
  readonly id: EntityId;
  readonly type: string;
  readonly name: string;
  readonly state: string;
  readonly capabilityIds: readonly string[];
  readonly propertyIds?: readonly string[];
  readonly aliases?: readonly string[];
}

export interface StudioIntelligenceContext {
  readonly entities: readonly IntelligenceEntityDescriptor[];
  readonly selectedEntityId?: EntityId | null;
  readonly lastEntityId?: EntityId | null;
}

export interface ThresholdBehaviorDraft {
  readonly name: string;
  readonly signalEntityId: EntityId;
  readonly signalPropertyId: string;
  readonly operator: "gt" | "gte" | "lt" | "lte" | "eq";
  readonly threshold: number;
  readonly actionEntityId: EntityId;
  readonly capabilityId: string;
  readonly args: Readonly<Record<string, string | number | boolean | null>>;
}

export type IntelligenceAction = "capability" | "focus" | "behavior";

export interface ResolvedStudioIntent {
  readonly status: "resolved";
  readonly utterance: string;
  readonly normalized: string;
  readonly action: IntelligenceAction;
  readonly targetEntityId: EntityId;
  readonly capabilityId?: string;
  readonly behaviorDraft?: ThresholdBehaviorDraft;
  readonly intent: string;
  readonly confidence: number;
  readonly rationale: string;
}

export interface UnresolvedStudioIntent {
  readonly status: "unresolved" | "ambiguous";
  readonly utterance: string;
  readonly normalized: string;
  readonly message: string;
  readonly candidates?: readonly EntityId[];
}

export type StudioIntentResolution = ResolvedStudioIntent | UnresolvedStudioIntent;

interface IntentRule {
  readonly intent: string;
  readonly capabilityId?: string;
  readonly action: Exclude<IntelligenceAction, "behavior">;
  readonly patterns: readonly string[];
  readonly preferredTypes?: readonly string[];
}

const INTENT_RULES: readonly IntentRule[] = [
  { intent: "why", capabilityId: "why", action: "capability", patterns: ["por que", "porque", "qual a causa", "o que aconteceu", "why"], preferredTypes: ["BootProcess"] },
  { intent: "insert", capabilityId: "insert", action: "capability", patterns: ["reinstale", "reinstalar", "recoloque", "coloque de volta", "instale de volta", "insert", "reinsert"] },
  { intent: "remove", capabilityId: "remove", action: "capability", patterns: ["remova", "remover", "retire", "tirar", "tire", "remove", "take out"] },
  { intent: "powerOn", capabilityId: "powerOn", action: "capability", patterns: ["ligue", "ligar", "inicie", "iniciar", "power on", "turn on", "start computer"], preferredTypes: ["Computer"] },
  { intent: "explode", capabilityId: "explode", action: "capability", patterns: ["exploda", "explodir", "vista explodida", "explode"], preferredTypes: ["Computer"] },
  { intent: "open", capabilityId: "open", action: "capability", patterns: ["abra", "abrir", "open"], preferredTypes: ["Computer"] },
  { intent: "inspect", capabilityId: "inspect", action: "capability", patterns: ["inspecione", "inspecionar", "detalhes", "inspect", "details"] },
  { intent: "explain", capabilityId: "explain", action: "capability", patterns: ["explique", "explicar", "como funciona", "o que e", "explain", "how does"] },
  { intent: "focus", action: "focus", patterns: ["mostre", "mostrar", "selecione", "foco", "show", "select", "focus"] }
];

const TYPE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  Computer: ["pc", "computador", "desktop", "gabinete", "computer"],
  Motherboard: ["placa mae", "placa-mae", "motherboard", "mainboard"],
  Processor: ["cpu", "processador", "processor"],
  MemoryModule: ["ram", "memoria ram", "memoria", "memory"],
  GraphicsCard: ["gpu", "placa de video", "placa grafica", "graphics card"],
  PowerSupply: ["fonte", "fonte de alimentacao", "psu", "power supply"],
  StorageDevice: ["ssd", "nvme", "armazenamento", "storage"],
  CoolingSystem: ["cooler", "refrigeracao", "ventoinha", "fan", "cooling"],
  BootProcess: ["boot", "inicializacao", "post", "processo de boot"]
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s%.,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aliasesFor(entity: IntelligenceEntityDescriptor): string[] {
  return [entity.name, entity.id, ...(TYPE_ALIASES[entity.type] ?? []), ...(entity.aliases ?? [])]
    .map(normalize)
    .filter((value, index, all) => value.length > 1 && all.indexOf(value) === index);
}

function ruleFor(normalized: string): IntentRule | null {
  return INTENT_RULES.find((rule) => rule.patterns.some((pattern) => normalized.includes(normalize(pattern)))) ?? null;
}

function explicitCandidates(normalized: string, entities: readonly IntelligenceEntityDescriptor[]): IntelligenceEntityDescriptor[] {
  return entities.filter((entity) => aliasesFor(entity).some((alias) => normalized.includes(alias)));
}

function supports(entity: IntelligenceEntityDescriptor, rule: IntentRule): boolean {
  return rule.action === "focus" || !rule.capabilityId || entity.capabilityIds.includes(rule.capabilityId);
}

function selectByContext(rule: IntentRule, context: StudioIntelligenceContext, normalized: string): IntelligenceEntityDescriptor[] {
  const explicit = explicitCandidates(normalized, context.entities).filter((entity) => supports(entity, rule));
  if (explicit.length > 0) return explicit;

  const deictic = /\b(isso|isto|essa|esse|esta|este|that|this)\b/.test(normalized);
  if (deictic && context.selectedEntityId) {
    const selected = context.entities.find((entity) => entity.id === context.selectedEntityId);
    if (selected && supports(selected, rule)) return [selected];
  }

  if (rule.preferredTypes?.length) {
    const preferred = context.entities.filter((entity) => rule.preferredTypes?.includes(entity.type) && supports(entity, rule));
    if (preferred.length > 0) {
      if (rule.intent === "why") {
        const faulted = preferred.filter((entity) => entity.state === "fault");
        if (faulted.length > 0) return faulted;
      }
      return preferred;
    }
  }

  if (context.selectedEntityId) {
    const selected = context.entities.find((entity) => entity.id === context.selectedEntityId);
    if (selected && supports(selected, rule)) return [selected];
  }

  if (context.lastEntityId) {
    const last = context.entities.find((entity) => entity.id === context.lastEntityId);
    if (last && supports(last, rule)) return [last];
  }

  return context.entities.filter((entity) => supports(entity, rule));
}

function numericValue(normalized: string): number | null {
  const match = normalized.match(/\b(\d{1,3}(?:[.,]\d+)?)\b/);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function resolveThresholdBehavior(
  utterance: string,
  normalized: string,
  context: StudioIntelligenceContext
): StudioIntentResolution | null {
  if (!/\b(quando|sempre que|if|when)\b/.test(normalized)) return null;
  const temperatureIntent = /\b(temperatura|graus|temperature|cpu)\b/.test(normalized);
  const fanIntent = /\b(ventoinha|fan|cooler|refrigeracao)\b/.test(normalized);
  if (!temperatureIntent || !fanIntent) {
    return {
      status: "unresolved",
      utterance,
      normalized,
      message: "A S1.7 reconhece comportamentos de limiar quando sinal, condição e atuador estão explícitos."
    };
  }

  const threshold = numericValue(normalized);
  if (threshold === null) {
    return { status: "unresolved", utterance, normalized, message: "Informe o limiar numérico da temperatura." };
  }
  const cpuCandidates = context.entities.filter(
    (entity) => entity.type === "Processor" && entity.propertyIds?.includes("temperatureC")
  );
  const coolingCandidates = context.entities.filter(
    (entity) => entity.type === "CoolingSystem" &&
      entity.propertyIds?.includes("fanPercent") &&
      entity.capabilityIds.includes("setFanSpeed")
  );
  if (cpuCandidates.length !== 1 || coolingCandidates.length !== 1) {
    return {
      status: cpuCandidates.length > 1 || coolingCandidates.length > 1 ? "ambiguous" : "unresolved",
      utterance,
      normalized,
      message: "Não existe um único par CPU/refrigeração compatível para materializar esse comportamento.",
      ...(cpuCandidates.length + coolingCandidates.length > 1
        ? { candidates: [...cpuCandidates, ...coolingCandidates].map((entity) => entity.id) }
        : {})
    };
  }

  const maximum = /\b(maximo|maxima|max|100\s*%)\b/.test(normalized);
  const percentages = [...normalized.matchAll(/(\d{1,3})\s*%/g)].map((match) => Number(match[1]));
  const requestedPercent = maximum ? 100 : percentages.at(-1) ?? null;
  if (requestedPercent === null || requestedPercent < 0 || requestedPercent > 100) {
    return { status: "unresolved", utterance, normalized, message: "Informe a velocidade da ventoinha em porcentagem ou diga máximo." };
  }

  const operator = /\b(pelo menos|no minimo|at least)\b/.test(normalized) ? "gte" as const : "gt" as const;
  const cpu = cpuCandidates[0]!;
  const cooling = coolingCandidates[0]!;
  const behaviorDraft: ThresholdBehaviorDraft = {
    name: `CPU > ${threshold}°C → Fan ${requestedPercent}%`,
    signalEntityId: cpu.id,
    signalPropertyId: "temperatureC",
    operator,
    threshold,
    actionEntityId: cooling.id,
    capabilityId: "setFanSpeed",
    args: { percent: requestedPercent }
  };

  return {
    status: "resolved",
    utterance,
    normalized,
    action: "behavior",
    targetEntityId: cpu.id,
    behaviorDraft,
    intent: "createThresholdBehavior",
    confidence: 0.98,
    rationale: `${cpu.name}.temperatureC é observado e ${cooling.name}.setFanSpeed é o atuador compatível.`
  };
}

export function resolveStudioIntent(utterance: string, context: StudioIntelligenceContext): StudioIntentResolution {
  const normalized = normalize(utterance);
  if (!normalized) return { status: "unresolved", utterance, normalized, message: "Nenhum comando foi informado." };

  const behaviorResolution = resolveThresholdBehavior(utterance, normalized, context);
  if (behaviorResolution) return behaviorResolution;

  const rule = ruleFor(normalized);
  if (!rule) return { status: "unresolved", utterance, normalized, message: "Ainda não reconheço essa intenção como uma ação do Studio." };

  const candidates = selectByContext(rule, context, normalized);
  if (candidates.length === 0) {
    return {
      status: "unresolved",
      utterance,
      normalized,
      message: rule.capabilityId ? `Nenhuma entidade disponível expõe a capability ${rule.capabilityId}.` : "Nenhuma entidade corresponde ao comando."
    };
  }

  if (candidates.length > 1) {
    return {
      status: "ambiguous",
      utterance,
      normalized,
      message: "O comando corresponde a mais de uma entidade; selecione ou nomeie o alvo.",
      candidates: candidates.map((entity) => entity.id)
    };
  }

  const target = candidates[0]!;
  return {
    status: "resolved",
    utterance,
    normalized,
    action: rule.action,
    targetEntityId: target.id,
    ...(rule.capabilityId ? { capabilityId: rule.capabilityId } : {}),
    intent: rule.intent,
    confidence: explicitCandidates(normalized, [target]).length > 0 ? 1 : 0.86,
    rationale: rule.capabilityId ? `${target.name} expõe ${rule.capabilityId} e corresponde ao contexto atual.` : `${target.name} corresponde ao alvo espacial solicitado.`
  };
}
