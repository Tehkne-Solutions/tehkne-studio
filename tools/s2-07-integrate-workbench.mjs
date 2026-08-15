import { readFile, writeFile } from "node:fs/promises";

const path = "apps/studio-web/components/SpatialWorkbench.tsx";
let source = await readFile(path, "utf8");

function replaceOrFail(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`S2.7 Workbench patch ${label} expected exactly one match, got ${count}`);
  source = source.replace(before, after);
}

replaceOrFail(
`import type { PrototypeManufacturingProfile, PrototypePackageManifest } from "../../../packages/factory-runtime/src/index";`,
`import type { PrototypeManufacturingProfile, PrototypePackageManifest } from "../../../packages/factory-runtime/src/index";
import {
  createDisplaySystemProject,
  createDisplaySystemRegistry,
  type DisplaySystemPresetProfile
} from "../../../packages/display-system-runtime/src/index";`,
"display-system runtime import"
);

replaceOrFail(
`import componentCatalog from "../../../library/components/catalog.json";
import notebookOverlay from "../../../library/components/overlays/notebook-v1.json";`,
`import componentCatalog from "../../../library/components/catalog.json";
import displaySystemExtension from "../../../library/components/extensions/display-system-v1.json";
import displaySystemOverlay from "../../../library/components/overlays/display-system-v1.json";
import notebookOverlay from "../../../library/components/overlays/notebook-v1.json";`,
"catalog assets"
);

replaceOrFail(
`import tabletProfile from "../../../presets/tablet-01/profile.json";`,
`import tabletProfile from "../../../presets/tablet-01/profile.json";
import tvProfile from "../../../presets/tv-01/profile.json";`,
"TV profile import"
);

replaceOrFail(
`import { TabletAssembly } from "./TabletAssembly";`,
`import { TabletAssembly } from "./TabletAssembly";
import { TvAssembly } from "./TvAssembly";`,
"TV assembly import"
);

replaceOrFail(
`type ActiveProduct = "desktop" | "arm" | "smartphone" | "notebook" | "tablet" | null;`,
`type ActiveProduct = "desktop" | "arm" | "smartphone" | "notebook" | "tablet" | "tv" | null;`,
"active product type"
);

replaceOrFail(
`const tabletMaterialization = createTabletProject(
  tabletProfile as unknown as TabletPresetProfile,
  tabletRegistry
);`,
`const tabletMaterialization = createTabletProject(
  tabletProfile as unknown as TabletPresetProfile,
  tabletRegistry
);
const displaySystemRegistry = createDisplaySystemRegistry(
  componentCatalog,
  displaySystemExtension as Parameters<typeof createDisplaySystemRegistry>[1],
  displaySystemOverlay as ComponentCatalogOverlay
).registry;
const tvMaterialization = createDisplaySystemProject(
  tvProfile as unknown as DisplaySystemPresetProfile,
  displaySystemRegistry
);`,
"TV materialization"
);

replaceOrFail(
`function savedSelection(snapshot: StudioSessionSnapshot, session: EngineeringSession): string | null {`,
`function createTvRuntime(snapshot?: StudioSessionSnapshot): ProductRuntimeBundle {
  if (snapshot && snapshot.project.projectId !== tvMaterialization.project.projectId) {
    throw new Error(\`Snapshot \${snapshot.project.projectId} não pertence à TV 01.\`);
  }
  const session = snapshot
    ? restoreSessionSnapshot(snapshot)
    : new EngineeringSession(tvMaterialization.project);
  return { session, intelligence: new StudioIntelligence(session) };
}

function savedSelection(snapshot: StudioSessionSnapshot, session: EngineeringSession): string | null {`,
"TV runtime"
);

replaceOrFail(
`  if (product === "notebook") return "Notebook 01";
  return "Tablet 01";`,
`  if (product === "notebook") return "Notebook 01";
  if (product === "tablet") return "Tablet 01";
  return "TV 01";`,
"product label"
);

replaceOrFail(
`  const [tabletRuntime, setTabletRuntime] = useState<ProductRuntimeBundle>(() => createTabletRuntime());`,
`  const [tabletRuntime, setTabletRuntime] = useState<ProductRuntimeBundle>(() => createTabletRuntime());
  const [tvRuntime, setTvRuntime] = useState<ProductRuntimeBundle>(() => createTvRuntime());`,
"TV state"
);

replaceOrFail(
`  const { session: tabletSession, intelligence: tabletIntelligence } = tabletRuntime;`,
`  const { session: tabletSession, intelligence: tabletIntelligence } = tabletRuntime;
  const { session: tvSession, intelligence: tvIntelligence } = tvRuntime;`,
"TV runtime destructure"
);

