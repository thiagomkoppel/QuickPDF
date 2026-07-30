import type { ChangeEvent, DragEvent } from "react";

import type { EditorSnapshot, PdfEditorApplication } from "../../application/editor-application";

interface LandingPageProps {
  readonly editor: PdfEditorApplication;
  readonly snapshot: EditorSnapshot;
  readonly onSnapshotChange: (snapshot: EditorSnapshot) => void;
  readonly onDocumentOpened: () => void;
}

export const LandingPage = ({
  editor,
  snapshot,
  onSnapshotChange,
  onDocumentOpened,
}: LandingPageProps): React.ReactElement => {
  const openFile = async (file: File | undefined): Promise<void> => {
    if (file === undefined) {
      return;
    }
    const nextSnapshot = await editor.openFile(file);
    onSnapshotChange(nextSnapshot);
    if (nextSnapshot.state.status === "ready") {
      onDocumentOpened();
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    void openFile(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    void openFile(event.dataTransfer.files[0]);
  };

  return (
    <section className="page-section landing-page" aria-labelledby="landing-title">
      <div className="content-stack">
        <p className="phase-label">Local PDF editor</p>
        <h1 id="landing-title">QuickPDF</h1>
        <p className="product-statement">Fill, sign, fix, and download a PDF in minutes.</p>
        <p className="privacy-promise">
          Your PDF is processed in your browser and is not uploaded to us.
        </p>
        <label
          className="file-drop"
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={handleDrop}
        >
          <span className="file-drop-title">Open a local PDF</span>
          <span className="file-drop-note">Select one PDF or drop it here.</span>
          <input type="file" accept="application/pdf,.pdf" onChange={handleChange} />
        </label>
        {snapshot.state.status === "loading" ? <p role="status">Reading PDF locally...</p> : null}
        {snapshot.state.error === undefined ? null : (
          <p className="error-message" role="alert">
            {snapshot.state.error.message}
          </p>
        )}
      </div>
    </section>
  );
};
