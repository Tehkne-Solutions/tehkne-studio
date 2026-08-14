import { SpatialWorkbench } from "../components/SpatialWorkbench";

export default function StudioPage() {
  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div>
          <span className="eyebrow">TEHKNÉ SOLUTIONS</span>
          <h1>TEHKNÉ STUDIO</h1>
        </div>
        <span className="phase">S1.3 · ENGINEERING CORE UX</span>
      </header>

      <SpatialWorkbench />

      <footer className="studio-footer">
        <span>Workbench · Engineering Session · Semantic History</span>
        <span>Tehkné Solutions</span>
      </footer>
    </main>
  );
}
