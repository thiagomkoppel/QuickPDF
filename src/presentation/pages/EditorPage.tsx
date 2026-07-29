import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";

import { pageToScreenRect, screenToPagePoint, type Point } from "../../application/editor-geometry";
import type {
  EditorElementSnapshot,
  EditorSnapshot,
  PdfEditorApplication,
} from "../../application/editor-application";
import { calculateAnchoredScroll } from "../../application/editor-geometry";

interface EditorPageProps {
  readonly editor: PdfEditorApplication;
  readonly snapshot: EditorSnapshot;
  readonly onSnapshotChange: (snapshot: EditorSnapshot) => void;
  readonly onDocumentClosed: () => void;
}

interface DragState {
  readonly elementId: string;
  readonly mode: "move" | "resize";
  readonly startPointer: Point;
  readonly startBounds: EditorElementSnapshot["bounds"];
}

const formatZoom = (zoom: number): string => `${String(Math.round(zoom * 100))}%`;

export const EditorPage = ({
  editor,
  snapshot,
  onSnapshotChange,
  onDocumentClosed,
}: EditorPageProps): React.ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageInput, setPageInput] = useState(() => String(snapshot.state.currentPageNumber || 1));
  const [dragState, setDragState] = useState<DragState | undefined>();
  const state = snapshot.state;
  const currentPage = state.currentPage;

  const applySnapshot = (nextSnapshot: EditorSnapshot): void => {
    onSnapshotChange(nextSnapshot);
    setPageInput(String(nextSnapshot.state.currentPageNumber || 1));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || currentPage === undefined) {
      return;
    }
    let active = true;
    void editor.renderCurrentPage(canvas).then((nextSnapshot) => {
      if (active) {
        onSnapshotChange(nextSnapshot);
      }
    });
    return () => {
      active = false;
      editor.cancelRender();
    };
  }, [editor, onSnapshotChange, currentPage, state.currentPageNumber, state.zoom]);

  const pointFromEvent = (event: PointerEvent<HTMLElement>): Point | undefined => {
    const pageElement = pageRef.current;
    if (pageElement === null || currentPage === undefined) {
      return undefined;
    }
    const rect = pageElement.getBoundingClientRect();
    return screenToPagePoint(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      { pageWidth: currentPage.width, pageHeight: currentPage.height, scale: state.zoom },
    );
  };

  const closeDocument = (): void => {
    const nextSnapshot = editor.requestClose();
    onSnapshotChange(nextSnapshot);
    if (nextSnapshot.state.status === "empty") {
      onDocumentClosed();
    }
  };

  const confirmClose = async (): Promise<void> => {
    const nextSnapshot = await editor.confirmDiscard();
    onSnapshotChange(nextSnapshot);
    onDocumentClosed();
  };

  const submitPage = (): void => {
    const pageNumber = Number.parseInt(pageInput, 10);
    if (Number.isFinite(pageNumber)) {
      applySnapshot(editor.goToPage(pageNumber));
    }
  };

  const fitWidth = (): void => {
    const width = workspaceRef.current?.clientWidth ?? 0;
    applySnapshot(editor.fitWidth(Math.max(width - 48, 1)));
  };

  const handleOverlayPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) {
      return;
    }
    const point = pointFromEvent(event);
    if (point === undefined) {
      return;
    }
    if (state.tool === "text") {
      applySnapshot(editor.addText(point, "Text"));
      return;
    }
    if (state.tool === "whiteout") {
      applySnapshot(editor.addWhiteout({ x: point.x, y: point.y, width: 120, height: 48 }));
      return;
    }
    applySnapshot(editor.clearSelection());
  };

  const beginDrag = (
    event: PointerEvent<HTMLElement>,
    element: EditorElementSnapshot,
    mode: DragState["mode"],
  ): void => {
    event.stopPropagation();
    const point = pointFromEvent(event);
    if (point === undefined) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    applySnapshot(editor.selectElement(element.id));
    setDragState({ elementId: element.id, mode, startPointer: point, startBounds: element.bounds });
  };

  const continueDrag = (event: PointerEvent<HTMLElement>): void => {
    if (dragState === undefined) {
      return;
    }
    const point = pointFromEvent(event);
    if (point === undefined) {
      return;
    }
    const dx = point.x - dragState.startPointer.x;
    const dy = point.y - dragState.startPointer.y;
    if (dragState.mode === "move") {
      applySnapshot(
        editor.moveElement(dragState.elementId, {
          x: dragState.startBounds.x + dx,
          y: dragState.startBounds.y + dy,
        }),
      );
    } else {
      applySnapshot(
        editor.resizeElement(dragState.elementId, {
          width: dragState.startBounds.width + dx,
          height: dragState.startBounds.height + dy,
        }),
      );
    }
  };

  const finishDrag = (): void => {
    setDragState(undefined);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const selectedId = state.selectedElementId;
    if (selectedId === undefined) {
      return;
    }
    if (event.target instanceof HTMLTextAreaElement) {
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      applySnapshot(editor.deleteElement(selectedId));
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
      event.preventDefault();
      applySnapshot(editor.duplicateElement(selectedId));
    }
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>): void => {
    const result = editor.handleWheelZoom({
      deltaY: event.deltaY,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
    });
    if (!result.handled) {
      return;
    }
    event.preventDefault();
    const workspace = workspaceRef.current;
    if (workspace !== null) {
      const rect = workspace.getBoundingClientRect();
      const nextScroll = calculateAnchoredScroll({
        scrollLeft: workspace.scrollLeft,
        scrollTop: workspace.scrollTop,
        pointerX: event.clientX - rect.left,
        pointerY: event.clientY - rect.top,
        previousScale: state.zoom,
        nextScale: result.snapshot.state.zoom,
      });
      workspace.scrollLeft = nextScroll.x;
      workspace.scrollTop = nextScroll.y;
    }
    applySnapshot(result.snapshot);
  };

  if (currentPage === undefined) {
    return (
      <section className="page-section editor-empty" aria-labelledby="editor-title">
        <div className="content-stack">
          <p className="phase-label">No document open</p>
          <h1 id="editor-title">Open a PDF first</h1>
          <button type="button" onClick={onDocumentClosed}>
            Return home
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="editor-viewer" aria-labelledby="editor-title" onKeyDown={handleKeyDown}>
      <header className="editor-header">
        <button type="button" onClick={closeDocument}>
          Close document
        </button>
        <div>
          <h1 id="editor-title">{state.fileName ?? "Open PDF"}</h1>
          <p className="editor-subtitle" role="status">
            {state.isDirty ? "Unsaved temporary edits" : "No unsaved edits"}
          </p>
        </div>
        <button type="button" disabled>
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
          onClick={() => {
            if (state.selectedElementId !== undefined) {
              applySnapshot(editor.duplicateElement(state.selectedElementId));
            }
          }}
          disabled={state.selectedElementId === undefined}
        >
          Duplicate
        </button>
        <button
          type="button"
          onClick={() => {
            if (state.selectedElementId !== undefined) {
              applySnapshot(editor.deleteElement(state.selectedElementId));
            }
          }}
          disabled={state.selectedElementId === undefined}
        >
          Delete
        </button>
        <button
          type="button"
          onClick={() => {
            applySnapshot(editor.goPrevious());
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
          />
          <span>of {state.pageCount}</span>
        </form>
        <button
          type="button"
          onClick={() => {
            applySnapshot(editor.goNext());
          }}
          disabled={!snapshot.canGoNext}
        >
          Next
        </button>
        <button
          type="button"
          onClick={() => {
            applySnapshot(editor.zoomOut());
          }}
          disabled={!snapshot.canZoomOut}
        >
          Zoom out
        </button>
        <button
          type="button"
          onClick={() => {
            applySnapshot(editor.resetZoom());
          }}
        >
          {formatZoom(state.zoom)}
        </button>
        <button
          type="button"
          onClick={() => {
            applySnapshot(editor.zoomIn());
          }}
          disabled={!snapshot.canZoomIn}
        >
          Zoom in
        </button>
        <button type="button" onClick={fitWidth}>
          Fit width
        </button>
      </div>

      <p className="whiteout-note">
        Whiteout only covers content visually. It does not securely remove underlying PDF data.
      </p>

      <main
        className="viewer-main"
        ref={workspaceRef}
        onWheel={handleWheel}
        aria-label="PDF workspace"
      >
        <div
          ref={pageRef}
          className="pdf-page-frame"
          style={{ width: currentPage.width * state.zoom, height: currentPage.height * state.zoom }}
        >
          <canvas
            ref={canvasRef}
            className="pdf-page-canvas"
            aria-label={`PDF page ${String(state.currentPageNumber)} of ${String(state.pageCount)}`}
          />
          <div
            className="overlay-layer"
            aria-label="PDF overlay"
            onPointerDown={handleOverlayPointerDown}
            onPointerMove={continueDrag}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
          >
            {state.visibleElements.map((element) => {
              const rect = pageToScreenRect(element.bounds, {
                pageWidth: currentPage.width,
                pageHeight: currentPage.height,
                scale: state.zoom,
              });
              const selected = element.id === state.selectedElementId;
              return (
                <div
                  key={element.id}
                  className={`overlay-element overlay-${element.type}${selected ? " overlay-selected" : ""}`}
                  style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
                  tabIndex={0}
                  role="group"
                  aria-label={`${element.type} element${selected ? " selected" : ""}`}
                  onPointerDown={(event) => {
                    beginDrag(event, element, "move");
                  }}
                  onFocus={() => {
                    applySnapshot(editor.selectElement(element.id));
                  }}
                >
                  {element.type === "text" ? (
                    <textarea
                      value={element.text ?? ""}
                      aria-label="Edit text element"
                      style={{ fontSize: (element.textAppearance?.fontSize ?? 16) * state.zoom }}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                      }}
                      onChange={(event) => {
                        applySnapshot(editor.updateText(element.id, event.currentTarget.value));
                      }}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                      }}
                    />
                  ) : null}
                  <button
                    type="button"
                    className="resize-handle"
                    aria-label={`Resize ${element.type} element`}
                    onPointerDown={(event) => {
                      beginDrag(event, element, "resize");
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {state.pendingDiscardAction === "close" ? (
        <div className="dialog-backdrop" role="presentation">
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discard-title"
          >
            <h2 id="discard-title">Discard unsaved edits?</h2>
            <p>Closing this document will discard all temporary text and whiteout edits.</p>
            <div className="action-row">
              <button
                type="button"
                onClick={() => {
                  applySnapshot(editor.cancelDiscard());
                }}
              >
                Cancel
              </button>
              <button type="button" onClick={() => void confirmClose()}>
                Discard edits
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
