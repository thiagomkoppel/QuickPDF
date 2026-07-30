import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";

import type {
  EditorSnapshot,
  PdfEditorApplication,
  ExportElement,
  SignatureFont,
  SignatureImageInput,
  SignatureElementType,
} from "../../application/editor-application";
import {
  MAX_TEXT_FONT_SIZE,
  MIN_ELEMENT_HEIGHT,
  MIN_ELEMENT_WIDTH,
  MIN_TEXT_FONT_SIZE,
  validateSignatureImageFile,
} from "../../application/editor-application";
import type { PdfJsPageRenderer } from "../../infrastructure/pdf/pdfjs-page-renderer";

interface EditorPageProps {
  readonly editor: PdfEditorApplication;
  readonly snapshot: EditorSnapshot;
  readonly onSnapshotChange: (snapshot: EditorSnapshot) => void;
  readonly pdfRenderer: Pick<PdfJsPageRenderer, "startRenderPage" | "clearCanvas">;
}

type RenderStatus = "idle" | "loading" | "ready" | "error";
type SignatureDialogMode = "draw" | "type" | "upload";
type PointerAction =
  | {
      readonly kind: "move";
      readonly elementId: string;
      readonly offsetX: number;
      readonly offsetY: number;
    }
  | {
      readonly kind: "resize";
      readonly elementId: string;
      readonly startX: number;
      readonly startY: number;
    };

interface WhiteoutDraft {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly currentX: number;
  readonly currentY: number;
}

