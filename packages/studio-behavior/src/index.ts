import type { EngineeringEntity, EntityId } from "../../engineering-core/src/index.js";
import type { EngineeringSession } from "../../engineering-session/src/index.js";
import {
  BehaviorRuntime,
  type BehaviorDefinition,
  type BehaviorEvaluation,
  type BehaviorSignalRef
} from "../../behavior-runtime/src/index.js";
import { runThermalStep, type ThermalStepResult } from "../../simulation-runtime/src/index.js";

export interface BehaviorDraft {
  readonly name: string;
  readonly signalEntityId: EntityId;
  readonly signalPropertyId: string;
  readonly operator: "gt" | "gte" | "lt" | "lte" | "eq";
  readonly threshold: number;
  readonly actionEntityId: EntityId;
  readonly capabilityId: string;
  readonly args?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface BehaviorExecutionRecord {
  readonly behaviorId: string;
  readonly observedValue: number;
  readonly threshold: number;
  readonly targetEntityId: EntityId;
  readonly capabilityId: string;
  readonly occurredAt: string;
  readonly message: string;
}

export interface TelemetryIngestResult {
  readonly entity: EngineeringEntity;
  readonly evaluations: readonly BehaviorEvaluation[];
  readonly executions: readonly BehaviorExecutionRecord[];
}

function replaceProperty(entity: EngineeringEntity, propertyId: string, value: string | number | boolean | null): EngineeringEntity {
  const property = entity.properties[propertyId];
  if (!property) throw new Error(`${entity.id} missing telemetry/control property ${propertyId}`);
  return {
    ...entity,
    properties: {
      ...entity.properties,
      [propertyId]: { ...property, value }
    }
  };
}

function hasCapability(entity: EngineeringEntity, capabilityId: string): boolean {
  return entity.capabilities.some((capability) => capability.id === capabilityId);
}

export class StudioBehaviorController {
  readonly runtime: BehaviorRuntime;
  readonly #executions: BehaviorExecutionRecord[] = [];
  #sequence = 0;

  constructor(readonly session: EngineeringSession) {
    this.runtime = new BehaviorRuntime(session.project.behaviors ?? []);
  }

  behaviors(): readonly BehaviorDefinition[] {
    return this.runtime.list();
  }

