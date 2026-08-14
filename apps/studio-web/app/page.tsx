export default function StudioPage() {
  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div>
          <span className="eyebrow">TEHKNÉ SOLUTIONS</span>
          <h1>TEHKNÉ STUDIO</h1>
        </div>
        <span className="phase">S1 · THE FIRST WORKSHOP</span>
      </header>

      <section className="workbench" aria-label="Bancada espacial do Tehkné Studio">
        <div className="bench-plane" />
        <div className="origin-marker" aria-hidden="true" />
        <div className="empty-state">
          <p>THE FIRST WORKBENCH</p>
          <strong>O que você quer construir ou compreender?</strong>
          <div className="actions">
            <button type="button">Chamar Desktop PC</button>
            <button type="button">Chamar ARM-01</button>
            <button type="button">Projeto vazio</button>
          </div>
        </div>
      </section>

      <footer className="studio-footer">
        <span>Workbench · Virtual</span>
        <span>Tehkné Solutions</span>
      </footer>
    </main>
  );
}
