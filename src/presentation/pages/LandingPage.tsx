import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

import type { EditorSnapshot, PdfEditorApplication } from "../../application/editor-application";

interface LandingPageProps {
  readonly editor: PdfEditorApplication;
  readonly snapshot: EditorSnapshot;
  readonly onSnapshotChange: (snapshot: EditorSnapshot) => void;
  readonly onDocumentOpened: () => void;
}

const multipleFilesMessage = "Choose one PDF file at a time.";

export const LandingPage = ({
  editor,
  snapshot,
  onSnapshotChange,
  onDocumentOpened,
}: LandingPageProps): React.ReactElement => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropActive, setDropActive] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>();

  const openFiles = async (files: FileList | readonly File[] | null): Promise<void> => {
    setLocalError(undefined);
    if (files === null || files.length === 0) {
      return;
    }
    if (files.length !== 1) {
      setLocalError(multipleFilesMessage);
      return;
    }
    const selectedFile = files[0];
    if (selectedFile === undefined) {
      return;
    }

    const nextSnapshot = await editor.openFile(selectedFile);
    onSnapshotChange(nextSnapshot);
    if (
      nextSnapshot.state.status === "ready" &&
      nextSnapshot.state.pendingDiscardAction === undefined
    ) {
      onDocumentOpened();
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    void openFiles(event.currentTarget.files);
    event.currentTarget.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    setDropActive(false);
    void openFiles(Array.from(event.dataTransfer.files));
  };

  const confirmReplacement = async (): Promise<void> => {
    const nextSnapshot = await editor.confirmDiscard();
    onSnapshotChange(nextSnapshot);
    if (nextSnapshot.state.status === "ready") {
      onDocumentOpened();
    }
  };

  const visibleError = localError ?? snapshot.state.error?.message;

  return (
    <section className="page-section landing-page" aria-labelledby="landing-title">
      <div className="content-stack">
        <p className="phase-label">Local overlay editor</p>
        <h1 id="landing-title">QuickPDF</h1>
        <p className="product-statement">Fill, sign, fix, and download a PDF in minutes.</p>
        <p className="privacy-promise">
          Your PDF is processed in your browser and is not uploaded to us.
        </p>
        <label
          className={dropActive ? "file-drop-zone file-drop-zone-active" : "file-drop-zone"}
          onDragOver={(event) => {
            event.preventDefault();
            setDropActive(true);
          }}
          onDragLeave={() => {
            setDropActive(false);
          }}
          onDrop={handleDrop}
        >
          <span className="file-drop-title">Open a local PDF</span>
          <span className="file-drop-note">Select one PDF or drop it here.</span>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileChange}
          />
        </label>
        <div className="action-row" aria-label="PDF selection actions">
          <button type="button" onClick={() => inputRef.current?.click()}>
            Choose PDF
          </button>
        </div>
        {snapshot.state.status === "loading" ? (
          <p className="status-note" role="status">
            Reading PDF locally...
          </p>
        ) : null}
        {visibleError === undefined ? null : (
          <p className="error-message" role="alert">
            {visibleError}
          </p>
        )}
      </div>

      {snapshot.state.pendingDiscardAction === "replace" ? (
        <div className="dialog-backdrop" role="presentation">
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="replace-title"
          >
            <h2 id="replace-title">Discard unsaved edits?</h2>
            <p>Opening another PDF will discard the temporary edits in the current document.</p>
            <div className="action-row">
              <button
                type="button"
                onClick={() => {
                  onSnapshotChange(editor.cancelDiscard());
                }}
              >
                Cancel
              </button>
              <button type="button" onClick={() => void confirmReplacement()}>
                Discard and open
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
