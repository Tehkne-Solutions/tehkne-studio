"use client";

import { useMemo, useState } from "react";
import {
  ComponentRegistry,
  parseComponentCatalog,
  type ComponentDefinition,
  type ProductFamily
} from "../../../packages/component-library/src/index";
import {
  applyComponentCatalogExtension,
  type ComponentCatalogExtension
} from "../../../packages/component-library/src/extension";
import {
  applyComponentCatalogOverlay,
  type ComponentCatalogOverlay
} from "../../../packages/component-library/src/overlay";
import componentCatalog from "../../../library/components/catalog.json";
import displaySystemExtension from "../../../library/components/extensions/display-system-v1.json";
import displaySystemOverlay from "../../../library/components/overlays/display-system-v1.json";
import notebookOverlay from "../../../library/components/overlays/notebook-v1.json";
import tabletOverlay from "../../../library/components/overlays/tablet-v1.json";
import styles from "./ComponentLibraryPanel.module.css";

const baseCatalog = parseComponentCatalog(componentCatalog);
const notebookCatalog = applyComponentCatalogOverlay(
  baseCatalog,
  notebookOverlay as ComponentCatalogOverlay
);
const tabletCatalog = applyComponentCatalogOverlay(
  notebookCatalog,
  tabletOverlay as ComponentCatalogOverlay
);
const displayExtendedCatalog = applyComponentCatalogExtension(
  tabletCatalog,
  displaySystemExtension as ComponentCatalogExtension
);
const expandedCatalog = applyComponentCatalogOverlay(
  displayExtendedCatalog,
  displaySystemOverlay as ComponentCatalogOverlay
);
const registry = new ComponentRegistry(expandedCatalog);

const productFamilies: readonly (ProductFamily | "all")[] = [
  "all", "smartphone", "tablet", "notebook", "desktop", "robotics", "embedded", "display-system", "generic"
];

function propertySummary(definition: ComponentDefinition): string {
  const values = Object.values(definition.properties);
  if (values.length === 0) return "Sem propriedades padrão";
  return values.slice(0, 3).map((property) => `${property.id}: ${String(property.value)}${property.unit ? ` ${property.unit}` : ""}`).join(" · ");
}

export function ComponentLibraryPanel() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<ProductFamily | "all">("all");
  const [selectedId, setSelectedId] = useState<string>(() => registry.list()[0]?.definitionId ?? "");

  const results = useMemo(
    () => registry.list({
      ...(query.trim() ? { query } : {}),
      ...(family !== "all" ? { productFamily: family } : {})
    }),
    [query, family]
  );
  const selected = useMemo(() => {
    const visible = results.find((definition) => definition.definitionId === selectedId);
    return visible ?? results[0] ?? null;
  }, [results, selectedId]);

  return (
    <div className={styles.host} data-open={open}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="universal-component-library"
      >
        COMPONENT LIBRARY · {registry.list().length}
      </button>

      {open ? (
        <aside id="universal-component-library" className={styles.panel} aria-label="Universal Component Library">
          <header className={styles.heading}>
            <div>
              <span>TEHKNÉ UNIVERSAL COMPONENTS</span>
              <strong>Biblioteca tecnológica v1</strong>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar biblioteca">×</button>
          </header>

          <div className={styles.filters}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar SoC, bateria, HDMI, fonte, câmera, servo…"
              aria-label="Buscar componentes"
            />
            <select value={family} onChange={(event) => setFamily(event.target.value as ProductFamily | "all")} aria-label="Filtrar família de produto">
              {productFamilies.map((option) => <option key={option} value={option}>{option === "all" ? "Todas as famílias" : option}</option>)}
            </select>
          </div>

          <div className={styles.body}>
            <nav className={styles.results} aria-label="Componentes encontrados">
              <small>{results.length} COMPONENTES</small>
              {results.map((definition) => (
                <button
                  type="button"
                  key={definition.definitionId}
                  onClick={() => setSelectedId(definition.definitionId)}
                  data-selected={selected?.definitionId === definition.definitionId}
                >
                  <span>{definition.domain.toUpperCase()}</span>
                  <strong>{definition.name}</strong>
                  <small>{definition.type}</small>
                </button>
              ))}
              {results.length === 0 ? <p>Nenhum componente corresponde aos filtros.</p> : null}
            </nav>

            {selected ? (
              <section className={styles.detail} aria-label="Detalhes do componente selecionado">
                <span>{selected.definitionId}</span>
                <h2>{selected.name}</h2>
                <p>{String(selected.metadata.simpleExplanation ?? "Componente reutilizável da biblioteca Tehkné Studio.")}</p>

                <div className={styles.metaGrid}>
                  <div><small>DOMAIN</small><strong>{selected.domain}</strong></div>
                  <div><small>TYPE</small><strong>{selected.type}</strong></div>
                  <div><small>STATE</small><strong>{selected.defaultState}</strong></div>
                  <div><small>VERSION</small><strong>{selected.version}</strong></div>
                </div>

                <section className={styles.section}>
                  <span>PRODUCT FAMILIES</span>
                  <p>{selected.productFamilies.join(" · ")}</p>
                </section>

                <section className={styles.section}>
                  <span>DEFAULT PROPERTIES</span>
                  <p>{propertySummary(selected)}</p>
                </section>

                <section className={styles.section}>
                  <span>ENGINEERING INTERFACES</span>
                  {Object.values(selected.ports).map((port) => (
                    <div className={styles.port} key={port.id}>
                      <small>{port.id} · {port.kind} · {port.direction}</small>
                      <strong>{port.compatibility.join(" / ")}</strong>
                    </div>
                  ))}
                  {Object.keys(selected.ports).length === 0 ? <p>Sem interfaces externas.</p> : null}
                </section>

                <section className={styles.section}>
                  <span>CAPABILITIES</span>
                  <p>{selected.capabilities.map((capability) => capability.label).join(" · ")}</p>
                </section>

                <footer className={styles.footer}>
                  <span>AUTHORED TEMPLATE · COMPONENT-LIBRARY</span>
                  <strong>Tehkné Solutions</strong>
                </footer>
              </section>
            ) : null}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
