import type { EntityId } from "../../engineering-core/src/index.js";
import type { ComponentRegistry } from "../../component-library/src/index.js";
import {
  materializeProductComposition,
  validateProductCompositionProfile,
  type ProductBootDependencyProfile,
  type ProductCompositionProfile,
  type ProductConnectionProfile,
  type ProductMaterializationResult,
  type ProductSlotProfile,
  type ProductSpatialProfile
} from "../../product-composition-runtime/src/index.js";

export const SMARTPHONE_PROFILE_VERSION = "1" as const;
export const SMARTPHONE_SIGNATURE = "Tehkné Solutions" as const;

export type SmartphoneSpatialProfile = ProductSpatialProfile;

export interface SmartphoneSlotProfile extends Omit<ProductSlotProfile, "voiceAliases"> {
  readonly voiceAliases?: readonly string[];
}

export type SmartphoneConnectionProfile = ProductConnectionProfile;
export type SmartphoneBootDependencyProfile = ProductBootDependencyProfile;

export interface SmartphonePresetProfile {
  readonly profileId: string;
  readonly projectId: string;
  readonly name: string;
  readonly signature: typeof SMARTPHONE_SIGNATURE;
  readonly root: {
    readonly id: EntityId;
    readonly name: string;
    readonly type: "Smartphone";
    readonly voiceAliases: readonly string[];
  };
  readonly slots: readonly SmartphoneSlotProfile[];
  readonly connections: readonly SmartphoneConnectionProfile[];
  readonly bootDependencies: readonly SmartphoneBootDependencyProfile[];
}

export type SmartphoneMaterializationResult = ProductMaterializationResult;

const REQUIRED_SMARTPHONE_SLOTS = [
  "frame", "battery", "regulator", "soc", "memory", "storage", "display", "imu", "camera", "wireless", "usbC"
] as const;

const SLOT_VOICE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  frame: ["estrutura", "chassi", "frame", "midframe"],
  battery: ["bateria", "battery", "bateria do celular"],
  regulator: ["energia", "regulador", "pmic", "power management"],
  soc: ["soc", "processador", "chip", "processador do celular"],
  memory: ["memoria", "memória", "ram", "lpddr"],
  storage: ["armazenamento", "storage", "flash"],
  display: ["tela", "display", "oled", "touch"],
  imu: ["imu", "sensor de movimento", "acelerometro", "acelerômetro"],
  camera: ["camera", "câmera", "camera principal", "câmera principal"],
  wireless: ["wifi", "wi-fi", "bluetooth", "wireless", "radio", "rádio"],
  usbC: ["usb-c", "usb c", "porta usb", "conector usb"]
};

function compositionProfile(profile: SmartphonePresetProfile): ProductCompositionProfile {
  return {
    compositionVersion: "1",
    profileId: profile.profileId,
    projectId: profile.projectId,
    name: profile.name,
    signature: profile.signature,
    productFamily: "smartphone",
    projectType: "teardown",
    root: {
      ...profile.root,
      formFactor: "slab-smartphone",
      simpleExplanation: "Um smartphone combina energia, processamento, memória, armazenamento, tela, sensores, câmera e rádios em uma arquitetura compacta."
    },
    boot: {
      id: "phone.boot",
      name: "Smartphone Boot Process",
      voiceAliases: ["boot do celular", "boot do smartphone", "inicializacao do celular", "inicialização do celular"],
      simpleExplanation: "O processo de boot valida alimentação e os subsistemas essenciais antes de colocar o smartphone em execução."
    },
    requiredSlots: REQUIRED_SMARTPHONE_SLOTS,
    slots: profile.slots.map((slot) => ({
      ...slot,
      voiceAliases: slot.voiceAliases ?? SLOT_VOICE_ALIASES[slot.slotId] ?? [slot.name]
    })),
    connections: profile.connections,
    bootDependencies: profile.bootDependencies
  };
}

export function validateSmartphoneProfile(profile: SmartphonePresetProfile, registry: ComponentRegistry): string[] {
  const errors: string[] = [];
  if (profile.signature !== SMARTPHONE_SIGNATURE) errors.push("smartphone profile signature must be Tehkné Solutions");
  if (profile.root.type !== "Smartphone") errors.push("smartphone root contract is invalid");
  const genericErrors = validateProductCompositionProfile(compositionProfile(profile), registry);
  for (const error of genericErrors) {
    if (!errors.includes(error)) errors.push(error);
  }
  return errors;
}

export function createSmartphoneProject(
  profile: SmartphonePresetProfile,
  registry: ComponentRegistry
): SmartphoneMaterializationResult {
  const errors = validateSmartphoneProfile(profile, registry);
  if (errors.length > 0) throw new Error(`Invalid smartphone profile: ${errors.join("; ")}`);
  return materializeProductComposition(compositionProfile(profile), registry);
}
