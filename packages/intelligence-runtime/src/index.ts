import type { EntityId } from "../../engineering-core/src/index.js";

export interface IntelligenceEntityDescriptor {
  readonly id: EntityId;
  readonly type: string;
  readonly name: string;
  readonly state: string;
  readonly capabilityIds: readonly string[];
  readonly aliases?: readonly string[];
}
