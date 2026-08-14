import { SpatialWorkbench } from "../components/SpatialWorkbench";

export default function StudioPage() {
  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div>
          <span className="eyebrow">TEHKNÉ SOLUTIONS</span>
          <h1>TEHKNÉ STUDIO</h1>
        </div>
        <span className="phase">S1.9 · FAILURE SIMULATION</span>
      </header>

      <SpatialWorkbench />

      <footer className="studio-footer">
        <span>Workbench · Engineering Graph · Robotics · Failure Lab · Causal Evidence · Simulation</span>
        <span>Tehkné Solutions</span>
      </footer>
    </main>
  );
}
