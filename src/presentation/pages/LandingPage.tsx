import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

import type { PdfViewerApplication, PdfViewerSnapshot } from "../../application/pdf-viewer";

interface LandingPageProps {
  readonly viewer: PdfViewerApplication;
  readonly snapshot: PdfViewerSnapshot;
  readonly onSnapshotChange: (snapshot: PdfViewerSnapshot) => void;
  readonly onDocumentOpened: () => void;
}

const oneFileError = "Choose one PDF file at a time.";

export const LandingPage = ({
  viewer,
  snapshot,
  onSnapshotChange,
  onDocumentOpened,
}: LandingPageProps): React.ReactElement => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropActive, setDropActive] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>();

  const openFile = async (files: FileList | readonly File[] | null): Promise<void> => {
    setLocalError(undefined);
    if (files === null || files.length === 0) {
      return;
    }

    if (files.length !== 1) {
      setLocalError(oneFileError);
      return;
    }

    const selectedFile = files[0];
    if (selectedFile === undefined) {
      return;
    }

    const nextSnapshot = await viewer.openFile(selectedFile);
    onSnapshotChange(nextSnapshot);
    if (nextSnapshot.state.status === "ready") {
      onDocumentOpened();
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    void openFile(event.currentTarget.files);
    event.currentTarget.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    setDropActive(false);
    void openFile(Array.from(event.dataTransfer.files));
  };

  const visibleError = localError ?? snapshot.state.error?.message;

  return (
    <section className="page-section landing-page" aria-labelledby="landing-title">
      <div className="content-stack">
        <p className="phase-label">Local PDF viewer</p>
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
    </section>
  );
};
