import { SpatialWorkbench } from "../components/SpatialWorkbench";

export default function StudioPage() {
  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div>
          <span className="eyebrow">TEHKNÉ SOLUTIONS</span>
          <h1>TEHKNÉ STUDIO</h1>
        </div>
        <span className="phase">S1.7 · BEHAVIOR RUNTIME</span>
      </header>

      <SpatialWorkbench />

      <footer className="studio-footer">
        <span>Workbench · Behavior IR · Telemetry · Automation · Thermal Simulation</span>
        <span>Tehkné Solutions</span>
      </footer>
    </main>
  );
}
