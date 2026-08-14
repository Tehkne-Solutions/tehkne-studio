export type ReleaseEvidenceStatus = "pass" | "fail";
export type ReleaseEvidenceSource = "domain-test" | "simulation" | "build";

export interface AlphaReleaseManifest {
  readonly releaseId: string;
  readonly version: string;
  readonly channel: "alpha";
  readonly name: string;
  readonly requiredEvidenceIds: readonly string[];
  readonly releasePolicy: {
    readonly productionReady: false;
    readonly physicalPrototypeReady: false;
    readonly mockEvidenceAccepted: false;
    readonly simulationCountsAsPhysicalEvidence: false;
  };
  readonly knownLimitations: readonly string[];
  readonly signature: "Tehkné Solutions";
}

export interface ReleaseEvidenceRecord {
  readonly id: string;
  readonly status: ReleaseEvidenceStatus;
  readonly source: ReleaseEvidenceSource;
  readonly summary: string;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface AlphaReleaseEvaluation {
  readonly releaseId: string;
  readonly version: string;
  readonly status: "alpha-ready" | "blocked";
  readonly productionReady: false;
  readonly physicalPrototypeReady: false;
  readonly passedEvidenceIds: readonly string[];
  readonly missingEvidenceIds: readonly string[];
  readonly failedEvidenceIds: readonly string[];
  readonly limitations: readonly string[];
  readonly signature: "Tehkné Solutions";
}

export function validateAlphaManifest(manifest: AlphaReleaseManifest): void {
  if (!manifest.releaseId || !manifest.version || manifest.channel !== "alpha") {
    throw new Error("Alpha release manifest identity is incomplete");
  }
  if (manifest.signature !== "Tehkné Solutions") throw new Error("Alpha release signature missing");
  if (manifest.releasePolicy.productionReady !== false) throw new Error("Alpha 01 must not claim production readiness");
  if (manifest.releasePolicy.physicalPrototypeReady !== false) throw new Error("Alpha 01 must not claim physical prototype readiness");
  if (manifest.releasePolicy.mockEvidenceAccepted !== false) throw new Error("Alpha 01 must reject mock evidence");
  if (manifest.releasePolicy.simulationCountsAsPhysicalEvidence !== false) {
    throw new Error("Alpha 01 must keep simulated and physical evidence separate");
  }
  if (manifest.requiredEvidenceIds.length === 0) throw new Error("Alpha release has no required evidence");
  if (new Set(manifest.requiredEvidenceIds).size !== manifest.requiredEvidenceIds.length) {
    throw new Error("Alpha release contains duplicate evidence requirements");
  }
}

export function evaluateAlphaRelease(
  manifest: AlphaReleaseManifest,
  evidence: readonly ReleaseEvidenceRecord[]
): AlphaReleaseEvaluation {
  validateAlphaManifest(manifest);
  const byId = new Map<string, ReleaseEvidenceRecord>();
  for (const record of evidence) {
    if (byId.has(record.id)) throw new Error(`Duplicate release evidence ${record.id}`);
    byId.set(record.id, record);
  }

  const missingEvidenceIds = manifest.requiredEvidenceIds.filter((id) => !byId.has(id));
  const failedEvidenceIds = manifest.requiredEvidenceIds.filter((id) => byId.get(id)?.status === "fail");
  const passedEvidenceIds = manifest.requiredEvidenceIds.filter((id) => byId.get(id)?.status === "pass");
  const status = missingEvidenceIds.length === 0 && failedEvidenceIds.length === 0
    ? "alpha-ready" as const
    : "blocked" as const;

  return {
    releaseId: manifest.releaseId,
    version: manifest.version,
    status,
    productionReady: false,
    physicalPrototypeReady: false,
    passedEvidenceIds,
    missingEvidenceIds,
    failedEvidenceIds,
    limitations: manifest.knownLimitations,
    signature: manifest.signature
  };
}
