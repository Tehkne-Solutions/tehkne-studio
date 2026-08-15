import { ComponentLibraryPanel } from "../components/ComponentLibraryPanel";
import { ElectronicsWorkbenchExperience } from "../components/ElectronicsWorkbenchExperience";
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
      <ComponentLibraryPanel />
      <ElectronicsWorkbenchExperience />

      <footer className="studio-footer">
        <span>Engineering Graph · Component Library · Intelligence · Automation · Robotics · Electronics · Failure · Variants · Virtual Factory</span>
        <span>Tehkné Solutions · Alpha 01</span>
      </footer>
    </main>
  );
}
