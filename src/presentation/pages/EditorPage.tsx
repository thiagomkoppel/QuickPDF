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
  ImageElementInput,
  SignatureFont,
  SignatureImageInput,
  SignatureElementType,
} from "../../application/editor-application";
import {
  DEFAULT_TEXT_APPEARANCE,
  MAX_TEXT_FONT_SIZE,
  MIN_ELEMENT_HEIGHT,
  MIN_ELEMENT_WIDTH,
  MIN_TEXT_FONT_SIZE,
  validateImageFile,
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
      readonly startBounds: ExportElement["bounds"];
    }
  | {
      readonly kind: "resize";
      readonly elementId: string;
      readonly type: ExportElement["type"];
      readonly startBounds: ExportElement["bounds"];
      readonly startFontSize?: number;
    };

interface ResizePreview {
  readonly bounds: ExportElement["bounds"];
  readonly fontSize?: number;
}

interface VisualResizePreview extends ResizePreview {
  readonly elementId: string;
}

interface MovePreview {
  readonly bounds: ExportElement["bounds"];
}

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

const imageResizePreviewBounds = (
  startBounds: ExportElement["bounds"],
  bounds: ExportElement["bounds"],
): ExportElement["bounds"] => {
  const ratio = startBounds.width / startBounds.height;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return bounds;
  }
  const widthDelta = Math.abs(bounds.width - startBounds.width);
  const heightDelta = Math.abs(bounds.height - startBounds.height);
  const withAspect =
    heightDelta > widthDelta
      ? { ...bounds, width: bounds.height * ratio }
      : { ...bounds, height: bounds.width / ratio };
  return {
    ...withAspect,
    width: Math.max(MIN_ELEMENT_WIDTH, withAspect.width),
    height: Math.max(MIN_ELEMENT_HEIGHT, withAspect.height),
  };
};

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
    case "image":
      return "Image";
  }
};

interface OptionalPointerCaptureTarget {
  readonly hasPointerCapture?: (pointerId: number) => boolean;
  readonly setPointerCapture?: (pointerId: number) => void;
  readonly releasePointerCapture?: (pointerId: number) => void;
}

const capturePointer = (target: HTMLElement, pointerId: number | undefined): void => {
  if (pointerId === undefined) {
    return;
  }
  (target as unknown as OptionalPointerCaptureTarget).setPointerCapture?.(pointerId);
};

