import { useEffect, useRef, useState } from "react";

import type { PdfViewerApplication, PdfViewerSnapshot } from "../../application/pdf-viewer";

interface EditorPageProps {
  readonly viewer: PdfViewerApplication;
  readonly snapshot: PdfViewerSnapshot;
  readonly onSnapshotChange: (snapshot: PdfViewerSnapshot) => void;
  readonly onDocumentClosed: () => void;
}

const formatZoom = (zoom: number): string => `${String(Math.round(zoom * 100))}%`;

export const EditorPage = ({
  viewer,
  snapshot,
  onSnapshotChange,
  onDocumentClosed,
}: EditorPageProps): React.ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageFrameRef = useRef<HTMLDivElement>(null);
  const [pageInput, setPageInput] = useState(() => String(snapshot.state.currentPageNumber || 1));
  const state = snapshot.state;

  const applySnapshot = (nextSnapshot: PdfViewerSnapshot): void => {
    onSnapshotChange(nextSnapshot);
    setPageInput(String(nextSnapshot.state.currentPageNumber || 1));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || state.pageCount === 0) {
      return;
    }

    let active = true;
    void viewer.renderCurrentPage(canvas).then((nextSnapshot) => {
      if (active) {
        onSnapshotChange(nextSnapshot);
      }
    });

    return () => {
      active = false;
      viewer.cancelRender();
    };
  }, [viewer, onSnapshotChange, state.currentPageNumber, state.pageCount, state.zoom]);

  const closeDocument = (): void => {
    const canvas = canvasRef.current;
    if (canvas !== null) {
      const context = canvas.getContext("2d");
      context?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    }
    onSnapshotChange(viewer.closeDocument());
    onDocumentClosed();
  };

  const submitPage = (): void => {
    const pageNumber = Number.parseInt(pageInput, 10);
    if (Number.isFinite(pageNumber)) {
      applySnapshot(viewer.goToPage(pageNumber));
    }
  };

  const fitWidth = (): void => {
    const availableWidth = pageFrameRef.current?.clientWidth ?? 0;
    applySnapshot(viewer.fitWidth(Math.max(availableWidth - 32, 1)));
  };

  if (state.pageCount === 0) {
    return (
      <section className="page-section editor-empty" aria-labelledby="editor-title">
        <div className="content-stack">
          <p className="phase-label">No document open</p>
          <h1 id="editor-title">Open a PDF first</h1>
          <p className="privacy-promise">
            Your PDF is processed in your browser and is not uploaded to us.
          </p>
          <button type="button" onClick={onDocumentClosed}>
            Return home
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="editor-viewer" aria-labelledby="editor-title">
      <header className="editor-header">
        <button type="button" onClick={closeDocument}>
          Close document
        </button>
        <div>
          <h1 id="editor-title">{state.fileName ?? "Open PDF"}</h1>
          <p className="editor-subtitle">Processed locally in this browser.</p>
        </div>
        <button type="button" disabled>
          Download
        </button>
      </header>

      <div className="viewer-toolbar" aria-label="PDF viewer controls">
        <button
          type="button"
          onClick={() => {
            applySnapshot(viewer.goPrevious());
          }}
          disabled={!snapshot.canGoPrevious}
        >
          Previous
        </button>
        <form
          className="page-jump"
          onSubmit={(event) => {
            event.preventDefault();
            submitPage();
          }}
        >
          <label htmlFor="page-number">Page</label>
          <input
            id="page-number"
            inputMode="numeric"
            value={pageInput}
            onChange={(event) => {
              setPageInput(event.currentTarget.value);
            }}
            onBlur={submitPage}
            aria-describedby="page-count"
          />
          <span id="page-count">of {state.pageCount}</span>
        </form>
        <button
          type="button"
          onClick={() => {
            applySnapshot(viewer.goNext());
          }}
          disabled={!snapshot.canGoNext}
        >
          Next
        </button>
        <button
          type="button"
          onClick={() => {
            applySnapshot(viewer.zoomOut());
          }}
          disabled={!snapshot.canZoomOut}
        >
          Zoom out
        </button>
        <button
          type="button"
          onClick={() => {
            applySnapshot(viewer.resetZoom());
          }}
        >
          {formatZoom(state.zoom)}
        </button>
        <button
          type="button"
          onClick={() => {
            applySnapshot(viewer.zoomIn());
          }}
          disabled={!snapshot.canZoomIn}
        >
          Zoom in
        </button>
        <button type="button" onClick={fitWidth}>
          Fit width
        </button>
      </div>

      <main className="viewer-main" ref={pageFrameRef} aria-label="Rendered PDF page">
        {state.status === "rendering" ? (
          <p className="viewer-status" role="status">
            Rendering page {state.currentPageNumber}...
          </p>
        ) : null}
        {state.error === undefined ? null : (
          <p className="error-message viewer-error" role="alert">
            {state.error.message}
          </p>
        )}
        <canvas
          ref={canvasRef}
          className="pdf-page-canvas"
          aria-label={`PDF page ${String(state.currentPageNumber)} of ${String(state.pageCount)}`}
        />
      </main>
    </section>
  );
};
