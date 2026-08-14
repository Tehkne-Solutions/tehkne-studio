import type { EntityId } from "../../engineering-core/src/index.js";

export type BehaviorComparisonOperator = "gt" | "gte" | "lt" | "lte" | "eq";

export interface BehaviorSignalRef {
  readonly entityId: EntityId;
  readonly propertyId: string;
}

export interface BehaviorTrigger {
  readonly kind: "propertyChanged";
  readonly signal: BehaviorSignalRef;
}

export interface BehaviorThresholdCondition {
  readonly kind: "threshold";
  readonly signal: BehaviorSignalRef;
  readonly operator: BehaviorComparisonOperator;
  readonly threshold: number;
}

export interface BehaviorCapabilityAction {
  readonly kind: "capability";
  readonly targetEntityId: EntityId;
  readonly capabilityId: string;
  readonly args?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface BehaviorDefinition {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly trigger: BehaviorTrigger;
  readonly condition: BehaviorThresholdCondition;
  readonly action: BehaviorCapabilityAction;
  readonly authoredBy: "studio" | "user" | "intelligence";
  readonly createdAt: string;
}

export interface BehaviorEvaluation {
  readonly behaviorId: string;
  readonly status: "triggered" | "not_triggered" | "disabled" | "unavailable";
  readonly observedValue: number | null;
  readonly threshold: number;
  readonly operator: BehaviorComparisonOperator;
  readonly action: BehaviorCapabilityAction | null;
}

export interface BehaviorSignalChange {
  readonly signal: BehaviorSignalRef;
  readonly value: string | number | boolean | null;
}

function sameSignal(left: BehaviorSignalRef, right: BehaviorSignalRef): boolean {
  return left.entityId === right.entityId && left.propertyId === right.propertyId;
}

function compare(value: number, operator: BehaviorComparisonOperator, threshold: number): boolean {
  if (operator === "gt") return value > threshold;
  if (operator === "gte") return value >= threshold;
  if (operator === "lt") return value < threshold;
  if (operator === "lte") return value <= threshold;
  return value === threshold;
}

export class BehaviorRuntime {
  readonly #behaviors = new Map<string, BehaviorDefinition>();

  constructor(initial: readonly BehaviorDefinition[] = []) {
    for (const behavior of initial) this.register(behavior);
  }

  register(behavior: BehaviorDefinition): BehaviorDefinition {
    if (!behavior.id.trim()) throw new Error("Behavior id is required");
    if (this.#behaviors.has(behavior.id)) throw new Error(`Behavior already registered: ${behavior.id}`);
    if (behavior.trigger.signal.entityId !== behavior.condition.signal.entityId ||
        behavior.trigger.signal.propertyId !== behavior.condition.signal.propertyId) {
      throw new Error("Behavior trigger and condition must observe the same signal in S1.7");
    }
    this.#behaviors.set(behavior.id, behavior);
    return behavior;
  }

  list(): readonly BehaviorDefinition[] {
    return [...this.#behaviors.values()];
  }

  get(id: string): BehaviorDefinition {
    const behavior = this.#behaviors.get(id);
    if (!behavior) throw new Error(`Unknown behavior: ${id}`);
    return behavior;
  }

  evaluateChange(change: BehaviorSignalChange): readonly BehaviorEvaluation[] {
    return this.list()
      .filter((behavior) => sameSignal(behavior.trigger.signal, change.signal))
      .map((behavior) => {
        const observedValue = typeof change.value === "number" && Number.isFinite(change.value)
          ? change.value
          : null;
        if (!behavior.enabled) {
          return {
            behaviorId: behavior.id,
            status: "disabled" as const,
            observedValue,
            threshold: behavior.condition.threshold,
            operator: behavior.condition.operator,
            action: null
          };
        }
        if (observedValue === null) {
          return {
            behaviorId: behavior.id,
            status: "unavailable" as const,
            observedValue,
            threshold: behavior.condition.threshold,
            operator: behavior.condition.operator,
            action: null
          };
        }
        const triggered = compare(observedValue, behavior.condition.operator, behavior.condition.threshold);
        return {
          behaviorId: behavior.id,
          status: triggered ? "triggered" as const : "not_triggered" as const,
          observedValue,
          threshold: behavior.condition.threshold,
          operator: behavior.condition.operator,
          action: triggered ? behavior.action : null
        };
      });
  }
}
