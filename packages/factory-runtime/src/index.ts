export type ManufacturingStrategy = "make" | "buy" | "wire" | "assemble" | "program" | "test";
export type ManufacturingReadiness = "conceptual" | "specified-functional-envelope" | "planned";

export interface ManufacturingItem {
  readonly id: string;
  readonly entityId?: string;
  readonly name: string;
  readonly strategy: ManufacturingStrategy;
  readonly quantity: number;
  readonly material?: string;
  readonly process?: string;
  readonly estimatedUnitCostBrl: number;
  readonly provenance: "authored-estimate" | "variant-profile" | "studio" | "simulation-derived";
  readonly readiness: ManufacturingReadiness;
}

export interface AssemblyStep {
  readonly id: string;
  readonly order: number;
  readonly label: string;
  readonly requires: readonly string[];
  readonly validation: string;
}

export interface AcceptanceTest {
  readonly id: string;
  readonly label: string;
  readonly evidence: string;
}

export interface PrototypeManufacturingProfile {
  readonly profileId: string;
  readonly projectId: string;
  readonly variantId: string;
  readonly revision: string;
  readonly readiness: "prototype-plan";
  readonly items: readonly ManufacturingItem[];
  readonly assemblySteps: readonly AssemblyStep[];
  readonly calibration: readonly string[];
  readonly acceptanceTests: readonly AcceptanceTest[];
  readonly knownLimitations: readonly string[];
  readonly signature: "Tehkné Solutions";
}

export interface BomLine extends ManufacturingItem {
  readonly estimatedLineCostBrl: number;
}

export interface PrototypePackageManifest {
  readonly packageId: string;
  readonly projectId: string;
  readonly variantId: string;
  readonly revision: string;
  readonly generatedAt: string;
  readonly readiness: "prototype-plan";
  readonly fabricationReady: false;
  readonly bom: readonly BomLine[];
  readonly estimatedBomCostBrl: number;
  readonly strategyCounts: Readonly<Record<ManufacturingStrategy, number>>;
  readonly assemblySteps: readonly AssemblyStep[];
  readonly calibration: readonly string[];
  readonly acceptanceTests: readonly AcceptanceTest[];
  readonly knownLimitations: readonly string[];
  readonly signature: "Tehkné Solutions";
}

const STRATEGIES: readonly ManufacturingStrategy[] = ["make", "buy", "wire", "assemble", "program", "test"];

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function validateManufacturingProfile(profile: PrototypeManufacturingProfile): void {
  if (!profile.profileId || !profile.projectId || !profile.variantId || !profile.revision) {
    throw new Error("Manufacturing profile identity is incomplete");
  }
  if (profile.signature !== "Tehkné Solutions") throw new Error("Official manufacturing profile signature missing");
  if (profile.readiness !== "prototype-plan") throw new Error("S1.11 profile must not claim fabrication readiness");
  if (profile.items.length === 0) throw new Error("Manufacturing profile has no items");

  const ids = new Set<string>();
  for (const item of profile.items) {
    if (ids.has(item.id)) throw new Error(`Duplicate manufacturing item ${item.id}`);
    ids.add(item.id);
    if (!STRATEGIES.includes(item.strategy)) throw new Error(`Unsupported manufacturing strategy ${item.strategy}`);
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw new Error(`${item.id} quantity must be a positive integer`);
    if (!Number.isFinite(item.estimatedUnitCostBrl) || item.estimatedUnitCostBrl < 0) {
      throw new Error(`${item.id} cost must be a finite non-negative estimate`);
    }
  }

  for (const strategy of STRATEGIES) {
    if (!profile.items.some((item) => item.strategy === strategy)) {
      throw new Error(`Manufacturing strategy missing from prototype plan: ${strategy}`);
    }
  }

  for (const step of profile.assemblySteps) {
    for (const requiredId of step.requires) {
      if (!ids.has(requiredId)) throw new Error(`${step.id} references missing manufacturing item ${requiredId}`);
    }
  }

  if (!profile.knownLimitations.some((item) => item.includes("No manufacturing-grade CAD"))) {
    throw new Error("Prototype plan must explicitly disclose missing manufacturing-grade CAD");
  }
  if (!profile.knownLimitations.some((item) => item.includes("Simulation evidence does not count as physical"))) {
    throw new Error("Prototype plan must separate simulation from physical acceptance evidence");
  }
}

export function generatePrototypePackage(profile: PrototypeManufacturingProfile, generatedAt: string): PrototypePackageManifest {
  validateManufacturingProfile(profile);
  const bom = profile.items.map((item) => ({
    ...item,
    estimatedLineCostBrl: roundMoney(item.quantity * item.estimatedUnitCostBrl)
  }));
  const estimatedBomCostBrl = roundMoney(bom.reduce((total, item) => total + item.estimatedLineCostBrl, 0));
  const strategyCounts = Object.fromEntries(
    STRATEGIES.map((strategy) => [strategy, profile.items.filter((item) => item.strategy === strategy).length])
  ) as Record<ManufacturingStrategy, number>;

  return {
    packageId: `${profile.projectId}-${profile.variantId.split("/").at(-1)}-${profile.revision}`,
    projectId: profile.projectId,
    variantId: profile.variantId,
    revision: profile.revision,
    generatedAt,
    readiness: "prototype-plan",
    fabricationReady: false,
    bom,
    estimatedBomCostBrl,
    strategyCounts,
    assemblySteps: [...profile.assemblySteps].sort((a, b) => a.order - b.order),
    calibration: profile.calibration,
    acceptanceTests: profile.acceptanceTests,
    knownLimitations: profile.knownLimitations,
    signature: profile.signature
  };
}