replaceOrFail(
`    notebook: false,
    tablet: false`,
`    notebook: false,
    tablet: false,
    tv: false`,
"saved projects state"
);

replaceOrFail(
`      notebook: browserProjectExists("notebook"),
      tablet: browserProjectExists("tablet")`,
`      notebook: browserProjectExists("notebook"),
      tablet: browserProjectExists("tablet"),
      tv: browserProjectExists("tv")`,
"saved projects initialization"
);

replaceOrFail(
`      : activeProduct === "tablet"
          ? tabletSession
          : desktopSession;`,
`      : activeProduct === "tablet"
          ? tabletSession
          : activeProduct === "tv"
            ? tvSession
            : desktopSession;`,
"active session"
);

replaceOrFail(
`      : activeProduct === "tablet"
          ? tabletIntelligence
          : desktopIntelligence;`,
`      : activeProduct === "tablet"
          ? tabletIntelligence
          : activeProduct === "tv"
            ? tvIntelligence
            : desktopIntelligence;`,
"active intelligence"
);

replaceOrFail(
`  const tabletComponents = tabletSession.graph.getDependencies(tabletRoot.id, "contains").filter((entity) => entity.type !== "BootProcess");`,
`  const tabletComponents = tabletSession.graph.getDependencies(tabletRoot.id, "contains").filter((entity) => entity.type !== "BootProcess");

  const tvRoot = tvSession.getEntity("tv.root");
  const tvBoot = tvSession.getEntity("tv.boot");
  const tvPowerState = String(tvRoot.properties.powerState?.value ?? "off");
  const tvBootStage = String(tvBoot.properties.stage?.value ?? "IDLE");
  const tvComponents = tvSession.graph.getDependencies(tvRoot.id, "contains").filter((entity) => entity.type !== "BootProcess");`,
"TV root state"
);

replaceOrFail(
`            : product === "tablet"
              ? "Tablet 01 pronto. Abra, inspecione o controlador touch/pen, remova a bateria ou teste o boot causal."
              : "Desktop PC pronto para inspeção, boot causal e automações."`,
`            : product === "tablet"
              ? "Tablet 01 pronto. Abra, inspecione o controlador touch/pen, remova a bateria ou teste o boot causal."
              : product === "tv"
                ? "TV 01 pronta. Abra o chassi, inspecione HDMI/áudio, remova a fonte AC/DC ou teste o boot causal."
                : "Desktop PC pronto para inspeção, boot causal e automações."`,
"switch message"
);

replaceOrFail(
`      } else if (activeProduct === "notebook") {
        saveBrowserProject("notebook", createSessionSnapshot(notebookSession, { extensions: { workspace } }));
      } else {
        saveBrowserProject("tablet", createSessionSnapshot(tabletSession, { extensions: { workspace } }));
      }`,
`      } else if (activeProduct === "notebook") {
        saveBrowserProject("notebook", createSessionSnapshot(notebookSession, { extensions: { workspace } }));
      } else if (activeProduct === "tablet") {
        saveBrowserProject("tablet", createSessionSnapshot(tabletSession, { extensions: { workspace } }));
      } else {
        saveBrowserProject("tv", createSessionSnapshot(tvSession, { extensions: { workspace } }));
      }`,
"TV persistence save"
);

replaceOrFail(
`      } else if (product === "notebook") {
        const restored = createNotebookRuntime(snapshot);
        setNotebookRuntime(restored);
        restoredSession = restored.session;
      } else {
        const restored = createTabletRuntime(snapshot);
        setTabletRuntime(restored);
        restoredSession = restored.session;
      }`,
`      } else if (product === "notebook") {
        const restored = createNotebookRuntime(snapshot);
        setNotebookRuntime(restored);
        restoredSession = restored.session;
      } else if (product === "tablet") {
        const restored = createTabletRuntime(snapshot);
        setTabletRuntime(restored);
        restoredSession = restored.session;
      } else {
        const restored = createTvRuntime(snapshot);
        setTvRuntime(restored);
        restoredSession = restored.session;
      }`,
"TV persistence restore"
);

replaceOrFail(
`    const looksTablet = /\\b(tablet|tablete)\\b/i.test(trimmed);
    const looksSmartphone = /\\b(celular|smartphone|telefone|phone)\\b/i.test(trimmed);`,
`    const looksTablet = /\\b(tablet|tablete)\\b/i.test(trimmed);
    const looksTv = /\\b(tv|televisao|televisão|televisor)\\b/i.test(trimmed);
    const looksSmartphone = /\\b(celular|smartphone|telefone|phone)\\b/i.test(trimmed);`,
"TV language route"
);

