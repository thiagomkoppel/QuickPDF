export const LandingPage = (): React.ReactElement => (
  <section className="page-section landing-page" aria-labelledby="landing-title">
    <div className="content-stack">
      <p className="phase-label">Phase 0 foundation</p>
      <h1 id="landing-title">QuickPDF</h1>
      <p className="product-statement">Fill, sign, fix, and download a PDF in minutes.</p>
      <p className="privacy-promise">
        Your PDF is processed in your browser and is not uploaded to us.
      </p>
      <div className="action-row" aria-label="PDF selection status">
        <button type="button" disabled>
          PDF selection coming later
        </button>
        <a className="development-link" href="/editor">
          View editor route
        </a>
      </div>
      <p className="status-note">
        The repository foundation is being built first. PDF loading, rendering, editing, signing,
        and export are intentionally unavailable in this task.
      </p>
    </div>
  </section>
);