  executions(): readonly BehaviorExecutionRecord[] {
    return [...this.#executions];
  }

  registerDraft(draft: BehaviorDraft, authoredBy: BehaviorDefinition["authoredBy"] = "intelligence"): BehaviorDefinition {
    const signalEntity = this.session.getEntity(draft.signalEntityId);
    const actionEntity = this.session.getEntity(draft.actionEntityId);
    if (!signalEntity.properties[draft.signalPropertyId]) {
      throw new Error(`${signalEntity.id} does not expose property ${draft.signalPropertyId}`);
    }
    if (!hasCapability(actionEntity, draft.capabilityId)) {
      throw new Error(`${actionEntity.id} does not expose capability ${draft.capabilityId}`);
    }

    const signal: BehaviorSignalRef = {
      entityId: draft.signalEntityId,
      propertyId: draft.signalPropertyId
    };
    const behavior: BehaviorDefinition = {
      id: `behavior-${++this.#sequence}`,
      name: draft.name,
      enabled: true,
      trigger: { kind: "propertyChanged", signal },
      condition: {
        kind: "threshold",
        signal,
        operator: draft.operator,
        threshold: draft.threshold
      },
      action: {
        kind: "capability",
        targetEntityId: draft.actionEntityId,
        capabilityId: draft.capabilityId,
        ...(draft.args ? { args: draft.args } : {})
      },
      authoredBy,
      createdAt: new Date().toISOString()
    };

    this.runtime.register(behavior);
    this.session.events.record({
      id: `behavior-event-${this.session.events.list().length + 1}`,
      type: "BehaviorRegistered",
      occurredAt: behavior.createdAt,
      source: authoredBy === "intelligence" ? "ui" : "system",
      payload: {
        behaviorId: behavior.id,
        name: behavior.name,
        trigger: behavior.trigger,
        condition: behavior.condition,
        action: behavior.action,
        authoredBy
      }
    });
    return behavior;
  }

  async ingestTelemetry(
    entityId: EntityId,
    propertyId: string,
    value: string | number | boolean | null,
    source: "simulation" | "system" = "simulation"
  ): Promise<TelemetryIngestResult> {
    const before = this.session.getEntity(entityId);
    const after = replaceProperty(before, propertyId, value);
    this.session.graph.replaceEntity(after);
    const occurredAt = new Date().toISOString();
    this.session.events.record({
      id: `telemetry-event-${this.session.events.list().length + 1}`,
      type: "TelemetrySampled",
      occurredAt,
      source,
      payload: {
        entityId,
        propertyId,
        value,
        previousValue: before.properties[propertyId]?.value ?? null
      }
    });

    const evaluations = this.runtime.evaluateChange({
      signal: { entityId, propertyId },
      value
    });
    const executions: BehaviorExecutionRecord[] = [];
    for (const evaluation of evaluations) {
      if (evaluation.status !== "triggered" || !evaluation.action || evaluation.observedValue === null) continue;
      executions.push(this.#executeAction(evaluation));
    }
    return { entity: this.session.getEntity(entityId), evaluations, executions };
  }

  #executeAction(evaluation: BehaviorEvaluation): BehaviorExecutionRecord {
    const action = evaluation.action;
    if (!action) throw new Error("Triggered behavior is missing action");
    const target = this.session.getEntity(action.targetEntityId);
    if (!hasCapability(target, action.capabilityId)) {
      throw new Error(`${target.id} no longer exposes capability ${action.capabilityId}`);
    }

    if (action.capabilityId !== "setFanSpeed") {
      throw new Error(`Behavior capability ${action.capabilityId} is not executable in S1.7`);
    }
    const percent = action.args?.percent;
    if (typeof percent !== "number" || !Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw new Error("setFanSpeed requires percent between 0 and 100");
    }
    const updated = replaceProperty(target, "fanPercent", percent);
    this.session.graph.replaceEntity(updated);
    const occurredAt = new Date().toISOString();
    const record: BehaviorExecutionRecord = {
      behaviorId: evaluation.behaviorId,
      observedValue: evaluation.observedValue ?? 0,
      threshold: evaluation.threshold,
      targetEntityId: updated.id,
      capabilityId: action.capabilityId,
      occurredAt,
      message: `${updated.name}: fanPercent ajustado para ${percent}%.`
    };
    this.#executions.push(record);
    this.session.events.record({
      id: `behavior-event-${this.session.events.list().length + 1}`,
      type: "BehaviorTriggered",
      occurredAt,
      source: "automation",
      payload: {
        behaviorId: evaluation.behaviorId,
        observedValue: evaluation.observedValue,
        threshold: evaluation.threshold,
        action
      }
    });
    this.session.events.record({
      id: `control-event-${this.session.events.list().length + 1}`,
      type: "FanSpeedChanged",
      occurredAt,
      source: "automation",
      payload: {
        entityId: updated.id,
        fanPercent: percent,
        behaviorId: evaluation.behaviorId
      }
    });
    return record;
  }

  async simulateCpuThermalStep(): Promise<ThermalStepResult> {
    const cpu = this.session.getEntity("pc.cpu");
    const cooling = this.session.getEntity("pc.cooling");
    const temperatureC = cpu.properties.temperatureC?.value;
    const loadPercent = cpu.properties.loadPercent?.value;
    const fanPercent = cooling.properties.fanPercent?.value;
    if (typeof temperatureC !== "number" || typeof loadPercent !== "number" || typeof fanPercent !== "number") {
      throw new Error("Desktop thermal model requires CPU temperature/load and cooling fanPercent");
    }
    const result = runThermalStep({ temperatureC, loadPercent, fanPercent });
    await this.ingestTelemetry("pc.cpu", "temperatureC", result.nextTemperatureC, "simulation");
    return result;
  }
}