replaceOrFail(
`          : looksTablet
            ? "tablet"
            : looksSmartphone
              ? "smartphone"
              : null`,
`          : looksTablet
            ? "tablet"
            : looksTv
              ? "tv"
              : looksSmartphone
                ? "smartphone"
                : null`,
"TV automatic product"
);

replaceOrFail(
`        : autoProduct === "tablet"
          ? tabletIntelligence
          : autoProduct === "smartphone"
            ? smartphoneIntelligence
            : activeIntelligence;`,
`        : autoProduct === "tablet"
          ? tabletIntelligence
          : autoProduct === "tv"
            ? tvIntelligence
            : autoProduct === "smartphone"
              ? smartphoneIntelligence
              : activeIntelligence;`,
"TV intelligence"
);

replaceOrFail(
`    if (execution.targetEntityId?.startsWith("tablet.")) setActiveProduct("tablet");`,
`    if (execution.targetEntityId?.startsWith("tablet.")) setActiveProduct("tablet");
    if (execution.targetEntityId?.startsWith("tv.")) setActiveProduct("tv");`,
"TV target prefix"
);

replaceOrFail(
`        {activeProduct === "tablet" ? <TabletAssembly session={tabletSession} selectedId={selectedId} onSelect={selectEntity} /> : null}`,
`        {activeProduct === "tablet" ? <TabletAssembly session={tabletSession} selectedId={selectedId} onSelect={selectEntity} /> : null}
        {activeProduct === "tv" ? <TvAssembly session={tvSession} selectedId={selectedId} onSelect={selectEntity} /> : null}`,
"TV canvas"
);

replaceOrFail(
`            <button type="button" onClick={() => switchProduct("tablet")}>Chamar Tablet 01</button>`,
`            <button type="button" onClick={() => switchProduct("tablet")}>Chamar Tablet 01</button>
            <button type="button" onClick={() => switchProduct("tv")}>Chamar TV 01</button>`,
"TV workbench button"
);

replaceOrFail(
`            {savedProjects.tablet ? <button type="button" onClick={() => restoreProject("tablet")}>Restaurar Tablet salvo</button> : null}`,
`            {savedProjects.tablet ? <button type="button" onClick={() => restoreProject("tablet")}>Restaurar Tablet salvo</button> : null}
            {savedProjects.tv ? <button type="button" onClick={() => restoreProject("tv")}>Restaurar TV salva</button> : null}`,
"TV restore button"
);

replaceOrFail(
`          ) : (
            <>
              <span>TABLET-01 · {tabletComponents.length} COMPONENTES · {tabletRoot.state.toUpperCase()}</span>
              <span className={\`runtime-state runtime-\${tabletPowerState}\`}>POWER {tabletPowerState.toUpperCase()} · BOOT {tabletBootStage}</span>
            </>
          )}`,
`          ) : activeProduct === "tablet" ? (
            <>
              <span>TABLET-01 · {tabletComponents.length} COMPONENTES · {tabletRoot.state.toUpperCase()}</span>
              <span className={\`runtime-state runtime-\${tabletPowerState}\`}>POWER {tabletPowerState.toUpperCase()} · BOOT {tabletBootStage}</span>
            </>
          ) : (
            <>
              <span>TV-01 · {tvComponents.length} COMPONENTES · {tvRoot.state.toUpperCase()}</span>
              <span className={\`runtime-state runtime-\${tvPowerState}\`}>POWER {tvPowerState.toUpperCase()} · BOOT {tvBootStage}</span>
            </>
          )}`,
"TV toolbar"
);

replaceOrFail(
`                  : activeProduct === "tablet"
                    ? "Ex.: abra o tablet · inspecione a caneta · tire a bateria · ligue"
                    : "Ex.: abra o computador · tire a RAM · crie uma automação térmica"}`,
`                  : activeProduct === "tablet"
                    ? "Ex.: abra o tablet · inspecione a caneta · tire a bateria · ligue"
                    : activeProduct === "tv"
                      ? "Ex.: abra a TV · inspecione o HDMI · tire a fonte · ligue · por que não iniciou?"
                      : "Ex.: abra o computador · tire a RAM · crie uma automação térmica"}`,
"TV command placeholder"
);

await writeFile(path, source);
console.log("S2.7 Workbench integration patch PASS · TV 01 added without replacing existing product flows · Tehkné Solutions");
