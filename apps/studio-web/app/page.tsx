import { SpatialWorkbench } from "../components/SpatialWorkbench";

export default function StudioPage() {
  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div>
          <span className="eyebrow">TEHKNÉ SOLUTIONS</span>
          <h1>TEHKNÉ STUDIO</h1>
        </div>
        <span className="phase">S1.6 · STUDIO INTELLIGENCE</span>
      </header>

      <SpatialWorkbench />

      <footer className="studio-footer">
        <span>Workbench · Contextual Intent · Voice · Engineering Core</span>
        <span>Tehkné Solutions</span>
      </footer>
    </main>
  );
}
