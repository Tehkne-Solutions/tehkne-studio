export type BootStage =
  | "POWERING"
  | "POST"
  | "MEMORY_CHECK"
  | "STORAGE_CHECK"
  | "BOOT"
  | "RUNNING"
  | "FAULT";

export interface BootDependencyInput {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly available: boolean;
  readonly reason: string;
}

export interface BootTimelineStep {
  readonly stage: BootStage;
  readonly outcome: "pass" | "fail";
  readonly dependencyIds: readonly string[];
}

export interface BootFault {
  readonly entityId: string;
  readonly entityName: string;
  readonly entityType: string;
  readonly stage: BootStage;
  readonly code: string;
  readonly reason: string;
}

export interface BootRunResult {
  readonly status: "success" | "failure";
  readonly finalStage: BootStage;
  readonly timeline: readonly BootTimelineStep[];
  readonly fault: BootFault | null;
}

const PHASES: readonly BootStage[] = ["POST", "MEMORY_CHECK", "STORAGE_CHECK"];

function stageForDependency(type: string): BootStage {
  if (type === "MemoryModule") return "MEMORY_CHECK";
  if (type === "StorageDevice") return "STORAGE_CHECK";
  return "POST";
}

function codeForDependency(type: string): string {
  if (type === "MemoryModule") return "MEMORY_UNAVAILABLE";
  if (type === "StorageDevice") return "BOOT_MEDIA_UNAVAILABLE";
  if (type === "Processor") return "CPU_UNAVAILABLE";
  if (type === "Motherboard") return "PLATFORM_UNAVAILABLE";
  return "DEPENDENCY_UNAVAILABLE";
}

export function runFunctionalBoot(dependencies: readonly BootDependencyInput[]): BootRunResult {
  const timeline: BootTimelineStep[] = [
    { stage: "POWERING", outcome: "pass", dependencyIds: [] }
  ];

  for (const stage of PHASES) {
    const stageDependencies = dependencies.filter(
      (dependency) => stageForDependency(dependency.type) === stage
    );
    const unavailable = stageDependencies.find((dependency) => !dependency.available);

    if (unavailable) {
      timeline.push({
        stage,
        outcome: "fail",
        dependencyIds: stageDependencies.map((dependency) => dependency.id)
      });
      timeline.push({ stage: "FAULT", outcome: "fail", dependencyIds: [unavailable.id] });
      return {
        status: "failure",
        finalStage: "FAULT",
        timeline,
        fault: {
          entityId: unavailable.id,
          entityName: unavailable.name,
          entityType: unavailable.type,
          stage,
          code: codeForDependency(unavailable.type),
          reason: unavailable.reason
        }
      };
    }

    timeline.push({
      stage,
      outcome: "pass",
      dependencyIds: stageDependencies.map((dependency) => dependency.id)
    });
  }

  timeline.push({ stage: "BOOT", outcome: "pass", dependencyIds: [] });
  timeline.push({ stage: "RUNNING", outcome: "pass", dependencyIds: [] });

  return {
    status: "success",
    finalStage: "RUNNING",
    timeline,
    fault: null
  };
}
