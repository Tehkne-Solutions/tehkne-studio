"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ComponentRegistry,
  parseComponentCatalog,
  type ComponentDefinition
} from "../../../packages/component-library/src/index";
import { applyComponentCatalogExtension } from "../../../packages/component-library/src/extension";
import {
  applyComponentCatalogOverlay,
  type ComponentCatalogOverlay
} from "../../../packages/component-library/src/overlay";
import { EngineeringSession } from "../../../packages/engineering-session/src/index";
import {
  InventionBuilder,
  createBlankInventionProject,
  type InventionPortRef
} from "../../../packages/invention-runtime/src/index";
import {
  createSessionSnapshot,
  restoreSessionSnapshot
} from "../../../packages/persistence-runtime/src/index";
import componentCatalog from "../../../library/components/catalog.json";
import displaySystemExtension from "../../../library/components/extensions/display-system-v1.json";
import displaySystemOverlay from "../../../library/components/overlays/display-system-v1.json";
import notebookOverlay from "../../../library/components/overlays/notebook-v1.json";
import tabletOverlay from "../../../library/components/overlays/tablet-v1.json";
import {
  browserProjectExists,
  loadBrowserProject,
  saveBrowserProject
} from "../lib/projectPersistence";
import styles from "./BlankInventionExperience.module.css";

const baseCatalog = parseComponentCatalog(componentCatalog);
const notebookCatalog = applyComponentCatalogOverlay(baseCatalog, notebookOverlay as ComponentCatalogOverlay);
const tabletCatalog = applyComponentCatalogOverlay(notebookCatalog, tabletOverlay as ComponentCatalogOverlay);
const displayExtendedCatalog = applyComponentCatalogExtension(tabletCatalog, displaySystemExtension);
const expandedCatalog = applyComponentCatalogOverlay(displayExtendedCatalog, displaySystemOverlay as ComponentCatalogOverlay);
const registry = new ComponentRegistry(expandedCatalog);

interface InventionRuntimeBundle {
  readonly session: EngineeringSession;
  readonly builder: InventionBuilder;
}

interface PortOption {
  readonly key: string;
  readonly ref: InventionPortRef;
  readonly label: string;
}

function createRuntime(): InventionRuntimeBundle {
  const session = new EngineeringSession(createBlankInventionProject());
  return { session, builder: new InventionBuilder(session, registry) };
}

function restoreRuntime(): InventionRuntimeBundle {
  const snapshot = loadBrowserProject("invention");
  if (!snapshot) throw new Error("Não existe projeto de invenção salvo.");
  const session = restoreSessionSnapshot(snapshot);
  return { session, builder: new InventionBuilder(session, registry) };
}

function portKey(ref: InventionPortRef): string {
  return `${ref.entityId}::${ref.portId}`;
}

function parsePortKey(value: string): InventionPortRef | null {
  const [entityId, portId] = value.split("::");
  return entityId && portId ? { entityId, portId } : null;
}

function componentLabel(definition: ComponentDefinition): string {
  return `${definition.name} · ${definition.domain}`;
}

