import type { EngineeringSession } from "../../engineering-session/src/index.js";
import {
  generatePrototypePackage,
  validateManufacturingProfile,
  type PrototypeManufacturingProfile,
  type PrototypePackageManifest
} from "../../factory-runtime/src/index.js";
import type { ArmVariantLab } from "../../studio-variants/src/index.js";

export class ArmPrototypeFactory {
  #latest: PrototypePackageManifest | null = null;

  constructor(
    readonly session: EngineeringSession,
    readonly variantLab: ArmVariantLab,
    readonly profile: PrototypeManufacturingProfile
  ) {
    validateManufacturingProfile(profile);
  }

  latest(): PrototypePackageManifest | null {
    return this.#latest;
  }

  generate(): PrototypePackageManifest {
    const variant = this.variantLab.latest();
    if (!variant) throw new Error("Prototype Package requires a validated engineering variant.");
    if (variant.status !== "validated" || variant.comparison.candidate.assessment.status !== "pass") {
      throw new Error("Prototype Package requires a variant that passed validation.");
    }
    if (variant.id !== this.profile.variantId) {
      throw new Error(`Manufacturing profile ${this.profile.variantId} does not match validated variant ${variant.id}.`);
    }

    for (const item of this.profile.items) {
      if (item.entityId) this.session.getEntity(item.entityId);
    }

    const manifest = generatePrototypePackage(this.profile, new Date().toISOString());
    this.#latest = manifest;
    this.session.events.record({
      id: `factory-event-${this.session.events.list().length + 1}`,
      type: "PrototypePackageGenerated",
      occurredAt: manifest.generatedAt,
      source: "simulation",
      payload: {
        packageId: manifest.packageId,
        projectId: manifest.projectId,
        variantId: manifest.variantId,
        revision: manifest.revision,
        readiness: manifest.readiness,
        fabricationReady: manifest.fabricationReady,
        estimatedBomCostBrl: manifest.estimatedBomCostBrl,
        sourceFailureExperimentId: variant.sourceFailureExperimentId
      }
    });
    return manifest;
  }
}
