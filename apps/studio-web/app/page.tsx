import { SpatialWorkbench } from "../components/SpatialWorkbench";

export default function StudioPage() {
  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div>
          <span className="eyebrow">TEHKNÉ SOLUTIONS</span>
          <h1>TEHKNÉ STUDIO</h1>
        </div>
        <span className="phase">ALPHA 01 · THE FIRST WORKSHOP</span>
      </header>

      <SpatialWorkbench />

      <footer className="studio-footer">
        <span>Engineering Graph · Intelligence · Automation · Robotics · Failure · Variants · Virtual Factory</span>
        <span>Tehkné Solutions · Alpha 01</span>
      </footer>
    </main>
  );
}