export function BlankInventionExperience() {
  const [open, setOpen] = useState(false);
  const [runtime, setRuntime] = useState<InventionRuntimeBundle>(() => createRuntime());
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedDefinitionId, setSelectedDefinitionId] = useState(() => registry.list()[0]?.definitionId ?? "");
  const [sourceKey, setSourceKey] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const [message, setMessage] = useState("Projeto vazio pronto para composição.");
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(browserProjectExists("invention"));
    const openWorkspace = () => setOpen(true);
    window.addEventListener("tehkne:open-invention", openWorkspace);
    return () => window.removeEventListener("tehkne:open-invention", openWorkspace);
  }, []);

  const definitions = useMemo(
    () => registry.list(query.trim() ? { query } : {}),
    [query]
  );
  const selectedDefinition = definitions.find((definition) => definition.definitionId === selectedDefinitionId) ?? definitions[0] ?? null;
  const components = useMemo(() => runtime.builder.components(), [runtime, revision]);
  const connections = useMemo(() => runtime.builder.connections(), [runtime, revision]);
  const document = useMemo(() => runtime.builder.document(), [runtime, revision]);

  const outputOptions = useMemo<readonly PortOption[]>(() => components.flatMap((entity) =>
    Object.values(entity.ports)
      .filter((port) => port.state === "available" && port.direction !== "in")
      .map((port) => ({
        key: portKey({ entityId: entity.id, portId: port.id }),
        ref: { entityId: entity.id, portId: port.id },
        label: `${entity.name} · ${port.id} · ${port.kind}`
      }))
  ), [components]);

  const sourceRef = parsePortKey(sourceKey);
  const compatibleTargets = sourceRef ? runtime.builder.compatibleTargets(sourceRef) : [];
  const compatibleTargetKeys = new Set(compatibleTargets.map(portKey));
  const inputOptions = useMemo<readonly PortOption[]>(() => components.flatMap((entity) =>
    Object.values(entity.ports)
      .filter((port) => port.state === "available" && port.direction !== "out")
      .map((port) => ({
        key: portKey({ entityId: entity.id, portId: port.id }),
        ref: { entityId: entity.id, portId: port.id },
        label: `${entity.name} · ${port.id} · ${port.kind}`
      }))
  ).filter((option) => !sourceRef || compatibleTargetKeys.has(option.key)), [components, compatibleTargetKeys, sourceRef]);

  const mutate = (action: () => string): void => {
    try {
      const nextMessage = action();
      setMessage(nextMessage);
      setError(false);
      setSourceKey("");
      setTargetKey("");
      setRevision((current) => current + 1);
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : "Operação de invenção bloqueada.");
    }
  };

  const addSelected = (): void => {
    if (!selectedDefinition) return;
    mutate(() => {
      const entity = runtime.builder.addComponent(selectedDefinition.definitionId);
      return `${entity.name} materializado da Component Library.`;
    });
  };

  const connectSelected = (): void => {
    const from = parsePortKey(sourceKey);
    const to = parsePortKey(targetKey);
    if (!from || !to) {
      setError(true);
      setMessage("Selecione uma porta de origem e uma porta compatível de destino.");
      return;
    }
    mutate(() => {
      const connection = runtime.builder.connect(from, to);
      return `Conexão validada por ${connection.sharedInterfaces.join(", ")}.`;
    });
  };

  const newProject = (): void => {
    setRuntime(createRuntime());
    setRevision((current) => current + 1);
    setSourceKey("");
    setTargetKey("");
    setMessage("Novo projeto em branco criado. Nenhum preset foi materializado.");
    setError(false);
  };

  const save = (): void => {
    try {
      saveBrowserProject("invention", createSessionSnapshot(runtime.session, {
        extensions: { invention: runtime.builder.document() }
      }));
      setSaved(true);
      setError(false);
      setMessage(`Projeto salvo · ${components.length} componentes · ${connections.length} conexões · sem simulação implícita.`);
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : "Não foi possível salvar a invenção.");
    }
  };

  const restore = (): void => {
    try {
      const restored = restoreRuntime();
      setRuntime(restored);
      setRevision((current) => current + 1);
      setSourceKey("");
      setTargetKey("");
      setError(false);
      setMessage(`Invenção restaurada · ${restored.builder.components().length} componentes · ${restored.builder.connections().length} conexões · sem replay.`);
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : "Não foi possível restaurar a invenção.");
    }
  };

  if (!open) return null;

  return (
    <section className={styles.overlay} aria-label="Blank Invention Workspace" data-revision={revision}>
      <div className={styles.workspace}>
        <header className={styles.header}>
          <div>
            <span>TEHKNÉ SOLUTIONS · S2.10</span>
            <strong>Blank Invention Workflow</strong>
          </div>
          <div className={styles.headerActions}>
            <button type="button" onClick={newProject}>Novo projeto</button>
            <button type="button" onClick={save}>Guardar invenção</button>
            {saved ? <button type="button" onClick={restore}>Restaurar invenção</button> : null}
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar Blank Invention">Fechar</button>
          </div>
        </header>

        <div className={styles.status} data-testid="invention-status">
          <strong>BLANK INVENTION · {components.length} COMPONENTES · {connections.length} CONEXÕES</strong>
          <span>PROJECT TYPE invention · PRESET false · SIMULAÇÃO {document.simulationStatus.toUpperCase()}</span>
        </div>

        <div className={styles.body}>
          <aside className={styles.library} aria-label="Invention Component Library">
            <label>
              Buscar tecnologia
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="battery, regulator, display..." />
            </label>
            <div className={styles.definitionList}>
              {definitions.map((definition) => (
                <button
                  type="button"
                  key={definition.definitionId}
                  data-selected={selectedDefinition?.definitionId === definition.definitionId}
                  onClick={() => setSelectedDefinitionId(definition.definitionId)}
                >
                  <strong>{definition.name}</strong>
                  <small>{definition.domain} · {definition.definitionId}</small>
                </button>
              ))}
            </div>
            {selectedDefinition ? (
              <div className={styles.definitionInspector}>
                <span>DEFINIÇÃO CANÔNICA</span>
                <strong>{componentLabel(selectedDefinition)}</strong>
                <small>{Object.keys(selectedDefinition.ports).length} portas · {Object.keys(selectedDefinition.properties).length} propriedades</small>
                <button type="button" onClick={addSelected}>Adicionar ao projeto</button>
              </div>
            ) : <p>Nenhum componente encontrado.</p>}
          </aside>

          <main className={styles.canvas} aria-label="Invention Engineering Graph">
            {components.length === 0 ? (
              <div className={styles.blankState}>
                <span>ENGINEERING GRAPH VAZIO</span>
                <strong>Comece pela função, depois componha a tecnologia.</strong>
                <p>Nenhum produto pré-montado, comportamento ou simulação foi criado por você.</p>
              </div>
            ) : (
              <div className={styles.componentGrid}>
                {components.map((entity) => (
                  <article key={entity.id} className={styles.componentCard} data-testid={`invention-component-${entity.id}`}>
                    <span>{String(entity.metadata.componentDomain ?? "component")}</span>
                    <strong>{entity.name}</strong>
                    <small>{String(entity.metadata.componentDefinitionId)}</small>
                    <div className={styles.ports}>
                      {Object.values(entity.ports).map((port) => (
                        <div key={port.id} data-state={port.state}>
                          <span>{port.id}</span>
                          <small>{port.kind} · {port.direction} · {port.state}</small>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => mutate(() => {
                        runtime.builder.removeComponent(entity.id);
                        return `${entity.name} removido do projeto.`;
                      })}
                    >
                      Remover componente
                    </button>
                  </article>
                ))}
              </div>
            )}
          </main>

          <aside className={styles.connections} aria-label="Invention Connections">
            <span>CONEXÕES VALIDADAS</span>
            <label>
              Porta de origem
              <select value={sourceKey} onChange={(event) => { setSourceKey(event.target.value); setTargetKey(""); }}>
                <option value="">Selecione...</option>
                {outputOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            </label>
            <label>
              Porta compatível de destino
              <select value={targetKey} onChange={(event) => setTargetKey(event.target.value)} disabled={!sourceRef}>
                <option value="">Selecione...</option>
                {inputOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            </label>
            <button type="button" onClick={connectSelected} disabled={!sourceRef || !targetKey}>Conectar interfaces</button>

            <div className={styles.connectionList}>
              {document.connections.map((connection) => (
                <article key={connection.id}>
                  <strong>{connection.sharedInterfaces.join(" · ")}</strong>
                  <small>{connection.from.entityId}:{connection.from.portId}</small>
                  <small>→ {connection.to.entityId}:{connection.to.portId}</small>
                  <button
                    type="button"
                    onClick={() => mutate(() => {
                      runtime.builder.disconnect(connection.id);
                      return `${connection.id} desconectada; portas liberadas.`;
                    })}
                  >
                    Desconectar
                  </button>
                </article>
              ))}
            </div>

            <div className={styles.solverBoundary}>
              <strong>SIMULAÇÃO NÃO IMPLÍCITA</strong>
              <p>Esta etapa compõe topologia. Cálculos físicos só serão executados por runtimes com solver declarado para a topologia correspondente.</p>
            </div>
          </aside>
        </div>

        <footer className={styles.feedback} data-error={error} data-testid="invention-feedback">
          <span>{error ? "BLOCKED" : "ENGINEERING EVENT"}</span>
          <strong>{message}</strong>
          <small>Engineering Graph · Component Library · port compatibility · Tehkné Solutions</small>
        </footer>
      </div>
    </section>
  );
}