interface RenderState {
  readonly status: RenderStatus;
  readonly message?: string;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
const MIN_WHITEOUT_DRAG_DISTANCE = 4;
const SIGNATURE_FONTS: readonly { readonly value: SignatureFont; readonly label: string }[] = [
  { value: "cursive", label: "Signature Script" },
  { value: "serif", label: "Serif Italic" },
  { value: "marker", label: "Marker" },
  { value: "hand", label: "Handwritten" },
];

const clampZoom = (value: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

const boundsStyle = (
  bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
  scale: number,
): React.CSSProperties => ({
  left: bounds.x * scale,
  top: bounds.y * scale,
  width: bounds.width * scale,
  height: bounds.height * scale,
});

const elementStyle = (element: ExportElement, scale: number): React.CSSProperties =>
  boundsStyle(element.bounds, scale);

const signatureTextClass = (fontFamily: string | undefined): string =>
  `signature-text signature-font-${fontFamily ?? "cursive"}`;

const defaultPlacement = (
  type: SignatureElementType,
): { readonly x: number; readonly y: number } =>
  type === "signature" ? { x: 56, y: 250 } : { x: 56, y: 180 };
const activeToolLabel = (active: boolean): React.ReactElement | null =>
  active ? (
    <span className="active-tool-label" aria-hidden="true">
      Active
    </span>
  ) : null;

const isMeaningfulWhiteoutDrag = (draft: WhiteoutDraft): boolean =>
  Math.abs(draft.currentX - draft.startX) >= MIN_WHITEOUT_DRAG_DISTANCE &&
  Math.abs(draft.currentY - draft.startY) >= MIN_WHITEOUT_DRAG_DISTANCE;

const whiteoutBoundsFromDraft = (
  draft: WhiteoutDraft,
  page: { readonly width: number; readonly height: number },
  enforceMinimum: boolean,
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } => {
  const left = Math.min(draft.startX, draft.currentX);
  const top = Math.min(draft.startY, draft.currentY);
  const rawWidth = Math.abs(draft.currentX - draft.startX);
  const rawHeight = Math.abs(draft.currentY - draft.startY);
  const x = Math.min(Math.max(left, 0), page.width);
  const y = Math.min(Math.max(top, 0), page.height);
  const width = Math.min(
    Math.max(enforceMinimum ? MIN_ELEMENT_WIDTH : 1, rawWidth),
    Math.max(0, page.width - x),
  );
  const height = Math.min(
    Math.max(enforceMinimum ? MIN_ELEMENT_HEIGHT : 1, rawHeight),
    Math.max(0, page.height - y),
  );
  return { x, y, width, height };
};

const canvasToImageInput = (
  canvas: HTMLCanvasElement,
  source: "draw" | "upload",
): SignatureImageInput => ({
  dataUrl: canvas.toDataURL("image/png"),
  mimeType: "image/png",
  width: canvas.width,
  height: canvas.height,
  source,
});

const elementLabel = (element: ExportElement): string => {
  switch (element.type) {
    case "text":
      return "Text";
    case "whiteout":
      return "Whiteout";
    case "signature":
      return "Signature";
    case "initials":
      return "Initials";
  }
};

const isEditingKeyboardTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable ||
    target.closest("[contenteditable='true'], [contenteditable='plaintext-only']") !== null ||
    (target instanceof HTMLCanvasElement && target.classList.contains("signature-pad"))
  );
};

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
  const overlayLayerRef = useRef<HTMLDivElement | null>(null);
  const renderSequenceRef = useRef(0);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const [renderState, setRenderState] = useState<RenderState>({ status: "idle" });
  const [dialogType, setDialogType] = useState<SignatureElementType | undefined>();
  const [pointerAction, setPointerAction] = useState<PointerAction | undefined>();
  const [whiteoutDraft, setWhiteoutDraft] = useState<WhiteoutDraft | undefined>();
  const [editingTextElementId, setEditingTextElementId] = useState<string | undefined>();
  const editingTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const textFocusRetryRef = useRef<number | undefined>(undefined);

  const applySnapshot = useCallback(
    (nextSnapshot: EditorSnapshot): void => {
      onSnapshotChange(nextSnapshot);
    },
    [onSnapshotChange],
  );

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

  const setEditingTextArea = useCallback((textarea: HTMLTextAreaElement | null): void => {
    editingTextAreaRef.current = textarea;
    if (textFocusRetryRef.current !== undefined) {
      window.clearTimeout(textFocusRetryRef.current);
      textFocusRetryRef.current = undefined;
    }
    if (textarea === null) {
      return;
    }
    const focusTextArea = (): void => {
      if (editingTextAreaRef.current !== textarea) {
        return;
      }
      textarea.focus();
      textarea.select();
    };
    focusTextArea();
    textFocusRetryRef.current = window.setTimeout(focusTextArea, 0);
  }, []);

  useEffect(
    () => () => {
      if (textFocusRetryRef.current !== undefined) {
        window.clearTimeout(textFocusRetryRef.current);
      }
    },
    [],
  );
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
      if (whiteoutDraft !== undefined && event.key === "Escape") {
        event.preventDefault();
        setWhiteoutDraft(undefined);
        return;
      }
      if (editingTextElementId !== undefined) {
        if (event.key === "Escape" && isEditingKeyboardTarget(event.target)) {
          event.preventDefault();
          setEditingTextElementId(undefined);
        }
        if (isEditingKeyboardTarget(event.target)) {
          return;
        }
      }
      if (
        state.selectedElementId !== undefined &&
        event.key === "Enter" &&
        state.selectedElement?.type === "text"
      ) {
        event.preventDefault();
        setEditingTextElementId(state.selectedElementId);
        return;
      }
      if (
        state.selectedElementId !== undefined &&
        (event.key === "Delete" || event.key === "Backspace") &&
        !isEditingKeyboardTarget(event.target)
      ) {
        event.preventDefault();
        setEditingTextElementId(undefined);
        applySnapshot(editor.deleteElement(state.selectedElementId));
        return;
      }
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
  }, [
    applySnapshot,
    applyZoom,
    currentPageId,
    editingTextElementId,
    editor,
    state.selectedElement,
    state.selectedElementId,
    whiteoutDraft,
  ]);

  useEffect(() => {
    if (pointerAction === undefined) {
      return;
    }

    const handlePointerMove = (event: globalThis.PointerEvent): void => {
      const overlayLayer = overlayLayerRef.current;
      if (overlayLayer === null) {
        return;
      }
      const rect = overlayLayer.getBoundingClientRect();
      const point = {
        x: (event.clientX - rect.left) / zoom,
        y: (event.clientY - rect.top) / zoom,
      };
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return;
      }
      if (pointerAction.kind === "move") {
        applySnapshot(
          editor.moveElement(pointerAction.elementId, {
            x: point.x - pointerAction.offsetX,
            y: point.y - pointerAction.offsetY,
          }),
        );
        return;
      }
      applySnapshot(
        editor.resizeElement(pointerAction.elementId, {
          width: point.x - pointerAction.startX,
          height: point.y - pointerAction.startY,
        }),
      );
    };

    const stopPointerAction = (): void => {
      setPointerAction(undefined);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopPointerAction, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopPointerAction);
    };
  }, [applySnapshot, editor, pointerAction, zoom]);

  const pointFromOverlayEvent = (
    event: Pick<PointerEvent<HTMLDivElement>, "clientX" | "clientY" | "currentTarget">,
  ): { readonly x: number; readonly y: number } | undefined => {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: (event.clientX - rect.left) / zoom,
      y: (event.clientY - rect.top) / zoom,
    };
    return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : undefined;
  };

  const startWhiteoutDraft = (event: PointerEvent<HTMLDivElement>): void => {
    if (currentPage === undefined || state.tool !== "whiteout") {
      return;
    }
    if (event.target instanceof HTMLElement && event.target.closest(".overlay-element") !== null) {
      return;
    }
    const point = pointFromOverlayEvent(event);
    if (point === undefined) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (editingTextElementId !== undefined) {
      setEditingTextElementId(undefined);
    }
    setWhiteoutDraft({
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
    });
  };

  const updateWhiteoutDraft = (event: PointerEvent<HTMLDivElement>): void => {
    if (whiteoutDraft?.pointerId !== event.pointerId) {
      return;
    }
    const point = pointFromOverlayEvent(event);
    if (point === undefined) {
      return;
    }
    setWhiteoutDraft({ ...whiteoutDraft, currentX: point.x, currentY: point.y });
  };

  const finishWhiteoutDraft = (event: PointerEvent<HTMLDivElement>): void => {
    if (whiteoutDraft?.pointerId !== event.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const finalDraft = whiteoutDraft;
    setWhiteoutDraft(undefined);
    if (currentPage === undefined || !isMeaningfulWhiteoutDrag(finalDraft)) {
      return;
    }
    const bounds = whiteoutBoundsFromDraft(finalDraft, currentPage, true);
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }
    applySnapshot(editor.addWhiteout(bounds));
  };

  const cancelWhiteoutDraft = (event: PointerEvent<HTMLDivElement>): void => {
    if (
      whiteoutDraft !== undefined &&
      event.currentTarget.hasPointerCapture(whiteoutDraft.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(whiteoutDraft.pointerId);
    }
    setWhiteoutDraft(undefined);
  };
  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (currentPage === undefined) {
      return;
    }
    if (event.target instanceof HTMLTextAreaElement) {
      return;
    }
    if (event.target instanceof HTMLElement && event.target.closest(".overlay-element") !== null) {
      return;
    }
    if (editingTextElementId !== undefined) {
      setEditingTextElementId(undefined);
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
      const nextSnapshot = editor.addText(point, "Text");
      applySnapshot(nextSnapshot);
      setEditingTextElementId(nextSnapshot.state.selectedElementId);
      return;
    }
  };

  const startElementMove = (element: ExportElement, event: PointerEvent<HTMLDivElement>): void => {
    if (
      event.target instanceof HTMLTextAreaElement ||
      (event.target as HTMLElement).dataset.resizeHandle === "true"
    ) {
      return;
    }
    event.preventDefault();
    event.currentTarget.focus();
    if (editingTextElementId !== undefined && editingTextElementId !== element.id) {
      setEditingTextElementId(undefined);
    }
    applySnapshot(editor.selectElement(element.id));
    const overlayLayer = overlayLayerRef.current;
    if (overlayLayer === null) {
      return;
    }
    const rect = overlayLayer.getBoundingClientRect();
    const point = {
      x: (event.clientX - rect.left) / zoom,
      y: (event.clientY - rect.top) / zoom,
    };
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return;
    }
    setPointerAction({
      kind: "move",
      elementId: element.id,
      offsetX: point.x - element.bounds.x,
      offsetY: point.y - element.bounds.y,
    });
  };

  const startElementResize = (
    element: ExportElement,
    event: PointerEvent<HTMLButtonElement>,
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    applySnapshot(editor.selectElement(element.id));
    setPointerAction({
      kind: "resize",
      elementId: element.id,
      startX: element.bounds.x,
      startY: element.bounds.y,
    });
  };

  const download = async (): Promise<void> => {
    applySnapshot(await editor.exportCurrentPdf());
  };

  const acceptSignatureImage = (image: SignatureImageInput): void => {
    if (dialogType === undefined) {
      return;
    }
    const point = defaultPlacement(dialogType);
    applySnapshot(
      dialogType === "signature"
        ? image.source === "upload"
          ? editor.addUploadedSignature(point, image)
          : editor.addDrawnSignature(point, image)
        : editor.addDrawnInitials(point, image),
    );
    setDialogType(undefined);
  };

  const acceptTypedSignature = (text: string, fontFamily: SignatureFont): void => {
    if (dialogType === undefined) {
      return;
    }
    const point = defaultPlacement(dialogType);
    applySnapshot(
      dialogType === "signature"
        ? editor.addTypedSignature(point, { text, fontFamily })
        : editor.addTypedInitials(point, { text, fontFamily }),
    );
    setDialogType(undefined);
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
  const selectedElement = state.selectedElement;
  const whiteoutPreviewBounds =
    whiteoutDraft === undefined
      ? undefined
      : whiteoutBoundsFromDraft(whiteoutDraft, currentPage, false);

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
          <span>Select</span>
          {activeToolLabel(state.tool === "select")}
        </button>
        <button
          type="button"
          aria-pressed={state.tool === "text"}
          onClick={() => {
            applySnapshot(editor.setTool("text"));
          }}
        >
          <span>Text</span>
          {activeToolLabel(state.tool === "text")}
        </button>
        <button
          type="button"
          aria-pressed={state.tool === "signature"}
          onClick={() => {
            applySnapshot(editor.setTool("signature"));
            setDialogType("signature");
          }}
        >
          <span>Signature</span>
          {activeToolLabel(state.tool === "signature")}
        </button>
        <button
          type="button"
          aria-pressed={state.tool === "initials"}
          onClick={() => {
            applySnapshot(editor.setTool("initials"));
            setDialogType("initials");
          }}
        >
          <span>Initials</span>
          {activeToolLabel(state.tool === "initials")}
        </button>
        <button
          type="button"
          aria-pressed={state.tool === "whiteout"}
          onClick={() => {
            applySnapshot(editor.setTool("whiteout"));
          }}
        >
          <span>Whiteout</span>
          {activeToolLabel(state.tool === "whiteout")}
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
            <div
              ref={overlayLayerRef}
              className="overlay-layer"
              aria-label="PDF overlay"
              onClick={handleOverlayClick}
              onPointerDown={startWhiteoutDraft}
              onPointerMove={updateWhiteoutDraft}
              onPointerUp={finishWhiteoutDraft}
              onPointerCancel={cancelWhiteoutDraft}
            >
              {whiteoutPreviewBounds === undefined ? null : (
                <div
                  className="whiteout-preview"
                  aria-label="Whiteout preview"
                  style={boundsStyle(whiteoutPreviewBounds, zoom)}
                />
              )}
              {state.visibleElements.map((element) => (
                <div
                  key={element.id}
                  className={`overlay-element overlay-${element.type}${state.selectedElementId === element.id ? " is-selected" : ""}`}
                  style={elementStyle(element, zoom)}
                  role="group"
                  aria-label={`${element.type} element`}
                  aria-description={
                    element.type === "text" ? "Press Enter to edit selected text." : undefined
                  }
                  tabIndex={element.type === "text" ? 0 : undefined}
                  onPointerDown={(event) => {
                    startElementMove(element, event);
                  }}
                >
                  {element.type === "text" ? (
                    editingTextElementId === element.id ? (
                      <textarea
                        ref={setEditingTextArea}
                        aria-label="Edit text element"
                        autoFocus
                        value={element.text ?? ""}
                        style={{ fontSize: (element.textAppearance?.fontSize ?? 16) * zoom }}
                        onChange={(event) => {
                          applySnapshot(editor.updateText(element.id, event.currentTarget.value));
                        }}
                        onBlur={() => {
                          setEditingTextElementId(undefined);
                        }}
                      />
                    ) : (
                      <div
                        className="text-element-display"
                        aria-label="Text element content"
                        style={{ fontSize: (element.textAppearance?.fontSize ?? 16) * zoom }}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          setEditingTextElementId(element.id);
                        }}
                      >
                        {element.text}
                      </div>
                    )
                  ) : null}
                  {element.type === "signature" || element.type === "initials" ? (
                    element.image === undefined ? (
                      <div
                        className={signatureTextClass(element.textAppearance?.fontFamily)}
                        style={{ fontSize: (element.textAppearance?.fontSize ?? 30) * zoom }}
                      >
                        {element.text}
                      </div>
                    ) : (
                      <img src={element.image.dataUrl} alt="" draggable={false} />
                    )
                  ) : null}
                  {state.selectedElementId === element.id ? (
                    <button
                      type="button"
                      className="resize-handle"
                      aria-label={`Resize ${element.type} element`}
                      data-resize-handle="true"
                      onPointerDown={(event) => {
                        startElementResize(element, event);
                      }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {selectedElement === undefined ? null : (
        <aside className="element-inspector" aria-label="Selected element actions">
          <strong>{elementLabel(selectedElement)}</strong>
          <label>
            Width
            <input
              aria-label="Selected element width"
              type="number"
              min="16"
              value={Math.round(selectedElement.bounds.width)}
              onChange={(event) => {
                const width = event.currentTarget.valueAsNumber;
                if (!Number.isFinite(width)) {
                  return;
                }
                applySnapshot(
                  editor.resizeElement(selectedElement.id, {
                    width,
                    height: selectedElement.bounds.height,
                  }),
                );
              }}
            />
          </label>
          <label>
            Height
            <input
              aria-label="Selected element height"
              type="number"
              min="16"
              value={Math.round(selectedElement.bounds.height)}
              onChange={(event) => {
                const height = event.currentTarget.valueAsNumber;
                if (!Number.isFinite(height)) {
                  return;
                }
                applySnapshot(
                  editor.resizeElement(selectedElement.id, {
                    width: selectedElement.bounds.width,
                    height,
                  }),
                );
              }}
            />
          </label>
          {selectedElement.type === "text" ? (
            <label>
              Font size
              <input
                aria-label="Text font size"
                type="number"
                min={MIN_TEXT_FONT_SIZE}
                max={MAX_TEXT_FONT_SIZE}
                value={Math.round(selectedElement.textAppearance?.fontSize ?? 16)}
                onChange={(event) => {
                  const fontSize = event.currentTarget.valueAsNumber;
                  if (!Number.isFinite(fontSize)) {
                    return;
                  }
                  applySnapshot(editor.updateTextFontSize(selectedElement.id, fontSize));
                }}
              />
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => {
              applySnapshot(editor.duplicateElement(selectedElement.id));
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => {
              applySnapshot(editor.deleteElement(selectedElement.id));
            }}
          >
            Delete
          </button>
        </aside>
      )}

      {dialogType === undefined ? null : (
        <SignatureDialog
          type={dialogType}
          onCancel={() => {
            setDialogType(undefined);
          }}
          onAcceptImage={acceptSignatureImage}
          onAcceptText={acceptTypedSignature}
        />
      )}
    </section>
  );
};

interface SignatureDialogProps {
  readonly type: SignatureElementType;
  readonly onCancel: () => void;
  readonly onAcceptImage: (image: SignatureImageInput) => void;
  readonly onAcceptText: (text: string, fontFamily: SignatureFont) => void;
}

const SignatureDialog = ({
  type,
  onCancel,
  onAcceptImage,
  onAcceptText,
}: SignatureDialogProps): React.ReactElement => {
  const [mode, setMode] = useState<SignatureDialogMode>("draw");
  const [typedName, setTypedName] = useState(type === "signature" ? "Your Name" : "YN");
  const [fontFamily, setFontFamily] = useState<SignatureFont>("cursive");
  const [uploadError, setUploadError] = useState<string | undefined>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef(false);
  const hasStrokeRef = useRef(false);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
      if (event.key !== "Tab") {
        return;
      }
      const dialog = dialogRef.current;
      if (dialog === null) {
        return;
      }
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button, input, select, canvas, [tabindex]:not([tabindex='-1'])",
        ),
      ).filter((element) => !element.hasAttribute("disabled"));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (first === undefined || last === undefined) {
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel]);

  const clearCanvas = (): void => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas == null || context == null) {
      return;
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokeRef.current = false;
  };

  const startDrawing = (event: PointerEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas == null || context == null) {
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 4;
    context.strokeStyle = "#111111";
    context.beginPath();
    context.moveTo(event.clientX - rect.left, event.clientY - rect.top);
    isDrawingRef.current = true;
  };

  const continueDrawing = (event: PointerEvent<HTMLCanvasElement>): void => {
    if (!isDrawingRef.current) {
      return;
    }
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas == null || context == null) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    context.lineTo(event.clientX - rect.left, event.clientY - rect.top);
    context.stroke();
    hasStrokeRef.current = true;
  };

  const finishDrawing = (): void => {
    isDrawingRef.current = false;
  };

  const acceptDraw = (): void => {
    const canvas = canvasRef.current;
    if (canvas === null || !hasStrokeRef.current) {
      setUploadError(`Draw ${type === "signature" ? "a signature" : "initials"} before accepting.`);
      return;
    }
    onAcceptImage(canvasToImageInput(canvas, "draw"));
  };

  const acceptUpload = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    if (file === undefined) {
      return;
    }
    const validationError = validateSignatureImageFile(file);
    if (validationError !== undefined) {
      setUploadError(validationError.message);
      return;
    }
    const image = new Image();
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        setUploadError("The signature image could not be read.");
        return;
      }
      image.addEventListener("load", () => {
        onAcceptImage({
          dataUrl: reader.result as string,
          mimeType: file.type === "image/png" ? "image/png" : "image/jpeg",
          width: image.naturalWidth,
          height: image.naturalHeight,
          source: "upload",
        });
      });
      image.src = reader.result;
    });
    reader.readAsDataURL(file);
  };

  return (
    <div className="modal-backdrop">
      <div
        ref={dialogRef}
        className="signature-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signature-dialog-title"
        tabIndex={-1}
      >
        <header className="dialog-header">
          <h2 id="signature-dialog-title">{type === "signature" ? "Signature" : "Initials"}</h2>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </header>
        <div className="dialog-tabs" role="tablist" aria-label={`${type} methods`}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "draw"}
            onClick={() => {
              setMode("draw");
            }}
          >
            Draw
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "type"}
            onClick={() => {
              setMode("type");
            }}
          >
            Type
          </button>
          {type === "signature" ? (
            <button
              type="button"
              role="tab"
              aria-selected={mode === "upload"}
              onClick={() => {
                setMode("upload");
              }}
            >
              Upload
            </button>
          ) : null}
        </div>
        {uploadError === undefined ? null : (
          <p className="error-message" role="alert">
            {uploadError}
          </p>
        )}
        {mode === "draw" ? (
          <div className="signature-panel">
            <canvas
              ref={canvasRef}
              className="signature-pad"
              width="480"
              height="180"
              aria-label={`Draw ${type}`}
              tabIndex={0}
              onPointerDown={startDrawing}
              onPointerMove={continueDrawing}
              onPointerUp={finishDrawing}
              onPointerCancel={finishDrawing}
            />
            <div className="dialog-actions">
              <button type="button" onClick={clearCanvas}>
                Clear
              </button>
              <button type="button" onClick={acceptDraw}>
                Accept
              </button>
            </div>
          </div>
        ) : null}
        {mode === "type" ? (
          <div className="signature-panel">
            <label>
              {type === "signature" ? "Signature name" : "Initials"}
              <input
                aria-label={type === "signature" ? "Signature name" : "Initials text"}
                value={typedName}
                onChange={(event) => {
                  setTypedName(event.currentTarget.value);
                }}
              />
            </label>
            <label>
              Font
              <select
                value={fontFamily}
                onChange={(event) => {
                  setFontFamily(event.currentTarget.value as SignatureFont);
                }}
              >
                {SIGNATURE_FONTS.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </label>
            <div className={signatureTextClass(fontFamily)} aria-label="Signature preview">
              {typedName}
            </div>
            <div className="dialog-actions">
              <button
                type="button"
                onClick={() => {
                  onAcceptText(typedName, fontFamily);
                }}
              >
                Accept
              </button>
            </div>
          </div>
        ) : null}
        {mode === "upload" && type === "signature" ? (
          <div className="signature-panel">
            <label>
              Upload PNG or JPG
              <input
                aria-label="Upload signature image"
                type="file"
                accept="image/png,image/jpeg"
                onChange={acceptUpload}
              />
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
};
