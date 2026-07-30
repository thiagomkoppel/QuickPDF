import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";

import type {
  EditorSnapshot,
  PdfEditorApplication,
  ExportElement,
} from "../../application/editor-application";
import type { PdfJsPageRenderer } from "../../infrastructure/pdf/pdfjs-page-renderer";

interface EditorPageProps {
  readonly editor: PdfEditorApplication;
  readonly snapshot: EditorSnapshot;
  readonly onSnapshotChange: (snapshot: EditorSnapshot) => void;
  readonly pdfRenderer: Pick<PdfJsPageRenderer, "startRenderPage" | "clearCanvas">;
}

type RenderStatus = "idle" | "loading" | "ready" | "error";

interface RenderState {
  readonly status: RenderStatus;
  readonly message?: string;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

const clampZoom = (value: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

const elementStyle = (element: ExportElement, scale: number): React.CSSProperties => ({
  left: element.bounds.x * scale,
  top: element.bounds.y * scale,
  width: element.bounds.width * scale,
  height: element.bounds.height * scale,
});

export const EditorPage = ({
  editor,
  snapshot,
  onSnapshotChange,
  pdfRenderer,
}: EditorPageProps): React.ReactElement => {
  const state = snapshot.state;
  const currentPage = state.currentPage;
  const currentPageId = currentPage?.id;
  const currentPageWidth = currentPage?.width;
  const currentPageHeight = currentPage?.height;
  const currentPageRotation = currentPage?.rotation;
  const editorViewportRef = useRef<HTMLElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderSequenceRef = useRef(0);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const [renderState, setRenderState] = useState<RenderState>({ status: "idle" });

  const applySnapshot = (nextSnapshot: EditorSnapshot): void => {
    onSnapshotChange(nextSnapshot);
  };

  const applyZoom = useCallback(
    (
      nextZoom: number,
      anchor?: {
        readonly workspace: HTMLElement;
        readonly clientX: number;
        readonly clientY: number;
      },
    ): void => {
      const currentZoom = zoomRef.current;
      const boundedZoom = clampZoom(nextZoom);
      if (boundedZoom === currentZoom) {
        return;
      }

      if (anchor !== undefined) {
        const rect = anchor.workspace.getBoundingClientRect();
        const anchorX = anchor.clientX - rect.left;
        const anchorY = anchor.clientY - rect.top;
        const pageX = (anchor.workspace.scrollLeft + anchorX) / currentZoom;
        const pageY = (anchor.workspace.scrollTop + anchorY) / currentZoom;
        requestAnimationFrame(() => {
          anchor.workspace.scrollLeft = pageX * boundedZoom - anchorX;
          anchor.workspace.scrollTop = pageY * boundedZoom - anchorY;
        });
      }

      zoomRef.current = boundedZoom;
      setZoom(boundedZoom);
    },
    [],
  );

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || currentPageId === undefined || state.renderDocumentId === undefined) {
      if (canvas !== null) {
        pdfRenderer.clearCanvas(canvas);
      }
      setRenderState({ status: "idle" });
      return;
    }

    const renderSequence = renderSequenceRef.current + 1;
    renderSequenceRef.current = renderSequence;
    setRenderState({ status: "loading" });
    const handle = pdfRenderer.startRenderPage({
      documentId: state.renderDocumentId,
      pageNumber: state.currentPageNumber,
      scale: zoom,
      devicePixelRatio: window.devicePixelRatio,
      canvas,
    });

    void handle.promise.then((result) => {
      if (renderSequenceRef.current !== renderSequence) {
        return;
      }
      if (!result.ok) {
        if (result.cancelled) {
          return;
        }
        setRenderState({ status: "error", message: result.error.message });
        return;
      }
      setRenderState({ status: "ready" });
    });

    return () => {
      renderSequenceRef.current += 1;
      handle.cancel();
      pdfRenderer.clearCanvas(canvas);
    };
  }, [
    currentPageHeight,
    currentPageId,
    currentPageRotation,
    currentPageWidth,
    pdfRenderer,
    state.currentPageNumber,
    state.renderDocumentId,
    zoom,
  ]);

  useEffect(() => {
    const editorViewport = editorViewportRef.current;
    const workspace = workspaceRef.current;
    if (editorViewport === null || workspace === null || currentPageId === undefined) {
      return;
    }

    const handleWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      applyZoom(zoomRef.current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), {
        workspace,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };

    editorViewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      editorViewport.removeEventListener("wheel", handleWheel);
    };
  }, [applyZoom, currentPageId]);

  useEffect(() => {
    if (currentPageId === undefined) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        applyZoom(zoomRef.current + ZOOM_STEP);
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        applyZoom(zoomRef.current - ZOOM_STEP);
        return;
      }
      if (event.key === "0") {
        event.preventDefault();
        applyZoom(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [applyZoom, currentPageId]);
  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (currentPage === undefined) {
      return;
    }
    if (event.target instanceof HTMLTextAreaElement) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: (event.clientX - rect.left) / zoom,
      y: (event.clientY - rect.top) / zoom,
    };
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return;
    }
    if (state.tool === "text") {
      applySnapshot(editor.addText(point, "Text"));
      return;
    }
    if (state.tool === "whiteout") {
      applySnapshot(editor.addWhiteout({ x: point.x, y: point.y, width: 120, height: 48 }));
    }
  };

  const download = async (): Promise<void> => {
    applySnapshot(await editor.exportCurrentPdf());
  };

  if (currentPage === undefined) {
    return (
      <section className="page-section editor-shell" aria-labelledby="editor-title">
        <div className="content-stack">
          <p className="phase-label">No document open</p>
          <h1 id="editor-title">Open a PDF first</h1>
          <p>Return home and choose a local PDF to start editing.</p>
        </div>
      </section>
    );
  }

  const pageCssWidth = currentPage.width * zoom;
  const pageCssHeight = currentPage.height * zoom;

  return (
    <section ref={editorViewportRef} className="editor-viewer" aria-labelledby="editor-title">
      <header className="editor-header">
        <div>
          <h1 id="editor-title">{state.fileName ?? "Open PDF"}</h1>
          <p className="editor-subtitle" role="status">
            {state.status === "exporting"
              ? "Preparing edited PDF..."
              : state.isDirty
                ? "Unsaved temporary edits"
                : "No unsaved edits"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void download()}
          disabled={!snapshot.canExport || state.status === "exporting"}
        >
          Download
        </button>
      </header>

      <div className="viewer-toolbar" aria-label="PDF editor controls">
        <button
          type="button"
          aria-pressed={state.tool === "select"}
          onClick={() => {
            applySnapshot(editor.setTool("select"));
          }}
        >
          Select
        </button>
        <button
          type="button"
          aria-pressed={state.tool === "text"}
          onClick={() => {
            applySnapshot(editor.setTool("text"));
          }}
        >
          Text
        </button>
        <button
          type="button"
          aria-pressed={state.tool === "whiteout"}
          onClick={() => {
            applySnapshot(editor.setTool("whiteout"));
          }}
        >
          Whiteout
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => {
            applyZoom(zoomRef.current - ZOOM_STEP);
          }}
        >
          -
        </button>
        <output aria-label="Zoom level">{Math.round(zoom * 100)}%</output>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => {
            applyZoom(zoomRef.current + ZOOM_STEP);
          }}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => {
            applyZoom(1);
          }}
        >
          Reset zoom
        </button>
      </div>

      <p className="whiteout-note">
        Whiteout only covers content visually. It does not securely remove underlying PDF data.
      </p>
      {state.exportFilename === undefined ? null : (
        <p className="status-note" role="status">
          Downloaded {state.exportFilename}. The editor remains open.
        </p>
      )}
      {state.error === undefined ? null : (
        <p className="error-message" role="alert">
          {state.error.message}
        </p>
      )}
      {renderState.status === "loading" ? (
        <p className="status-note" role="status">
          Rendering PDF page...
        </p>
      ) : null}
      {renderState.status === "error" ? (
        <p className="error-message" role="alert">
          {renderState.message ?? "The PDF page could not be rendered."}
        </p>
      ) : null}

      <div className="editor-viewport" aria-label="PDF editor viewport">
        <main ref={workspaceRef} className="viewer-main" aria-label="PDF workspace">
          <div
            className="pdf-page-frame"
            style={{ width: pageCssWidth, height: pageCssHeight }}
            aria-label={`PDF page ${String(state.currentPageNumber)} of ${String(state.pageCount)}`}
          >
            <canvas ref={canvasRef} className="pdf-page-canvas" aria-label="Rendered PDF page" />
            <div className="overlay-layer" aria-label="PDF overlay" onClick={handleOverlayClick}>
              {state.visibleElements.map((element) => (
                <div
                  key={element.id}
                  className={`overlay-element overlay-${element.type}`}
                  style={elementStyle(element, zoom)}
                  role="group"
                  aria-label={`${element.type} element`}
                >
                  {element.type === "text" ? (
                    <textarea
                      aria-label="Edit text element"
                      value={element.text ?? ""}
                      style={{ fontSize: (element.textAppearance?.fontSize ?? 16) * zoom }}
                      onChange={(event) => {
                        applySnapshot(editor.updateText(element.id, event.currentTarget.value));
                      }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </section>
  );
};
