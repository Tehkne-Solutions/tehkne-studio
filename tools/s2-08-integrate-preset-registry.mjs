import { readFile, writeFile } from "node:fs/promises";

const path = "apps/studio-web/components/SpatialWorkbench.tsx";
let source = await readFile(path, "utf8");

function replaceOrFail(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`S2.8 Workbench patch ${label} expected exactly one match, got ${count}`);
  source = source.replace(before, after);
}

replaceOrFail(
`import type { EngineeringEntity } from "../../../packages/engineering-core/src/index";`,
`import type { EngineeringEntity } from "../../../packages/engineering-core/src/index";
import type { TechnologyPresetRuntimeAdapter } from "../../../packages/technology-preset-registry/src/index";`,
"registry type import"
);

replaceOrFail(
`} from "../lib/projectPersistence";
import { browserSpeechSupported, listenOnce, speakStudioResponse } from "../lib/browserSpeech";`,
`} from "../lib/projectPersistence";
import { technologyPresetRegistry } from "../lib/technologyPresetRegistry";
import { browserSpeechSupported, listenOnce, speakStudioResponse } from "../lib/browserSpeech";`,
"registry singleton import"
);

replaceOrFail(
`import { TabletAssembly } from "./TabletAssembly";
import { TvAssembly } from "./TvAssembly";`,
`import { TabletAssembly } from "./TabletAssembly";
import { TechnologyPresetLauncher } from "./TechnologyPresetLauncher";
import { TvAssembly } from "./TvAssembly";`,
"launcher import"
);

replaceOrFail(
`type ActiveProduct = "desktop" | "arm" | "smartphone" | "notebook" | "tablet" | "tv" | null;`,
`type ActiveProduct = TechnologyPresetRuntimeAdapter | null;`,
"active product registry type"
);

replaceOrFail(
`function productLabel(product: Exclude<ActiveProduct, null>): string {
  if (product === "desktop") return "Desktop PC";
  if (product === "arm") return "ARM-01";
  if (product === "smartphone") return "Smartphone 01";
  if (product === "notebook") return "Notebook 01";
  if (product === "tablet") return "Tablet 01";
  return "TV 01";
}`,
`function productLabel(product: Exclude<ActiveProduct, null>): string {
  return technologyPresetRegistry.getByAdapter(product).displayName;
}`,
"product label"
);

replaceOrFail(
`    const looksRobotic = /\\b(pegue|pegar|apanhe|segure|cubo|arm-01|braco|braço|robo|robô|pick|grab|versao|versão|variante|redesign|levantar|peso|torque)\\b/i.test(trimmed);
    const looksNotebook = /\\b(notebook|laptop|computador portatil|computador portátil)\\b/i.test(trimmed);
    const looksTablet = /\\b(tablet|tablete)\\b/i.test(trimmed);
    const looksTv = /\\b(tv|televisao|televisão|televisor)\\b/i.test(trimmed);
    const looksSmartphone = /\\b(celular|smartphone|telefone|phone)\\b/i.test(trimmed);
    const autoProduct: Exclude<ActiveProduct, null> | null = activeProduct === null
      ? looksRobotic
        ? "arm"
        : looksNotebook
          ? "notebook"
          : looksTablet
            ? "tablet"
            : looksTv
              ? "tv"
              : looksSmartphone
                ? "smartphone"
                : null
      : null;`,
`    const looksRobotic = /\\b(pegue|pegar|apanhe|segure|cubo|arm-01|braco|braço|robo|robô|pick|grab|versao|versão|variante|redesign|levantar|peso|torque)\\b/i.test(trimmed);
    const registryPreset = technologyPresetRegistry.resolveUtterance(trimmed);
    const autoProduct: Exclude<ActiveProduct, null> | null = activeProduct === null
      ? looksRobotic
        ? "arm"
        : registryPreset?.runtimeAdapter ?? null
      : null;`,
"registry utterance routing"
);

replaceOrFail(
`          <div className="actions">
            <button type="button" onClick={() => switchProduct("desktop")}>Chamar Desktop PC</button>
            <button type="button" onClick={() => switchProduct("arm")}>Chamar ARM-01</button>
            <button type="button" onClick={() => switchProduct("smartphone")}>Chamar Smartphone 01</button>
            <button type="button" onClick={() => switchProduct("notebook")}>Chamar Notebook 01</button>
            <button type="button" onClick={() => switchProduct("tablet")}>Chamar Tablet 01</button>
            <button type="button" onClick={() => switchProduct("tv")}>Chamar TV 01</button>
            {savedProjects.desktop ? <button type="button" onClick={() => restoreProject("desktop")}>Restaurar Desktop salvo</button> : null}
            {savedProjects.arm ? <button type="button" onClick={() => restoreProject("arm")}>Restaurar ARM-01 salvo</button> : null}
            {savedProjects.smartphone ? <button type="button" onClick={() => restoreProject("smartphone")}>Restaurar Smartphone salvo</button> : null}
            {savedProjects.notebook ? <button type="button" onClick={() => restoreProject("notebook")}>Restaurar Notebook salvo</button> : null}
            {savedProjects.tablet ? <button type="button" onClick={() => restoreProject("tablet")}>Restaurar Tablet salvo</button> : null}
            {savedProjects.tv ? <button type="button" onClick={() => restoreProject("tv")}>Restaurar TV salva</button> : null}
            <button type="button" disabled aria-disabled="true">Projeto vazio · em breve</button>
          </div>`,
`          <TechnologyPresetLauncher
            savedProjects={savedProjects}
            onLaunch={switchProduct}
            onRestore={restoreProject}
          />`,
"registry launcher"
);

await writeFile(path, source);
console.log("S2.8 Workbench registry integration PASS · launcher + labels + product routing are manifest-driven · Tehkné Solutions");
