"use client";

import {
  useEffect,
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
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
  INVENTION_SPATIAL_BOUNDS,
  InventionSpatialScene,
  parseInventionSpatialDocument
} from "../../../packages/invention-spatial-runtime/src/index";
import {
  InventionBuilder,
  createBlankInventionProject,
  type InventionPortRef
} from "../../../packages/invention-runtime/src/index";
import {
  createSessionSnapshot,
  restoreSessionSnapshot
} from "../../../packages/persistence-runtime/src/index";
import type { SpatialVector3 } from "../../../packages/spatial-runtime/src/index";
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
  readonly spatial: InventionSpatialScene;
}

interface PortOption {
  readonly key: string;
  readonly ref: InventionPortRef;
  readonly label: string;
}

interface DragState {
  readonly entityId: string;
  readonly pointerId: number;
  readonly startClientX: number;
  readonly startClientY: number;
  readonly origin: SpatialVector3;
}

function createRuntime(): InventionRuntimeBundle {
  const session = new EngineeringSession(createBlankInventionProject());
  return {
    session,
    builder: new InventionBuilder(session, registry),
    spatial: new InventionSpatialScene(session)
  };
}

function restoreRuntime(): InventionRuntimeBundle {
  const snapshot = loadBrowserProject("invention");
  if (!snapshot) throw new Error("Não existe projeto de invenção salvo.");
  const session = restoreSessionSnapshot(snapshot);
  const builder = new InventionBuilder(session, registry);
  const rawSpatial = snapshot.extensions.inventionSpatial;
  const spatial = rawSpatial
    ? new InventionSpatialScene(session, parseInventionSpatialDocument(rawSpatial))
    : new InventionSpatialScene(session);

  // S2.10 snapshots did not yet carry spatial evidence. They remain readable and
  // receive a deterministic layout once. When spatial evidence exists, however,
  // parse/restore above stays fail-closed for tampering or incomplete coverage.
  if (!rawSpatial) {
    for (const entity of builder.components()) spatial.ensureComponent(entity.id);
  }

  return { session, builder, spatial };
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function canvasPercentX(x: number): number {
  const { min, max } = INVENTION_SPATIAL_BOUNDS;
  return ((x - min.x) / (max.x - min.x)) * 100;
}

function canvasPercentY(y: number): number {
  const { min, max } = INVENTION_SPATIAL_BOUNDS;
  return (1 - (y - min.y) / (max.y - min.y)) * 100;
}

function svgX(x: number): number {
  return canvasPercentX(x) * 10;
}

function svgY(y: number): number {
  return canvasPercentY(y) * 6;
}

function formatCoordinate(value: number): string {
  return value.toFixed(3);
}

export function BlankInventionExperience() {
  const [open, setOpen] = useState(false);
  const [runtime, setRuntime] = useState<InventionRuntimeBundle>(() => createRuntime());
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedDefinitionId, setSelectedDefinitionId] = useState(() => registry.list()[0]?.definitionId ?? "");
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [sourceKey, setSourceKey] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const [message, setMessage] = useState("Projeto vazio pronto para composição espacial.");
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);

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
  const spatialBindings = useMemo(() => runtime.spatial.bindings(), [runtime, revision]);
  const bindingByEntityId = useMemo(
    () => new Map(spatialBindings.map((binding) => [binding.entityId, binding])),
    [spatialBindings]
  );
  const spatialWires = useMemo(
    () => runtime.spatial.connectionSegments(connections),
    [connections, runtime, revision]
  );
  const selectedEntity = selectedEntityId
    ? components.find((entity) => entity.id === selectedEntityId) ?? null
    : null;
  const selectedBinding = selectedEntityId ? bindingByEntityId.get(selectedEntityId) ?? null : null;

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
      try {
        runtime.spatial.ensureComponent(entity.id);
      } catch (cause) {
        runtime.builder.removeComponent(entity.id);
        throw cause;
      }
      setSelectedEntityId(entity.id);
      return `${entity.name} materializado e posicionado no Spatial Engineering Graph.`;
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
      return `Conexão espacial validada por ${connection.sharedInterfaces.join(", ")}.`;
    });
  };

  const selectEntity = (entityId: string): void => {
    try {
      const selection = runtime.spatial.select(entityId);
      setSelectedEntityId(selection.entity.id);
      setError(false);
      setMessage(`${selection.entity.name} selecionado na mesma Engineering Entity do projeto.`);
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : "Seleção espacial bloqueada.");
    }
  };

  const beginDrag = (entityId: string, event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    const binding = runtime.spatial.binding(entityId);
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedEntityId(entityId);
    setDrag({
      entityId,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      origin: binding.position
    });
  };

  const moveDrag = (event: ReactPointerEvent<HTMLElement>): void => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const { min, max } = INVENTION_SPATIAL_BOUNDS;
    const dx = ((event.clientX - drag.startClientX) / rect.width) * (max.x - min.x);
    const dy = -((event.clientY - drag.startClientY) / rect.height) * (max.y - min.y);
    const next: SpatialVector3 = {
      x: clamp(drag.origin.x + dx, min.x, max.x),
      y: clamp(drag.origin.y + dy, min.y, max.y),
      z: drag.origin.z
    };
    runtime.spatial.move(drag.entityId, next);
    setRevision((current) => current + 1);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLElement>): void => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const binding = runtime.spatial.binding(drag.entityId);
    setMessage(`Posição atualizada · x ${formatCoordinate(binding.position.x)} · y ${formatCoordinate(binding.position.y)} · z ${formatCoordinate(binding.position.z)}.`);
    setError(false);
    setDrag(null);
  };

  const newProject = (): void => {
    setRuntime(createRuntime());
    setRevision((current) => current + 1);
    setSourceKey("");
    setTargetKey("");
    setSelectedEntityId(null);
    setDrag(null);
    setMessage("Novo projeto em branco criado. Nenhum preset foi materializado.");
    setError(false);
  };

  const save = (): void => {
    try {
      saveBrowserProject("invention", createSessionSnapshot(runtime.session, {
        extensions: {
          invention: runtime.builder.document(),
          inventionSpatial: runtime.spatial.document()
        }
      }));
      setSaved(true);
      setError(false);
      setMessage(`Projeto espacial salvo · ${components.length} componentes · ${connections.length} conexões · ${spatialBindings.length} bindings · sem simulação implícita.`);
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : "Não foi possível salvar a invenção espacial.");
    }
  };

  const restore = (): void => {
    try {
      const restored = restoreRuntime();
      setRuntime(restored);
      setRevision((current) => current + 1);
      setSourceKey("");
      setTargetKey("");
      setSelectedEntityId(null);
      setDrag(null);
      setError(false);
      setMessage(`Invenção restaurada · ${restored.builder.components().length} componentes · ${restored.builder.connections().length} conexões · ${restored.spatial.bindings().length} bindings · sem replay.`);
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : "Não foi possível restaurar a invenção espacial.");
    }
  };

  if (!open) return null;

  return (
    <section className={styles.overlay} aria-label="Blank Invention Workspace" data-revision={revision}>
      <div className={styles.workspace}>
        <header className={styles.header}>
          <div>
            <span>TEHKNÉ SOLUTIONS · S2.11</span>
            <strong>Spatial Invention Canvas</strong>
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
          <span>PROJECT TYPE invention · PRESET false · {spatialBindings.length} SPATIAL BINDINGS · SIMULAÇÃO {document.simulationStatus.toUpperCase()}</span>
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

          <main
            className={styles.canvas}
            aria-label="Invention Engineering Graph"
            data-testid="invention-spatial-canvas"
            onPointerMove={moveDrag}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
          >
            {components.length === 0 ? (
              <div className={styles.blankState}>
                <span>ENGINEERING GRAPH VAZIO</span>
                <strong>Comece pela função, depois componha a tecnologia.</strong>
                <p>Nenhum produto pré-montado, comportamento ou simulação foi criado por você.</p>
              </div>
            ) : (
              <>
                <svg className={styles.wireLayer} viewBox="0 0 1000 600" preserveAspectRatio="none" aria-label="Spatial invention wiring">
                  {spatialWires.map((wire) => (
                    <line
                      key={wire.relationshipId}
                      data-testid={`invention-spatial-wire-${wire.relationshipId}`}
                      data-interfaces={wire.sharedInterfaces.join(",")}
                      x1={svgX(wire.source.x)}
                      y1={svgY(wire.source.y)}
                      x2={svgX(wire.target.x)}
                      y2={svgY(wire.target.y)}
                    />
                  ))}
                </svg>

                {components.map((entity) => {
                  const binding = bindingByEntityId.get(entity.id);
                  if (!binding) return null;
                  return (
                    <article
                      key={entity.id}
                      className={styles.spatialNode}
                      data-selected={selectedEntityId === entity.id}
                      data-testid={`invention-component-${entity.id}`}
                      style={{ left: `${canvasPercentX(binding.position.x)}%`, top: `${canvasPercentY(binding.position.y)}%` }}
                      onClick={() => selectEntity(entity.id)}
                    >
                      <div
                        className={styles.dragHandle}
                        data-testid={`invention-spatial-node-${entity.id}`}
                        data-x={formatCoordinate(binding.position.x)}
                        data-y={formatCoordinate(binding.position.y)}
                        data-z={formatCoordinate(binding.position.z)}
                        onPointerDown={(event) => beginDrag(entity.id, event)}
                      >
                        <span>{String(entity.metadata.componentDomain ?? "component")}</span>
                        <strong>{entity.name}</strong>
                        <small>ARRASTE · {formatCoordinate(binding.position.x)}, {formatCoordinate(binding.position.y)}</small>
                      </div>
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
                        onClick={(event) => {
                          event.stopPropagation();
                          mutate(() => {
                            runtime.builder.removeComponent(entity.id);
                            runtime.spatial.removeComponent(entity.id);
                            if (selectedEntityId === entity.id) setSelectedEntityId(null);
                            return `${entity.name} removido do Engineering Graph e do layout espacial.`;
                          });
                        }}
                      >
                        Remover componente
                      </button>
                    </article>
                  );
                })}
              </>
            )}

            {selectedEntity && selectedBinding ? (
              <div className={styles.selectionBadge} data-testid="invention-spatial-selection">
                <span>SELEÇÃO ESPACIAL</span>
                <strong>{selectedEntity.name}</strong>
                <small>
                  {selectedEntity.id} · x {formatCoordinate(selectedBinding.position.x)} · y {formatCoordinate(selectedBinding.position.y)} · z {formatCoordinate(selectedBinding.position.z)}
                </small>
              </div>
            ) : null}
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
                      return `${connection.id} desconectada; portas e wire espacial liberados.`;
                    })}
                  >
                    Desconectar
                  </button>
                </article>
              ))}
            </div>

            <div className={styles.solverBoundary}>
              <strong>SIMULAÇÃO NÃO IMPLÍCITA</strong>
              <p>O canvas espacial move a mesma topologia de engenharia. Cálculos físicos só são executados por runtimes com solver declarado para a topologia correspondente.</p>
            </div>
          </aside>
        </div>

        <footer className={styles.feedback} data-error={error} data-testid="invention-feedback">
          <span>{error ? "BLOCKED" : "ENGINEERING EVENT"}</span>
          <strong>{message}</strong>
          <small>Engineering Graph · Spatial Runtime · Component Library · Tehkné Solutions</small>
        </footer>
      </div>
    </section>
  );
}
