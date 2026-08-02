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
import quickPdfMark from "../assets/brand/quickpdf-mark.svg";
import { calculateViewerFit, type ViewerMode } from "./editor-view-modes";

interface EditorPageProps {
  readonly editor: PdfEditorApplication;
  readonly snapshot: EditorSnapshot;
  readonly onSnapshotChange: (snapshot: EditorSnapshot) => void;
  readonly pdfRenderer: Pick<PdfJsPageRenderer, "startRenderPage" | "clearCanvas"> &
    Partial<Pick<PdfJsPageRenderer, "startRenderThumbnail">>;
  readonly onOpenRequest?: () => void;
}

type RenderStatus = "idle" | "loading" | "ready" | "error";
type SignatureDialogMode = "draw" | "type" | "upload";
type TextInspectorTab = "text" | "style" | "page";
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

interface WorkspacePan {
  readonly pointerId: number;
  readonly startClientX: number;
  readonly startClientY: number;
  readonly startScrollLeft: number;
  readonly startScrollTop: number;
  hasMoved: boolean;
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

type ToolbarIconName =
  | "open"
  | "download"
  | "undo"
  | "redo"
  | "copy"
  | "paste"
  | "select"
  | "text"
  | "whiteout"
  | "image"
  | "signature"
  | "initials"
  | "checkmark"
  | "cross"
  | "date"
  | "zoom-out"
  | "zoom-in"
  | "fit"
  | "previous"
  | "next"
  | "more";

const ToolbarIcon = ({ name }: { readonly name: ToolbarIconName }): React.ReactElement => {
  const svg = (children: React.ReactNode): React.ReactElement => (
    <svg
      aria-hidden="true"
      className="toolbar-icon"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );

  switch (name) {
    case "open":
      return svg(
        <path d="M3.5 6.5h6l1.7 2H20.5v9.8a2.2 2.2 0 0 1-2.2 2.2H5.7a2.2 2.2 0 0 1-2.2-2.2V6.5Z" />,
      );
    case "download":
      return svg(
        <>
          <path d="M12 3.5v10" />
          <path d="m8.2 10.2 3.8 3.8 3.8-3.8" />
          <path d="M4.5 17.5v2h15v-2" />
        </>,
      );
    case "undo":
      return svg(
        <>
          <path d="M9 7 5 11l4 4" />
          <path d="M5.5 11H15a4.5 4.5 0 0 1 4.5 4.5" />
        </>,
      );
    case "redo":
      return svg(
        <>
          <path d="m15 7 4 4-4 4" />
          <path d="M18.5 11H9a4.5 4.5 0 0 0-4.5 4.5" />
        </>,
      );
    case "copy":
      return svg(
        <>
          <rect x="8" y="8" width="11" height="12" rx="1.5" />
          <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v10A1.5 1.5 0 0 0 5.5 17H8" />
        </>,
      );
    case "paste":
      return svg(
        <>
          <path d="M9 5.5h6" />
          <path d="M10 4h4v3h-4z" />
          <path d="M6 6.5h-.5A1.5 1.5 0 0 0 4 8v10.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V8A1.5 1.5 0 0 0 18.5 6.5H18" />
          <path d="M8 12h8M8 16h6" />
        </>,
      );
    case "select":
      return svg(<path d="m5 3 13 8-6.2 1.4L9.5 19 5 3Z" />);
    case "text":
      return svg(
        <>
          <path d="M5 5h14" />
          <path d="M12 5v14" />
        </>,
      );
    case "whiteout":
      return svg(
        <>
          <path d="m7 16.5 8.8-8.8 2.7 2.7-8.8 8.8-4.2.8z" />
          <path d="m14.4 6.4 2-2a1.9 1.9 0 0 1 2.7 2.7l-2 2" />
          <path d="M4 20.5h16" />
        </>,
      );
    case "image":
      return svg(
        <>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <circle cx="9" cy="9" r="1.5" />
          <path d="m4.5 17 4.8-4.8 3.4 3.2 2.4-2.3 4.4 3.9" />
        </>,
      );
    case "signature":
      return svg(
        <>
          <path d="M4 17.5c2.2-3.6 3.5-5.4 4.5-5.4 1.8 0 .1 5.2 1.8 5.2 1.3 0 2.8-4 4.1-4 1.2 0 .3 3.4 1.7 3.4 1.1 0 2.2-1.5 4-4.1" />
          <path d="M16.7 5.7 19.5 3l1.5 1.5-2.8 2.8" />
        </>,
      );
    case "initials":
      return svg(
        <>
          <path d="M4.5 18 8 6l3.5 12" />
          <path d="M6 13h4" />
          <path d="M15 6h4.5l-4.5 12H20" />
        </>,
      );
    case "checkmark":
      return svg(<path d="m4.5 12.5 4.6 4.6L19.5 6.8" />);
    case "cross":
      return svg(
        <>
          <path d="m6 6 12 12" />
          <path d="M18 6 6 18" />
        </>,
      );
    case "date":
      return svg(
        <>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3.5v3M16 3.5v3M4 9h16M8 13h3M8 16h5" />
        </>,
      );
    case "zoom-out":
      return svg(
        <>
          <circle cx="10.5" cy="10.5" r="5.5" />
          <path d="M14.7 14.7 20 20M8 10.5h5" />
        </>,
      );
    case "zoom-in":
      return svg(
        <>
          <circle cx="10.5" cy="10.5" r="5.5" />
          <path d="M14.7 14.7 20 20M8 10.5h5M10.5 8v5" />
        </>,
      );
    case "fit":
      return svg(
        <>
          <path d="M8.5 4H4v4.5M15.5 4H20v4.5M20 15.5V20h-4.5M4 15.5V20h4.5" />
          <rect x="8" y="7" width="8" height="10" rx="1" />
        </>,
      );
    case "previous":
      return svg(<path d="m14.5 5-7 7 7 7" />);
    case "next":
      return svg(<path d="m9.5 5 7 7-7 7" />);
    case "more":
      return svg(
        <>
          <circle cx="5" cy="12" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="19" cy="12" r="1" fill="currentColor" />
        </>,
      );
  }
};
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

const aspectRatioResizePreviewBounds = (
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

const isTextResizeType = (type: ExportElement["type"]): boolean =>
  type === "text" || type === "date";

const usesLocalVisualResizePreview = (type: ExportElement["type"]): boolean =>
  type === "image" || type === "checkmark" || type === "cross" || type === "date";
const signatureTextClass = (fontFamily: string | undefined): string =>
  `signature-text signature-font-${fontFamily ?? "cursive"}`;

const defaultPlacement = (
  type: SignatureElementType,
): { readonly x: number; readonly y: number } =>
  type === "signature" ? { x: 56, y: 250 } : { x: 56, y: 180 };
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
    case "checkmark":
      return "Checkmark";
    case "cross":
      return "Cross";
    case "date":
      return "Date";
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

interface PageThumbnailProps {
  readonly renderer: Pick<PdfJsPageRenderer, "clearCanvas"> &
    Partial<Pick<PdfJsPageRenderer, "startRenderThumbnail">>;
  readonly documentId: string | undefined;
  readonly pageNumber: number;
  readonly pageId: string;
  readonly current: boolean;
  readonly onSelect: (pageId: string) => void;
}

interface ReleaseColorInputProps {
  readonly ariaLabel: string;
  readonly value: string;
  readonly onPreview: (color: string) => void;
  readonly onCommit: (color: string) => void;
}

const ReleaseColorInput = ({
  ariaLabel,
  value,
  onPreview,
  onCommit,
}: ReleaseColorInputProps): React.ReactElement => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (input === null) {
      return;
    }
    const handleNativeChange = (): void => {
      onCommit(input.value);
    };
    input.addEventListener("change", handleNativeChange);
    return () => {
      input.removeEventListener("change", handleNativeChange);
    };
  }, [onCommit]);

  return (
    <input
      ref={inputRef}
      aria-label={ariaLabel}
      type="color"
      value={value}
      onInput={(event) => {
        onPreview(event.currentTarget.value);
      }}
    />
  );
};
const PageThumbnail = ({
  renderer,
  documentId,
  pageNumber,
  pageId,
  current,
  onSelect,
}: PageThumbnailProps): React.ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<RenderStatus>("loading");
  useEffect(() => {
    const canvas = canvasRef.current;
    if (
      canvas === null ||
      documentId === undefined ||
      renderer.startRenderThumbnail === undefined
    ) {
      return;
    }
    setStatus("loading");
    const handle = renderer.startRenderThumbnail({
      documentId,
      pageNumber,
      maxWidth: 126,
      devicePixelRatio: window.devicePixelRatio,
      canvas,
    });
    void handle.promise.then((result) => {
      if (result.ok) {
        setStatus("ready");
      } else if (!result.cancelled) {
        setStatus("error");
      }
    });
    return () => {
      handle.cancel();
      renderer.clearCanvas(canvas);
    };
  }, [documentId, pageNumber, renderer]);
  return (
    <button
      type="button"
      className={`page-rail-thumbnail${current ? " is-current" : ""}`}
      aria-label={`${current ? "Current " : ""}page ${String(pageNumber)}`}
      aria-current={current ? "page" : undefined}
      onClick={() => {
        onSelect(pageId);
      }}
    >
      <span className="page-thumbnail-canvas-wrap" aria-hidden="true">
        <canvas ref={canvasRef} className="page-thumbnail-canvas" />
        {status === "loading" ? <span className="page-thumbnail-skeleton" /> : null}
      </span>
      <span>{String(pageNumber)}</span>
    </button>
  );
};
export const EditorPage = ({
  editor,
  snapshot,
  onSnapshotChange,
  pdfRenderer,
  onOpenRequest,
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
  const [viewMode, setViewMode] = useState<ViewerMode>("fit-page");
  const [isPageRailCollapsed, setIsPageRailCollapsed] = useState(false);
  const zoomRef = useRef(1);
  const [renderState, setRenderState] = useState<RenderState>({ status: "idle" });
  const [dialogType, setDialogType] = useState<SignatureElementType | undefined>();
  const [pendingImage, setPendingImage] = useState<ImageElementInput | undefined>();
  const [imageUploadError, setImageUploadError] = useState<string | undefined>();
  const [pointerAction, setPointerAction] = useState<PointerAction | undefined>();
  const [whiteoutDraft, setWhiteoutDraft] = useState<WhiteoutDraft | undefined>();
  const [editingTextElementId, setEditingTextElementId] = useState<string | undefined>();
  const [textInspectorTab, setTextInspectorTab] = useState<TextInspectorTab>("text");
  const [imageInspectorTab, setImageInspectorTab] = useState<TextInspectorTab>("text");
  const [colorPreviewByElementId, setColorPreviewByElementId] = useState<
    ReadonlyMap<string, string>
  >(new Map());
  const colorPreviewRef = useRef<{ readonly elementId: string; readonly color: string } | null>(
    null,
  );
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
  const workspacePanRef = useRef<WorkspacePan | undefined>(undefined);
  const suppressWorkspaceClickRef = useRef(false);
  const [isWorkspacePanning, setIsWorkspacePanning] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const applySnapshot = useCallback(
    (nextSnapshot: EditorSnapshot): void => {
      setColorPreviewByElementId((current) => {
        if (current.size === 0) {
          return current;
        }
        const committedColors = new Map(
          nextSnapshot.state.elements.map((element) => [
            element.id,
            element.color ?? element.textAppearance?.color ?? "#000000",
          ]),
        );
        let changed = false;
        const next = new Map(current);
        for (const [elementId, previewColor] of current) {
          if (committedColors.get(elementId) !== previewColor) {
            next.delete(elementId);
            changed = true;
          }
        }
        return changed ? next : current;
      });
      onSnapshotChange(nextSnapshot);
    },
    [onSnapshotChange],
  );

  const handleColorPreview = useCallback((elementId: string, color: string): void => {
    colorPreviewRef.current = { elementId, color };
    setColorPreviewByElementId((current) => {
      const next = new Map(current);
      next.set(elementId, color);
      return next;
    });
  }, []);

  const handleColorCommit = useCallback(
    (elementId: string, color: string): void => {
      colorPreviewRef.current = null;
      handleColorPreview(elementId, color);
      colorPreviewRef.current = null;
      applySnapshot(editor.updateElementColor(elementId, color));
    },
    [applySnapshot, editor, handleColorPreview],
  );

  const commitPendingColor = useCallback((): void => {
    const pendingColor = colorPreviewRef.current;
    if (pendingColor === null) {
      return;
    }
    handleColorCommit(pendingColor.elementId, pendingColor.color);
  }, [handleColorCommit]);
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

  const applyFit = useCallback(
    (mode: Exclude<ViewerMode, "manual">): void => {
      const workspace = workspaceRef.current;
      if (workspace === null || currentPageWidth === undefined || currentPageHeight === undefined) {
        return;
      }
      const style = window.getComputedStyle(workspace);
      const horizontalPadding =
        Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
      const verticalPadding =
        Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
      const calculated = calculateViewerFit(mode, {
        workspaceWidth: workspace.clientWidth,
        workspaceHeight: workspace.clientHeight,
        horizontalPadding: Number.isFinite(horizontalPadding) ? horizontalPadding : 0,
        verticalPadding: Number.isFinite(verticalPadding) ? verticalPadding : 0,
        pageWidth: currentPageWidth,
        pageHeight: currentPageHeight,
      });
      if (calculated === undefined) {
        return;
      }
      const bounded = clampZoom(calculated);
      zoomRef.current = bounded;
      setZoom((current) => (current === bounded ? current : bounded));
      setViewMode(mode);
    },
    [currentPageHeight, currentPageWidth],
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

  useEffect(() => {
    if (viewMode === "manual") {
      return;
    }
    applyFit(viewMode);
  }, [applyFit, currentPageId, isPageRailCollapsed, state.renderDocumentId, viewMode]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (workspace === null || viewMode === "manual" || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      applyFit(viewMode);
    });
    observer.observe(workspace);
    return () => {
      observer.disconnect();
    };
  }, [applyFit, viewMode]);
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
        if (isTextResizeType(pointerAction.type)) {
          if (usesLocalVisualResizePreview(pointerAction.type)) {
            clearVisualResizePreview();
          }
          applySnapshot(
            editor.previewTextResizeElement(
              pointerAction.elementId,
              pointerAction.startBounds,
              pointerAction.startFontSize ?? DEFAULT_TEXT_APPEARANCE.fontSize,
            ),
          );
        } else if (usesLocalVisualResizePreview(pointerAction.type)) {
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
      if (isTextResizeType(pointerAction.type)) {
        const startFontSize = pointerAction.startFontSize ?? DEFAULT_TEXT_APPEARANCE.fontSize;
        const rawScale =
          Math.max(point.x - pointerAction.startBounds.x, point.y - pointerAction.startBounds.y) /
          Math.max(pointerAction.startBounds.width, pointerAction.startBounds.height);
        const nextFontSize = Math.min(
          MAX_TEXT_FONT_SIZE,
          Math.max(MIN_TEXT_FONT_SIZE, startFontSize * rawScale),
        );
        const scale = nextFontSize / startFontSize;
        const bounds = {
          ...pointerAction.startBounds,
          width: pointerAction.startBounds.width * scale,
          height: pointerAction.startBounds.height * scale,
        };
        resizePreviewRef.current = { bounds, fontSize: nextFontSize };
        if (usesLocalVisualResizePreview(pointerAction.type)) {
          scheduleVisualResizePreview({
            elementId: pointerAction.elementId,
            bounds,
            fontSize: nextFontSize,
          });
          return;
        }
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
      const bounds = usesLocalVisualResizePreview(pointerAction.type)
        ? aspectRatioResizePreviewBounds(pointerAction.startBounds, rawBounds)
        : rawBounds;
      resizePreviewRef.current = { bounds };
      if (usesLocalVisualResizePreview(pointerAction.type)) {
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
        if (isTextResizeType(pointerAction.type) && preview?.fontSize !== undefined) {
          if (usesLocalVisualResizePreview(pointerAction.type)) {
            clearVisualResizePreview();
          }
          applySnapshot(
            editor.commitTextResizeElement(
              pointerAction.elementId,
              {
                bounds: pointerAction.startBounds,
                fontSize: pointerAction.startFontSize ?? DEFAULT_TEXT_APPEARANCE.fontSize,
              },
              { bounds: preview.bounds, fontSize: preview.fontSize },
            ),
          );
        } else if (preview !== undefined) {
          if (usesLocalVisualResizePreview(pointerAction.type)) {
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
        if (isTextResizeType(pointerAction.type)) {
          if (usesLocalVisualResizePreview(pointerAction.type)) {
            clearVisualResizePreview();
          }
          applySnapshot(
            editor.previewTextResizeElement(
              pointerAction.elementId,
              pointerAction.startBounds,
              pointerAction.startFontSize ?? DEFAULT_TEXT_APPEARANCE.fontSize,
            ),
          );
        } else if (usesLocalVisualResizePreview(pointerAction.type)) {
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
    if (state.tool === "checkmark") {
      applySnapshot(editor.addCheckmark(point));
      applySnapshot(editor.setTool("select"));
      return;
    }
    if (state.tool === "cross") {
      applySnapshot(editor.addCross(point));
      applySnapshot(editor.setTool("select"));
      return;
    }
    if (state.tool === "date") {
      applySnapshot(editor.addDate(point));
      applySnapshot(editor.setTool("select"));
      return;
    }
    if (state.tool === "select" && state.selectedElementId !== undefined) {
      clearSelection();
    }
  };

  const startWorkspacePan = (event: PointerEvent<HTMLElement>): void => {
    if (event.button !== 0 || state.tool !== "select" || event.target !== event.currentTarget) {
      return;
    }
    const workspace = event.currentTarget;
    workspacePanRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: workspace.scrollLeft,
      startScrollTop: workspace.scrollTop,
      hasMoved: false,
    };
    capturePointer(workspace, event.pointerId);
    setIsWorkspacePanning(true);
  };

  const updateWorkspacePan = (event: PointerEvent<HTMLElement>): void => {
    const pan = workspacePanRef.current;
    if (pan?.pointerId !== event.pointerId) {
      return;
    }
    const deltaX = event.clientX - pan.startClientX;
    const deltaY = event.clientY - pan.startClientY;
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      pan.hasMoved = true;
      suppressWorkspaceClickRef.current = true;
    }
    event.currentTarget.scrollLeft = pan.startScrollLeft - deltaX;
    event.currentTarget.scrollTop = pan.startScrollTop - deltaY;
  };

  const endWorkspacePan = (event: PointerEvent<HTMLElement>): void => {
    const pan = workspacePanRef.current;
    if (pan?.pointerId !== event.pointerId) {
      return;
    }
    releasePointer(event.currentTarget, event.pointerId);

    workspacePanRef.current = undefined;
    setIsWorkspacePanning(false);
  };

  const handleWorkspaceClick = (event: MouseEvent<HTMLElement>): void => {
    if (suppressWorkspaceClickRef.current) {
      suppressWorkspaceClickRef.current = false;
      return;
    }
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
      ...(isTextResizeType(element.type)
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
    <section
      ref={editorViewportRef}
      className="editor-viewer"
      aria-labelledby="editor-title"
      onPointerDownCapture={(event) => {
        const colorInput =
          event.target instanceof Element ? event.target.closest('input[type="color"]') : null;
        if (colorInput === null) {
          commitPendingColor();
        }
      }}
    >
      <header className="editor-header">
        <div className="editor-header-identity">
          <img src={quickPdfMark} alt="" aria-hidden="true" />
          <span>QuickPDF</span>
        </div>
        <div className="editor-document-meta">
          <h1 id="editor-title">{state.fileName ?? "Open PDF"}</h1>
          <p className="editor-subtitle" role="status">
            {state.status === "exporting"
              ? "Preparing edited PDF..."
              : state.isDirty
                ? "Unsaved temporary edits"
                : "No unsaved edits"}
          </p>
        </div>
      </header>

      <div className="editor-controls">
        <div
          className="viewer-toolbar editor-toolbar"
          role="toolbar"
          aria-label="PDF editor controls"
        >
          <div className="toolbar-group toolbar-file-group" aria-label="File controls">
            <button
              type="button"
              aria-label="Open"
              onClick={onOpenRequest}
              disabled={onOpenRequest === undefined}
            >
              <ToolbarIcon name="open" />
              <span className="toolbar-label">Open</span>
            </button>
            <button
              type="button"
              aria-label="Download"
              onClick={() => void download()}
              disabled={!snapshot.canExport || state.status === "exporting"}
            >
              <ToolbarIcon name="download" />
              <span className="toolbar-label">Download</span>
            </button>
          </div>
          <div className="toolbar-group" aria-label="Edit controls">
            <button type="button" aria-label="Undo" disabled={!snapshot.canUndo} onClick={undo}>
              <ToolbarIcon name="undo" />
              <span className="toolbar-label">Undo</span>
            </button>
            <button type="button" aria-label="Redo" disabled={!snapshot.canRedo} onClick={redo}>
              <ToolbarIcon name="redo" />
              <span className="toolbar-label">Redo</span>
            </button>
            <button
              type="button"
              aria-label="Copy"
              disabled={state.selectedElementId === undefined}
              onClick={() => {
                applySnapshot(editor.copySelectedElement());
              }}
            >
              <ToolbarIcon name="copy" />
              <span className="toolbar-label">Copy</span>
            </button>
            <button
              type="button"
              aria-label="Paste"
              disabled={!snapshot.canPaste}
              onClick={() => {
                applySnapshot(editor.pasteCopiedElement());
              }}
            >
              <ToolbarIcon name="paste" />
              <span className="toolbar-label">Paste</span>
            </button>
          </div>
          <div className="toolbar-group toolbar-tools-group" aria-label="Insert tools">
            <button
              type="button"
              aria-label="Select"
              aria-pressed={state.tool === "select"}
              onClick={() => {
                applySnapshot(editor.setTool("select"));
              }}
            >
              <ToolbarIcon name="select" />
              <span className="toolbar-label">Select</span>
            </button>
            <button
              type="button"
              aria-label="Text"
              aria-pressed={state.tool === "text"}
              onClick={() => {
                applySnapshot(editor.setTool("text"));
              }}
            >
              <ToolbarIcon name="text" />
              <span className="toolbar-label">Text</span>
            </button>
            <button
              type="button"
              aria-label="Whiteout"
              aria-pressed={state.tool === "whiteout"}
              onClick={() => {
                applySnapshot(editor.setTool("whiteout"));
              }}
            >
              <ToolbarIcon name="whiteout" />
              <span className="toolbar-label">Whiteout</span>
            </button>
            <button
              type="button"
              aria-label="Image"
              aria-pressed={state.tool === "image"}
              onClick={() => {
                imageInputRef.current?.click();
              }}
            >
              <ToolbarIcon name="image" />
              <span className="toolbar-label">Image</span>
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
              aria-label="Signature"
              aria-pressed={state.tool === "signature"}
              onClick={() => {
                applySnapshot(editor.setTool("signature"));
                setDialogType("signature");
              }}
            >
              <ToolbarIcon name="signature" />
              <span className="toolbar-label">Signature</span>
            </button>
            <button
              type="button"
              aria-label="Initials"
              aria-pressed={state.tool === "initials"}
              onClick={() => {
                applySnapshot(editor.setTool("initials"));
                setDialogType("initials");
              }}
            >
              <ToolbarIcon name="initials" />
              <span className="toolbar-label">Initials</span>
            </button>
            <button
              type="button"
              aria-label="Checkmark"
              aria-pressed={state.tool === "checkmark"}
              onClick={() => {
                applySnapshot(editor.setTool("checkmark"));
              }}
            >
              <ToolbarIcon name="checkmark" />
              <span className="toolbar-label">Check</span>
            </button>
            <button
              type="button"
              aria-label="Cross"
              aria-pressed={state.tool === "cross"}
              onClick={() => {
                applySnapshot(editor.setTool("cross"));
              }}
            >
              <ToolbarIcon name="cross" />
              <span className="toolbar-label">Cross</span>
            </button>
            <button
              type="button"
              aria-label="Date"
              aria-pressed={state.tool === "date"}
              onClick={() => {
                applySnapshot(editor.setTool("date"));
              }}
            >
              <ToolbarIcon name="date" />
              <span className="toolbar-label">Date</span>
            </button>
          </div>
          <output
            className="visually-hidden"
            aria-label="Zoom level"
          >{`${String(Math.round(zoom * 100))}%`}</output>
          <div className="toolbar-group toolbar-view-group" aria-label="View controls">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => {
                applyZoom(zoomRef.current - ZOOM_STEP);
              }}
            >
              <ToolbarIcon name="zoom-out" />
              <span className="toolbar-label">Zoom out</span>
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => {
                applyZoom(zoomRef.current + ZOOM_STEP);
              }}
            >
              <ToolbarIcon name="zoom-in" />
              <span className="toolbar-label">Zoom in</span>
            </button>
            <button
              type="button"
              aria-label="Fit page"
              aria-pressed={viewMode === "fit-page"}
              onClick={() => {
                applyFit("fit-page");
              }}
            >
              <ToolbarIcon name="fit" />
              <span className="toolbar-label">Fit page</span>
            </button>
            <button
              type="button"
              aria-label="Fit width"
              aria-pressed={viewMode === "fit-width"}
              onClick={() => {
                applyFit("fit-width");
              }}
            >
              <ToolbarIcon name="fit" />
              <span className="toolbar-label">Fit width</span>
            </button>
          </div>
          <div className="toolbar-group toolbar-pages-group" aria-label="Page controls">
            <button
              type="button"
              aria-label="Previous page"
              disabled={state.currentPageNumber <= 1}
              onClick={() => {
                applySnapshot(editor.previousPage());
              }}
            >
              <ToolbarIcon name="previous" />
              <span className="toolbar-label">Previous</span>
            </button>
            <output aria-label="Current page">
              <span>
                {state.currentPageNumber} / {state.pageCount}
              </span>
            </output>
            <button
              type="button"
              aria-label="Next page"
              disabled={state.currentPageNumber >= state.pageCount}
              onClick={() => {
                applySnapshot(editor.nextPage());
              }}
            >
              <ToolbarIcon name="next" />
              <span className="toolbar-label">Next</span>
            </button>
          </div>
        </div>
      </div>
      <div className="editor-message-strip">
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
      </div>
      <div className={`editor-workspace-shell${isPageRailCollapsed ? " is-rail-collapsed" : ""}`}>
        <aside
          className={`page-rail${isPageRailCollapsed ? " is-collapsed" : ""}`}
          aria-label="Page rail"
        >
          <div className="page-rail-header">
            <strong>Pages</strong>
            <button
              type="button"
              aria-label={isPageRailCollapsed ? "Expand page rail" : "Collapse page rail"}
              aria-pressed={isPageRailCollapsed}
              onClick={() => {
                setIsPageRailCollapsed((collapsed) => !collapsed);
              }}
            >
              {isPageRailCollapsed ? ">" : "<"}
            </button>
          </div>
          <div className="page-rail-list">
            {state.pages.map((page, index) => (
              <PageThumbnail
                key={page.id}
                renderer={pdfRenderer}
                documentId={state.renderDocumentId}
                pageNumber={index + 1}
                pageId={page.id}
                current={page.id === currentPageId}
                onSelect={(pageId) => {
                  applySnapshot(editor.selectPage(pageId));
                }}
              />
            ))}
          </div>
        </aside>
        <div className="editor-viewport" aria-label="PDF editor viewport">
          <main
            ref={workspaceRef}
            className={`viewer-main${isWorkspacePanning ? " is-panning" : ""}`}
            aria-label="PDF workspace"
            onClick={handleWorkspaceClick}
            onPointerDown={startWorkspacePan}
            onPointerMove={updateWorkspacePan}
            onPointerUp={endWorkspacePan}
            onPointerCancel={endWorkspacePan}
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
                  const previewFontSize =
                    visualResizePreview?.elementId === element.id
                      ? visualResizePreview.fontSize
                      : undefined;
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
                      {element.type === "text" || element.type === "date" ? (
                        element.type === "text" && editingTextElementId === element.id ? (
                          <textarea
                            ref={setEditingTextArea}
                            aria-label="Edit text element"
                            autoFocus
                            value={element.text ?? ""}
                            style={{
                              color:
                                colorPreviewByElementId.get(element.id) ??
                                element.color ??
                                "#000000",
                              fontFamily:
                                element.textAppearance?.fontFamily ??
                                "Helvetica, Arial, sans-serif",
                              fontSize:
                                (previewFontSize ?? element.textAppearance?.fontSize ?? 16) * zoom,
                              fontStyle: element.textAppearance?.italic ? "italic" : "normal",
                              fontWeight: element.textAppearance?.bold ? 700 : 400,
                              letterSpacing: `${String(element.textAppearance?.letterSpacing ?? 0)}px`,
                              lineHeight: element.textAppearance?.lineHeight ?? 1.2,
                              textAlign: element.textAppearance?.alignment ?? "left",
                              textDecoration: element.textAppearance?.underline
                                ? "underline"
                                : "none",
                            }}
                            onChange={(event) => {
                              applySnapshot(
                                editor.updateText(element.id, event.currentTarget.value),
                              );
                            }}
                            onBlur={() => {
                              setEditingTextElementId(undefined);
                            }}
                          />
                        ) : (
                          <div
                            className="text-element-display"
                            aria-label="Text element content"
                            style={{
                              color:
                                colorPreviewByElementId.get(element.id) ??
                                element.color ??
                                "#000000",
                              fontFamily:
                                element.textAppearance?.fontFamily ??
                                "Helvetica, Arial, sans-serif",
                              fontSize:
                                (previewFontSize ?? element.textAppearance?.fontSize ?? 16) * zoom,
                              fontStyle: element.textAppearance?.italic ? "italic" : "normal",
                              fontWeight: element.textAppearance?.bold ? 700 : 400,
                              letterSpacing: `${String(element.textAppearance?.letterSpacing ?? 0)}px`,
                              lineHeight: element.textAppearance?.lineHeight ?? 1.2,
                              textAlign: element.textAppearance?.alignment ?? "left",
                              textDecoration: element.textAppearance?.underline
                                ? "underline"
                                : "none",
                            }}
                            onDoubleClick={(event) => {
                              event.stopPropagation();
                              setEditingTextElementId(element.id);
                            }}
                          >
                            {element.text}
                          </div>
                        )
                      ) : null}
                      {element.type === "checkmark" || element.type === "cross" ? (
                        <svg
                          className={`annotation-symbol annotation-${element.type}`}
                          style={{
                            stroke:
                              colorPreviewByElementId.get(element.id) ?? element.color ?? "#000000",
                          }}
                          viewBox="0 0 100 100"
                          aria-hidden="true"
                          focusable="false"
                        >
                          {element.type === "checkmark" ? (
                            <path d="M16 52 L40 76 L84 24" />
                          ) : (
                            <>
                              <path d="M22 22 L78 78" />
                              <path d="M78 22 L22 78" />
                            </>
                          )}
                        </svg>
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
                            style={{
                              color:
                                colorPreviewByElementId.get(element.id) ??
                                element.color ??
                                "#000000",
                              fontSize: (element.textAppearance?.fontSize ?? 30) * zoom,
                            }}
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

        <aside className="element-inspector" aria-label="Selected element actions">
          {selectedElement === undefined ? (
            <div className="document-inspector">
              <strong>Document</strong>
              <p>{state.fileName ?? "Local PDF"}</p>
              <dl>
                <div>
                  <dt>Pages</dt>
                  <dd>{String(state.pageCount)}</dd>
                </div>
                <div>
                  <dt>Current page</dt>
                  <dd>{String(state.currentPageNumber)}</dd>
                </div>
                <div>
                  <dt>Zoom</dt>
                  <dd>{`${String(Math.round(zoom * 100))}%`}</dd>
                </div>
              </dl>
              <p className="document-inspector-hint">Select an element to edit its properties.</p>
            </div>
          ) : (
            <>
              {selectedElement.type === "text" || selectedElement.type === "date" ? (
                <section className="text-inspector" aria-label="Text properties">
                  <div
                    className="text-inspector-tabs"
                    role="tablist"
                    aria-label="Text inspector sections"
                  >
                    {(["text", "style", "page"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={textInspectorTab === tab}
                        onClick={() => {
                          setTextInspectorTab(tab);
                        }}
                      >
                        {tab === "text" ? "Text" : tab === "style" ? "Style" : "Page"}
                      </button>
                    ))}
                  </div>

                  {textInspectorTab === "text" ? (
                    <>
                      <label className="text-inspector-content">
                        Content
                        <textarea
                          aria-label="Text content"
                          value={selectedElement.text ?? ""}
                          onChange={(event) => {
                            applySnapshot(
                              editor.updateText(selectedElement.id, event.currentTarget.value),
                            );
                          }}
                        />
                      </label>{" "}
                      <div className="text-inspector-actions">
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
                          className="text-inspector-delete"
                          onClick={() => {
                            applySnapshot(editor.deleteElement(selectedElement.id));
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  ) : null}

                  {textInspectorTab === "style" ? (
                    <>
                      <label>
                        Font
                        <select
                          aria-label="Text font"
                          value={selectedElement.textAppearance?.fontFamily ?? "Helvetica"}
                          onChange={(event) => {
                            applySnapshot(
                              editor.updateTextAppearance(selectedElement.id, {
                                fontFamily: event.currentTarget.value,
                              }),
                            );
                          }}
                        >
                          <option>Helvetica</option>
                          <option>Times Roman</option>
                          <option>Arial</option>
                          <option>Georgia</option>
                          <option>Courier</option>
                        </select>
                      </label>

                      <div className="text-inspector-size-row">
                        <label>
                          Size
                          <select
                            aria-label="Text font size"
                            value={selectedElement.textAppearance?.fontSize ?? 16}
                            onChange={(event) => {
                              const fontSize = Number(event.currentTarget.value);
                              if (!Number.isFinite(fontSize) || fontSize <= 0) {
                                return;
                              }
                              applySnapshot(
                                editor.updateTextFontSize(selectedElement.id, fontSize),
                              );
                            }}
                          >
                            {[8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96].map(
                              (size) => (
                                <option key={size} value={size}>
                                  {size}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <div className="text-inspector-toggle-group" aria-label="Text emphasis">
                          <button
                            type="button"
                            aria-label="Bold"
                            aria-pressed={selectedElement.textAppearance?.bold ?? false}
                            onClick={() => {
                              applySnapshot(
                                editor.updateTextAppearance(selectedElement.id, {
                                  bold: !(selectedElement.textAppearance?.bold ?? false),
                                }),
                              );
                            }}
                          >
                            B
                          </button>
                          <button
                            type="button"
                            className="text-inspector-italic"
                            aria-label="Italic"
                            aria-pressed={selectedElement.textAppearance?.italic ?? false}
                            onClick={() => {
                              applySnapshot(
                                editor.updateTextAppearance(selectedElement.id, {
                                  italic: !(selectedElement.textAppearance?.italic ?? false),
                                }),
                              );
                            }}
                          >
                            I
                          </button>
                          <button
                            type="button"
                            className="text-inspector-underline"
                            aria-label="Underline"
                            aria-pressed={selectedElement.textAppearance?.underline ?? false}
                            onClick={() => {
                              applySnapshot(
                                editor.updateTextAppearance(selectedElement.id, {
                                  underline: !(selectedElement.textAppearance?.underline ?? false),
                                }),
                              );
                            }}
                          >
                            U
                          </button>
                        </div>
                      </div>

                      <label className="text-inspector-color">
                        Color
                        <ReleaseColorInput
                          ariaLabel="Text color"
                          value={
                            colorPreviewByElementId.get(selectedElement.id) ??
                            selectedElement.color ??
                            "#000000"
                          }
                          onPreview={(color) => {
                            handleColorPreview(selectedElement.id, color);
                          }}
                          onCommit={(color) => {
                            handleColorCommit(selectedElement.id, color);
                          }}
                        />
                      </label>

                      <div className="text-inspector-alignment">
                        <span>Alignment</span>
                        <div className="text-inspector-toggle-group" aria-label="Text alignment">
                          {(
                            [
                              ["left", "Align left", "\u2261"],
                              ["center", "Align center", "\u2261"],
                              ["right", "Align right", "\u2261"],
                            ] as const
                          ).map(([alignment, label, icon]) => (
                            <button
                              key={alignment}
                              type="button"
                              className={`text-inspector-align-${alignment}`}
                              aria-label={label}
                              aria-pressed={
                                (selectedElement.textAppearance?.alignment ?? "left") === alignment
                              }
                              onClick={() => {
                                applySnapshot(
                                  editor.updateTextAppearance(selectedElement.id, { alignment }),
                                );
                              }}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>
                      </div>

                      <label className="text-inspector-inline-field">
                        Line Height
                        <select
                          aria-label="Line height"
                          value={selectedElement.textAppearance?.lineHeight ?? 1.2}
                          onChange={(event) => {
                            applySnapshot(
                              editor.updateTextAppearance(selectedElement.id, {
                                lineHeight: Number(event.currentTarget.value),
                              }),
                            );
                          }}
                        >
                          <option value="1">1.00</option>
                          <option value="1.2">1.20</option>
                          <option value="1.5">1.50</option>
                          <option value="2">2.00</option>
                        </select>
                      </label>

                      <label className="text-inspector-inline-field">
                        Letter Spacing
                        <select
                          aria-label="Letter spacing"
                          value={selectedElement.textAppearance?.letterSpacing ?? 0}
                          onChange={(event) => {
                            applySnapshot(
                              editor.updateTextAppearance(selectedElement.id, {
                                letterSpacing: Number(event.currentTarget.value),
                              }),
                            );
                          }}
                        >
                          <option value="-0.5">-0.5</option>
                          <option value="0">0</option>
                          <option value="0.5">0.5</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                        </select>
                      </label>
                    </>
                  ) : null}

                  {textInspectorTab === "page" ? (
                    <p className="text-inspector-page">
                      This text belongs to page{" "}
                      {String(
                        state.pages.findIndex((page) => page.id === selectedElement.pageId) + 1,
                      )}
                      .
                    </p>
                  ) : null}
                </section>
              ) : null}
              {["image", "whiteout", "checkmark", "cross", "signature", "initials"].includes(
                selectedElement.type,
              ) ? (
                <section className="image-inspector" aria-label="Image properties">
                  <div
                    className="text-inspector-tabs"
                    role="tablist"
                    aria-label="Image inspector sections"
                  >
                    {(["text", "style", "page"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={imageInspectorTab === tab}
                        onClick={() => {
                          setImageInspectorTab(tab);
                        }}
                      >
                        {tab === "text"
                          ? "Image"
                          : tab === "style"
                            ? selectedElement.type === "checkmark" ||
                              selectedElement.type === "cross"
                              ? "Style"
                              : "Size"
                            : "Page"}
                      </button>
                    ))}
                  </div>
                  {imageInspectorTab === "text" ? (
                    <>
                      <div className="image-inspector-preview">
                        {selectedElement.image !== undefined ? (
                          <img src={selectedElement.image.dataUrl} alt="Selected element preview" />
                        ) : (
                          <span
                            className={`element-inspector-symbol element-inspector-symbol-${selectedElement.type}`}
                          >
                            {selectedElement.type === "checkmark"
                              ? "✓"
                              : selectedElement.type === "cross"
                                ? "×"
                                : selectedElement.type === "whiteout"
                                  ? "Whiteout"
                                  : (selectedElement.text ?? elementLabel(selectedElement))}
                          </span>
                        )}
                      </div>
                      <dl className="image-inspector-metadata">
                        <div>
                          <dt>Format</dt>
                          <dd>
                            {selectedElement.image === undefined
                              ? "Overlay"
                              : selectedElement.image.mimeType === "image/png"
                                ? "PNG"
                                : "JPG"}
                          </dd>
                        </div>
                        <div>
                          <dt>Original size</dt>
                          <dd>{`${String(Math.round(selectedElement.bounds.width))} × ${String(Math.round(selectedElement.bounds.height))} pt`}</dd>
                        </div>
                        <div>
                          <dt>Page</dt>
                          <dd>
                            {String(
                              state.pages.findIndex((page) => page.id === selectedElement.pageId) +
                                1,
                            )}
                          </dd>
                        </div>
                      </dl>
                    </>
                  ) : null}
                  {imageInspectorTab === "style" ? (
                    <>
                      <div className="image-inspector-size">
                        <label>
                          Width
                          <input
                            aria-label="Image width"
                            type="number"
                            min="16"
                            value={Math.round(selectedElement.bounds.width)}
                            onChange={(event) => {
                              const width = event.currentTarget.valueAsNumber;
                              if (Number.isFinite(width))
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
                            aria-label="Image height"
                            type="number"
                            min="16"
                            value={Math.round(selectedElement.bounds.height)}
                            onChange={(event) => {
                              const height = event.currentTarget.valueAsNumber;
                              if (Number.isFinite(height))
                                applySnapshot(
                                  editor.resizeElement(selectedElement.id, {
                                    width: selectedElement.bounds.width,
                                    height,
                                  }),
                                );
                            }}
                          />
                        </label>
                      </div>
                      {selectedElement.type === "checkmark" || selectedElement.type === "cross" ? (
                        <label className="text-inspector-color">
                          Color
                          <ReleaseColorInput
                            ariaLabel={`${elementLabel(selectedElement)} color`}
                            value={
                              colorPreviewByElementId.get(selectedElement.id) ??
                              selectedElement.color ??
                              "#000000"
                            }
                            onPreview={(color) => {
                              handleColorPreview(selectedElement.id, color);
                            }}
                            onCommit={(color) => {
                              handleColorCommit(selectedElement.id, color);
                            }}
                          />
                        </label>
                      ) : null}
                    </>
                  ) : null}
                  {imageInspectorTab === "page" ? (
                    <p className="image-inspector-page">
                      This image belongs to page{" "}
                      {String(
                        state.pages.findIndex((page) => page.id === selectedElement.pageId) + 1,
                      )}
                      .
                    </p>
                  ) : null}
                  {imageInspectorTab === "text" ? (
                    <div className="image-inspector-actions">
                      <button
                        type="button"
                        onClick={() => {
                          applySnapshot(editor.duplicateElement(selectedElement.id));
                        }}
                      >
                        Duplicate
                      </button>{" "}
                      <button
                        type="button"
                        className="text-inspector-delete"
                        onClick={() => {
                          applySnapshot(editor.deleteElement(selectedElement.id));
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </section>
              ) : null}{" "}
            </>
          )}
        </aside>
      </div>

      <footer className="editor-status-bar" aria-label="Document status">
        <span>{`Page ${String(state.currentPageNumber)} of ${String(state.pageCount)}`}</span>
        <span>{`${String(Math.round(zoom * 100))}%`}</span>
        <span>{state.isDirty ? "Unsaved changes" : "Ready"}</span>
      </footer>
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
    context.strokeStyle = "#000000";
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
          <button
            type="button"
            className="dialog-close"
            aria-label="Close dialog"
            onClick={onCancel}
          >
            ×
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
