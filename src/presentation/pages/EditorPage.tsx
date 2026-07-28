export const EditorPage = (): React.ReactElement => (
  <section className="page-section editor-shell" aria-labelledby="editor-title">
    <div className="content-stack">
      <p className="phase-label">Development route</p>
      <h1 id="editor-title">Editor shell</h1>
      <p>
        PDF loading, rendering, editing, signing, and export are not implemented yet. This route
        exists to verify the client-side shell, routing, accessibility landmarks, and foundation
        tooling.
      </p>
    </div>
  </section>
);
