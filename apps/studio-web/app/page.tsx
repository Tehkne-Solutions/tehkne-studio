import { SpatialWorkbench } from "../components/SpatialWorkbench";

export default function StudioPage() {
  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div>
          <span className="eyebrow">TEHKNÉ SOLUTIONS</span>
          <h1>TEHKNÉ STUDIO</h1>
        </div>
        <span className="phase">S1.11 · VIRTUAL FACTORY</span>
      </header>

      <SpatialWorkbench />

      <footer className="studio-footer">
        <span>Workbench · Failure Evidence · Variants · BOM · Assembly Plan · Prototype Package</span>
        <span>Tehkné Solutions</span>
      </footer>
    </main>
  );
}