const releasePointer = (target: HTMLElement, pointerId: number | undefined): void => {
  if (pointerId === undefined) {
    return;
  }
  const pointerTarget = target as unknown as OptionalPointerCaptureTarget;
  if (pointerTarget.hasPointerCapture?.(pointerId) ?? false) {
    pointerTarget.releasePointerCapture?.(pointerId);
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
  const [pendingImage, setPendingImage] = useState<ImageElementInput | undefined>();
  const [imageUploadError, setImageUploadError] = useState<string | undefined>();
  const [pointerAction, setPointerAction] = useState<PointerAction | undefined>();
  const [whiteoutDraft, setWhiteoutDraft] = useState<WhiteoutDraft | undefined>();
  const [editingTextElementId, setEditingTextElementId] = useState<string | undefined>();
  const [visualResizePreview, setVisualResizePreviewState] = useState<
    VisualResizePreview | undefined
  >();
  const editingTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const textFocusRetryRef = useRef<number | undefined>(undefined);
  const resizePreviewRef = useRef<ResizePreview | undefined>(undefined);
  const resizeFrameRef = useRef<number | undefined>(undefined);
  const pendingVisualResizePreviewRef = useRef<VisualResizePreview | undefined>(undefined);
  const movePreviewRef = useRef<MovePreview | undefined>(undefined);
  const moveCancelRef = useRef<(() => void) | undefined>(undefined);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const applySnapshot = useCallback(
    (nextSnapshot: EditorSnapshot): void => {
      onSnapshotChange(nextSnapshot);
    },
    [onSnapshotChange],
  );

  const cancelResizeFrame = useCallback((): void => {
    if (resizeFrameRef.current !== undefined) {
      window.cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = undefined;
    }
    pendingVisualResizePreviewRef.current = undefined;
  }, []);

  const clearVisualResizePreview = useCallback((): void => {
    cancelResizeFrame();
    setVisualResizePreviewState(undefined);
  }, [cancelResizeFrame]);

  const scheduleVisualResizePreview = useCallback((preview: VisualResizePreview): void => {
    pendingVisualResizePreviewRef.current = preview;
    if (resizeFrameRef.current !== undefined) {
      return;
    }
    resizeFrameRef.current = window.requestAnimationFrame(() => {
      resizeFrameRef.current = undefined;
      const nextPreview = pendingVisualResizePreviewRef.current;
      pendingVisualResizePreviewRef.current = undefined;
      if (nextPreview !== undefined) {
        setVisualResizePreviewState(nextPreview);
      }
    });
  }, []);

  useEffect(
    () => () => {
      cancelResizeFrame();
    },
    [cancelResizeFrame],
  );

  useEffect(() => {
    if (currentPageId !== undefined) {
      return;
    }
    cancelResizeFrame();
    resizePreviewRef.current = undefined;
    const cleanupState = window.setTimeout(() => {
      setVisualResizePreviewState(undefined);
      setPointerAction(undefined);
    }, 0);
    return () => {
      window.clearTimeout(cleanupState);
    };
  }, [cancelResizeFrame, currentPageId]);

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
      if (moveCancelRef.current !== undefined && event.key === "Escape") {
        event.preventDefault();
        moveCancelRef.current();
        return;
      }
      if (pointerAction?.kind === "resize" && event.key === "Escape") {
        event.preventDefault();
        if (pointerAction.type === "text" && pointerAction.startFontSize !== undefined) {
          applySnapshot(
            editor.previewTextResizeElement(
              pointerAction.elementId,
              pointerAction.startBounds,
              pointerAction.startFontSize,
            ),
          );
        } else if (pointerAction.type === "image") {
          clearVisualResizePreview();
        } else {
          applySnapshot(
            editor.previewResizeElement(pointerAction.elementId, pointerAction.startBounds),
          );
        }
        resizePreviewRef.current = undefined;
        setPointerAction(undefined);
        return;
      }
      if (whiteoutDraft !== undefined && event.key === "Escape") {
        event.preventDefault();
        setWhiteoutDraft(undefined);
        return;
      }
      if (editingTextElementId !== undefined) {
        if (event.key === "Escape" && isEditingKeyboardTarget(event.target)) {
          event.preventDefault();
          setEditingTextElementId(undefined);
          applySnapshot(editor.setTool("select"));
        }
        if (isEditingKeyboardTarget(event.target)) {
          return;
        }
      }
      if ((event.ctrlKey || event.metaKey) && !isEditingKeyboardTarget(event.target)) {
        const key = event.key.toLowerCase();
        const wantsUndo = key === "z" && !event.shiftKey;
        const wantsRedo = (key === "z" && event.shiftKey) || (!event.metaKey && key === "y");
        if (key === "c" && state.selectedElementId !== undefined) {
          event.preventDefault();
          applySnapshot(editor.copySelectedElement());
          return;
        }
        if (key === "v" && snapshot.canPaste) {
          event.preventDefault();
          setWhiteoutDraft(undefined);
          applySnapshot(editor.pasteCopiedElement());
          return;
        }
        if (wantsUndo && snapshot.canUndo) {
          event.preventDefault();
          setEditingTextElementId(undefined);
          setWhiteoutDraft(undefined);
          applySnapshot(editor.undo());
          return;
        }
        if (wantsRedo && snapshot.canRedo) {
          event.preventDefault();
          setEditingTextElementId(undefined);
          setWhiteoutDraft(undefined);
          applySnapshot(editor.redo());
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
    pointerAction,
    clearVisualResizePreview,
    snapshot.canPaste,
    snapshot.canRedo,
    snapshot.canUndo,
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
        const bounds = {
          ...pointerAction.startBounds,
          x: point.x - pointerAction.offsetX,
          y: point.y - pointerAction.offsetY,
        };
        movePreviewRef.current = { bounds };
        applySnapshot(
          editor.previewMoveElement(pointerAction.elementId, {
            x: bounds.x,
            y: bounds.y,
          }),
        );
        return;
      }
      if (pointerAction.type === "text" && pointerAction.startFontSize !== undefined) {
        const rawScale =
          Math.max(point.x - pointerAction.startBounds.x, point.y - pointerAction.startBounds.y) /
          Math.max(pointerAction.startBounds.width, pointerAction.startBounds.height);
        const nextFontSize = Math.min(
          MAX_TEXT_FONT_SIZE,
          Math.max(MIN_TEXT_FONT_SIZE, pointerAction.startFontSize * rawScale),
        );
        const scale = nextFontSize / pointerAction.startFontSize;
        const bounds = {
          ...pointerAction.startBounds,
          width: pointerAction.startBounds.width * scale,
          height: pointerAction.startBounds.height * scale,
        };
        resizePreviewRef.current = { bounds, fontSize: nextFontSize };
        applySnapshot(
          editor.previewTextResizeElement(pointerAction.elementId, bounds, nextFontSize),
        );
        return;
      }
      const rawBounds = {
        ...pointerAction.startBounds,
        width: point.x - pointerAction.startBounds.x,
        height: point.y - pointerAction.startBounds.y,
      };
      const bounds =
        pointerAction.type === "image"
          ? imageResizePreviewBounds(pointerAction.startBounds, rawBounds)
          : rawBounds;
      resizePreviewRef.current = { bounds };
      if (pointerAction.type === "image") {
        scheduleVisualResizePreview({ elementId: pointerAction.elementId, bounds });
        return;
      }
      applySnapshot(editor.previewResizeElement(pointerAction.elementId, bounds));
    };

    const stopPointerAction = (): void => {
      if (pointerAction.kind === "move") {
        const preview = movePreviewRef.current;
        if (preview !== undefined) {
          applySnapshot(
            editor.commitMoveElement(
              pointerAction.elementId,
              pointerAction.startBounds,
              preview.bounds,
            ),
          );
        }
      }
      if (pointerAction.kind === "resize") {
        const preview = resizePreviewRef.current;
        if (
          pointerAction.type === "text" &&
          pointerAction.startFontSize !== undefined &&
          preview?.fontSize !== undefined
        ) {
          applySnapshot(
            editor.commitTextResizeElement(
              pointerAction.elementId,
              { bounds: pointerAction.startBounds, fontSize: pointerAction.startFontSize },
              { bounds: preview.bounds, fontSize: preview.fontSize },
            ),
          );
        } else if (preview !== undefined) {
          if (pointerAction.type === "image") {
            clearVisualResizePreview();
          }
          applySnapshot(
            editor.commitResizeElement(
              pointerAction.elementId,
              pointerAction.startBounds,
              preview.bounds,
            ),
          );
        }
      }
      movePreviewRef.current = undefined;
      resizePreviewRef.current = undefined;
      setPointerAction(undefined);
    };

    const cancelPointerAction = (): void => {
      if (pointerAction.kind === "move") {
        applySnapshot(
          editor.previewMoveElement(pointerAction.elementId, {
            x: pointerAction.startBounds.x,
            y: pointerAction.startBounds.y,
          }),
        );
      }
      if (pointerAction.kind === "resize") {
        if (pointerAction.type === "text" && pointerAction.startFontSize !== undefined) {
          applySnapshot(
            editor.previewTextResizeElement(
              pointerAction.elementId,
              pointerAction.startBounds,
              pointerAction.startFontSize,
            ),
          );
        } else if (pointerAction.type === "image") {
          clearVisualResizePreview();
        } else {
          applySnapshot(
            editor.previewResizeElement(pointerAction.elementId, pointerAction.startBounds),
          );
        }
      }
      movePreviewRef.current = undefined;
      resizePreviewRef.current = undefined;
      setPointerAction(undefined);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopPointerAction, { once: true });
    window.addEventListener("pointercancel", cancelPointerAction, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopPointerAction);
      window.removeEventListener("pointercancel", cancelPointerAction);
    };
  }, [
    applySnapshot,
    clearVisualResizePreview,
    editor,
    pointerAction,
    scheduleVisualResizePreview,
    zoom,
  ]);

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
    capturePointer(event.currentTarget, event.pointerId);
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
    const draft = whiteoutDraft;
    if (draft?.pointerId !== event.pointerId) {
      return;
    }
    const point = pointFromOverlayEvent(event);
    if (point === undefined) {
      return;
    }
    setWhiteoutDraft({ ...draft, currentX: point.x, currentY: point.y });
  };

  const finishWhiteoutDraft = (event: PointerEvent<HTMLDivElement>): void => {
    const draft = whiteoutDraft;
    if (draft?.pointerId !== event.pointerId) {
      return;
    }
    releasePointer(event.currentTarget, event.pointerId);
    const finalDraft = draft;
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
  const clearSelection = (): void => {
    setEditingTextElementId(undefined);
    setWhiteoutDraft(undefined);
    applySnapshot(editor.clearSelection());
  };

  const handleImageFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file === undefined) {
      return;
    }
    const validationError = validateImageFile(file);
    if (validationError !== undefined) {
      setImageUploadError(validationError.message);
      setPendingImage(undefined);
      return;
    }
    const reader = new FileReader();
    const image = new Image();
    reader.addEventListener("error", () => {
      setImageUploadError("The image could not be read.");
      setPendingImage(undefined);
    });
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        setImageUploadError("The image could not be read.");
        setPendingImage(undefined);
        return;
      }
      image.addEventListener("error", () => {
        setImageUploadError("The image appears to be corrupted or unsupported.");
        setPendingImage(undefined);
      });
      image.addEventListener("load", () => {
        setImageUploadError(undefined);
        setPendingImage({
          dataUrl: reader.result as string,
          mimeType: file.type === "image/png" ? "image/png" : "image/jpeg",
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
        applySnapshot(editor.setTool("image"));
      });
      image.src = reader.result;
    });
    reader.readAsDataURL(file);
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
      const selectedElementId = nextSnapshot.state.selectedElementId;
      applySnapshot(editor.setTool("select"));
      setEditingTextElementId(selectedElementId);
      return;
    }
    if (state.tool === "image" && pendingImage !== undefined) {
      applySnapshot(editor.addImage(point, pendingImage));
      setPendingImage(undefined);
      applySnapshot(editor.setTool("select"));
      return;
    }
    if (state.tool === "select" && state.selectedElementId !== undefined) {
      clearSelection();
    }
  };

  const handleWorkspaceClick = (event: MouseEvent<HTMLElement>): void => {
    if (
      event.target !== event.currentTarget ||
      state.tool !== "select" ||
      state.selectedElementId === undefined
    ) {
      return;
    }
    clearSelection();
  };

  const startElementMove = (
    element: ExportElement,
    event: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>,
  ): void => {
    if (
      event.target instanceof HTMLTextAreaElement ||
      (event.target as HTMLElement).dataset.resizeHandle === "true"
    ) {
      return;
    }
    if ("detail" in event && event.detail > 1) {
      return;
    }
    if (moveCancelRef.current !== undefined) {
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
    const target = event.currentTarget;
    const startBounds = element.bounds;
    const rect = overlayLayer.getBoundingClientRect();
    const startPoint = {
      x: (event.clientX - rect.left) / zoom,
      y: (event.clientY - rect.top) / zoom,
    };
    if (!Number.isFinite(startPoint.x) || !Number.isFinite(startPoint.y)) {
      return;
    }
    const offsetX = startPoint.x - startBounds.x;
    const offsetY = startPoint.y - startBounds.y;
    let latestBounds: ExportElement["bounds"] | undefined;

    const cleanup = (): void => {
      target.removeEventListener("pointermove", handleMove);
      target.removeEventListener("pointerup", handleUp);
      target.removeEventListener("pointercancel", handleCancel);
      moveCancelRef.current = undefined;
      movePreviewRef.current = undefined;
    };
    const restoreStart = (): void => {
      applySnapshot(editor.previewMoveElement(element.id, { x: startBounds.x, y: startBounds.y }));
      cleanup();
    };
    const handleMove = (nativeEvent: globalThis.PointerEvent): void => {
      const layer = overlayLayerRef.current;
      if (layer === null) {
        return;
      }
      const layerRect = layer.getBoundingClientRect();
      const point = {
        x: (nativeEvent.clientX - layerRect.left) / zoomRef.current,
        y: (nativeEvent.clientY - layerRect.top) / zoomRef.current,
      };
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return;
      }
      const bounds = {
        ...startBounds,
        x: point.x - offsetX,
        y: point.y - offsetY,
      };
      latestBounds = bounds;
      movePreviewRef.current = { bounds };
      applySnapshot(editor.previewMoveElement(element.id, { x: bounds.x, y: bounds.y }));
    };
    const handleUp = (): void => {
      releasePointer(target, "pointerId" in event ? event.pointerId : undefined);
      if (latestBounds !== undefined) {
        applySnapshot(editor.commitMoveElement(element.id, startBounds, latestBounds));
      }
      cleanup();
    };
    const handleCancel = (): void => {
      releasePointer(target, "pointerId" in event ? event.pointerId : undefined);
      restoreStart();
    };

    capturePointer(target, "pointerId" in event ? event.pointerId : undefined);
    target.addEventListener("pointermove", handleMove);
    target.addEventListener("pointerup", handleUp, { once: true });
    target.addEventListener("pointercancel", handleCancel, { once: true });
    moveCancelRef.current = restoreStart;
  };

  const startElementResize = (
    element: ExportElement,
    event: PointerEvent<HTMLButtonElement>,
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    applySnapshot(editor.selectElement(element.id));
    resizePreviewRef.current = {
      bounds: element.bounds,
      ...(element.textAppearance?.fontSize === undefined
        ? {}
        : { fontSize: element.textAppearance.fontSize }),
    };
    setPointerAction({
      kind: "resize",
      elementId: element.id,
      type: element.type,
      startBounds: element.bounds,
      ...(element.type === "text"
        ? { startFontSize: element.textAppearance?.fontSize ?? DEFAULT_TEXT_APPEARANCE.fontSize }
        : {}),
    });
  };

  const undo = (): void => {
    setEditingTextElementId(undefined);
    setWhiteoutDraft(undefined);
    applySnapshot(editor.undo());
  };

  const redo = (): void => {
    setEditingTextElementId(undefined);
    setWhiteoutDraft(undefined);
    applySnapshot(editor.redo());
  };
  const download = async (): Promise<void> => {
    applySnapshot(await editor.exportCurrentPdf());
  };

  const acceptSignatureImage = (image: SignatureImageInput): void => {
    if (dialogType === undefined) {
      return;
    }
    const point = defaultPlacement(dialogType);
    const nextSnapshot =
      dialogType === "signature"
        ? image.source === "upload"
          ? editor.addUploadedSignature(point, image)
          : editor.addDrawnSignature(point, image)
        : editor.addDrawnInitials(point, image);
    applySnapshot(nextSnapshot);
    applySnapshot(editor.setTool("select"));
    setDialogType(undefined);
  };

  const acceptTypedSignature = (text: string, fontFamily: SignatureFont): void => {
    if (dialogType === undefined) {
      return;
    }
    const point = defaultPlacement(dialogType);
    const nextSnapshot =
      dialogType === "signature"
        ? editor.addTypedSignature(point, { text, fontFamily })
        : editor.addTypedInitials(point, { text, fontFamily });
    applySnapshot(nextSnapshot);
    applySnapshot(editor.setTool("select"));
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

      <div className="editor-controls">
        <div className="viewer-toolbar" aria-label="PDF editor controls">
          <button type="button" aria-label="Undo" disabled={!snapshot.canUndo} onClick={undo}>
            Undo
          </button>
          <button type="button" aria-label="Redo" disabled={!snapshot.canRedo} onClick={redo}>
            Redo
          </button>
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
            aria-pressed={state.tool === "image"}
            onClick={() => {
              imageInputRef.current?.click();
            }}
          >
            <span>Image</span>
            {activeToolLabel(state.tool === "image")}
          </button>
          <input
            ref={imageInputRef}
            className="visually-hidden"
            aria-label="Choose image"
            type="file"
            accept="image/png,image/jpeg"
            style={{ display: "none" }}
            onChange={handleImageFileChange}
          />
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
      </div>

      <p className="whiteout-note">
        Whiteout only covers content visually. It does not securely remove underlying PDF data.
      </p>
      {imageUploadError === undefined ? null : (
        <p className="error-message" role="alert">
          {imageUploadError}
        </p>
      )}
      {pendingImage === undefined || state.tool !== "image" ? null : (
        <p className="status-note" role="status">
          Click the PDF page to place the image.
        </p>
      )}
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
        <main
          ref={workspaceRef}
          className="viewer-main"
          aria-label="PDF workspace"
          onClick={handleWorkspaceClick}
        >
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
              {state.visibleElements.map((element) => {
                const elementBounds =
                  visualResizePreview?.elementId === element.id
                    ? visualResizePreview.bounds
                    : element.bounds;
                const isResizing =
                  pointerAction?.kind === "resize" && pointerAction.elementId === element.id;
                return (
                  <div
                    key={element.id}
                    className={`overlay-element overlay-${element.type}${state.selectedElementId === element.id ? " is-selected" : ""}${isResizing ? " is-resizing" : ""}`}
                    style={boundsStyle(elementBounds, zoom)}
                    role="group"
                    aria-label={`${element.type} element`}
                    aria-description={
                      element.type === "text" ? "Press Enter to edit selected text." : undefined
                    }
                    tabIndex={element.type === "text" ? 0 : undefined}
                    onPointerDown={(event) => {
                      startElementMove(element, event);
                    }}
                    onMouseDown={(event) => {
                      if (element.type === "image") {
                        startElementMove(element, event);
                      }
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
                    {element.type === "image" && element.image !== undefined ? (
                      <img
                        src={element.image.dataUrl}
                        alt=""
                        draggable={false}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "fill",
                          display: "block",
                        }}
                      />
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
                );
              })}
            </div>
          </div>
        </main>
      </div>

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
