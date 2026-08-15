import { TechnologyPresetRegistry } from "../../../packages/technology-preset-registry/src/index";
import technologyPresetManifest from "../../../registry/technology-presets/v1.json";

export const technologyPresetRegistry = new TechnologyPresetRegistry(technologyPresetManifest);
