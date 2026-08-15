"use client";

import type { TechnologyPresetRuntimeAdapter } from "../../../packages/technology-preset-registry/src/index";
import { technologyPresetRegistry } from "../lib/technologyPresetRegistry";

interface TechnologyPresetLauncherProps {
  readonly savedProjects: Readonly<Record<TechnologyPresetRuntimeAdapter, boolean>>;
  readonly onLaunch: (adapter: TechnologyPresetRuntimeAdapter) => void;
  readonly onRestore: (adapter: TechnologyPresetRuntimeAdapter) => void;
}

export function TechnologyPresetLauncher({ savedProjects, onLaunch, onRestore }: TechnologyPresetLauncherProps) {
  const presets = technologyPresetRegistry.list();
  return (
    <div className="actions" data-preset-registry={technologyPresetRegistry.manifest.registryId} data-preset-count={presets.length}>
      {presets.map((preset) => (
        <button
          type="button"
          key={`launch-${preset.presetId}`}
          onClick={() => onLaunch(preset.runtimeAdapter)}
          data-preset-id={preset.presetId}
          data-project-id={preset.projectId}
        >
          {preset.launcherLabel}
        </button>
      ))}
      {presets.map((preset) => savedProjects[preset.persistenceKey] ? (
        <button
          type="button"
          key={`restore-${preset.presetId}`}
          onClick={() => onRestore(preset.persistenceKey)}
          data-restore-preset-id={preset.presetId}
        >
          {preset.restoreLabel}
        </button>
      ) : null)}
      <button type="button" disabled aria-disabled="true">Projeto vazio · em breve</button>
    </div>
  );
}
