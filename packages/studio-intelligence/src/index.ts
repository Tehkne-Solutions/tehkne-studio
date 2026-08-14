import type { EntityId } from "../../engineering-core/src/index.js";
import type { StudioCommand } from "../../command-bus/src/index.js";
import {
  EngineeringSession,
  type CapabilityExecutionResult
} from "../../engineering-session/src/index.js";
import {
  resolveStudioIntent,
  type IntelligenceEntityDescriptor,
  type StudioIntentResolution,
  type ThresholdBehaviorDraft
} from "../../intelligence-runtime/src/index.js";

export interface RegisteredBehaviorSummary {
  readonly id: string;
  readonly name: string;
}

export interface StudioBehaviorRegistrar {
  registerDraft(draft: ThresholdBehaviorDraft): RegisteredBehaviorSummary;
}

export interface RobotTaskSummary {
  readonly taskId: string;
  readonly robotEntityId: EntityId;
  readonly targetEntityId: EntityId;
  readonly message: string;
}

export interface StudioRobotTaskExecutor {
  executePick(targetEntityId: EntityId): RobotTaskSummary;
}

export interface StudioIntelligenceExecution {
  readonly utterance: string;
  readonly resolution: StudioIntentResolution;
  readonly executed: boolean;
  readonly targetEntityId?: EntityId;
  readonly result?: CapabilityExecutionResult;
  readonly behavior?: RegisteredBehaviorSummary;
  readonly robotTask?: RobotTaskSummary;
  readonly message: string;
}

export interface ExecuteUtteranceOptions {
  readonly selectedEntityId?: EntityId | null;
  readonly lastEntityId?: EntityId | null;
  readonly source?: Extract<StudioCommand["source"], "ui" | "voice">;
}

function descriptor(entity: ReturnType<EngineeringSession["getEntity"]>): IntelligenceEntityDescriptor {
  const authoredAliases = entity.metadata.voiceAliases;
  return {
    id: entity.id,
    type: entity.type,
    name: entity.name,
    state: entity.state,
    capabilityIds: entity.capabilities.map((capability) => capability.id),
    propertyIds: Object.keys(entity.properties),
    ...(Array.isArray(authoredAliases) && authoredAliases.every((item) => typeof item === "string")
      ? { aliases: authoredAliases as string[] }
      : {})
  };
}

export class StudioIntelligence {
  constructor(
    readonly session: EngineeringSession,
    readonly behaviorRegistrar?: StudioBehaviorRegistrar,
    readonly robotTaskExecutor?: StudioRobotTaskExecutor
  ) {}

  entities(): readonly IntelligenceEntityDescriptor[] {
    return this.session.graph.snapshot().entities.map(descriptor);
  }

  async executeUtterance(
    utterance: string,
    options: ExecuteUtteranceOptions = {}
  ): Promise<StudioIntelligenceExecution> {
    const source = options.source ?? "ui";
    const resolution = resolveStudioIntent(utterance, {
      entities: this.entities(),
      selectedEntityId: options.selectedEntityId ?? null,
      lastEntityId: options.lastEntityId ?? null
    });

    if (resolution.status !== "resolved") {
      this.session.events.record({
        id: `intelligence-event-${this.session.events.list().length + 1}`,
        type: resolution.status === "ambiguous" ? "IntentAmbiguous" : "IntentUnresolved",
        occurredAt: new Date().toISOString(),
        source,
        payload: {
          utterance,
          normalized: resolution.normalized,
          message: resolution.message,
          ...(resolution.candidates ? { candidates: resolution.candidates } : {})
        }
      });
      return {
        utterance,
        resolution,
        executed: false,
        message: resolution.message
      };
    }

    this.session.events.record({
      id: `intelligence-event-${this.session.events.list().length + 1}`,
      type: "IntentResolved",
      occurredAt: new Date().toISOString(),
      source,
      payload: {
        utterance,
        normalized: resolution.normalized,
        intent: resolution.intent,
        targetEntityId: resolution.targetEntityId,
        capabilityId: resolution.capabilityId ?? null,
        confidence: resolution.confidence,
        action: resolution.action
      }
    });

    if (resolution.action === "robotTask") {
      if (!resolution.robotTaskDraft || resolution.robotTaskDraft.kind !== "pick") {
        return {
          utterance,
          resolution,
          executed: false,
          targetEntityId: resolution.targetEntityId,
          message: "A intenção robótica não contém uma tarefa materializável."
        };
      }
      if (!this.robotTaskExecutor) {
        return {
          utterance,
          resolution,
          executed: false,
          targetEntityId: resolution.targetEntityId,
          message: "O Robotics Runtime não está disponível nesta sessão."
        };
      }
      try {
        const robotTask = this.robotTaskExecutor.executePick(resolution.robotTaskDraft.targetEntityId);
        return {
          utterance,
          resolution,
          executed: true,
          targetEntityId: robotTask.robotEntityId,
          robotTask,
          message: robotTask.message
        };
      } catch (error) {
        return {
          utterance,
          resolution,
          executed: false,
          targetEntityId: resolution.targetEntityId,
          message: error instanceof Error ? error.message : "Não foi possível executar a tarefa robótica."
        };
      }
    }

    if (resolution.action === "behavior") {
      if (!resolution.behaviorDraft) {
        return {
          utterance,
          resolution,
          executed: false,
          targetEntityId: resolution.targetEntityId,
          message: "A intenção de comportamento não contém Behavior IR materializável."
        };
      }
      if (!this.behaviorRegistrar) {
        return {
          utterance,
          resolution,
          executed: false,
          targetEntityId: resolution.targetEntityId,
          message: "O Behavior Runtime não está disponível nesta sessão."
        };
      }
      try {
        const behavior = this.behaviorRegistrar.registerDraft(resolution.behaviorDraft);
        return {
          utterance,
          resolution,
          executed: true,
          targetEntityId: resolution.targetEntityId,
          behavior,
          message: `Comportamento criado: ${behavior.name}.`
        };
      } catch (error) {
        return {
          utterance,
          resolution,
          executed: false,
          targetEntityId: resolution.targetEntityId,
          message: error instanceof Error ? error.message : "Não foi possível registrar o comportamento."
        };
      }
    }

    if (resolution.action === "focus") {
      const target = this.session.getEntity(resolution.targetEntityId);
      return {
        utterance,
        resolution,
        executed: true,
        targetEntityId: target.id,
        message: `Foco em ${target.name}.`
      };
    }

    if (!resolution.capabilityId) {
      return {
        utterance,
        resolution,
        executed: false,
        targetEntityId: resolution.targetEntityId,
        message: "A intenção foi resolvida, mas nenhuma capability foi associada."
      };
    }

    const command = await this.session.executeCapability(
      resolution.targetEntityId,
      resolution.capabilityId,
      source
    );
    if (!command.ok || !command.result) {
      return {
        utterance,
        resolution,
        executed: false,
        targetEntityId: resolution.targetEntityId,
        message: command.error ?? "A capability não pôde ser executada."
      };
    }

    return {
      utterance,
      resolution,
      executed: true,
      targetEntityId: command.result.focusEntityId ?? command.result.entity.id,
      result: command.result,
      message: command.result.message
    };
  }
}
