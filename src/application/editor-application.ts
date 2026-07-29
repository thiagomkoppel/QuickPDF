import {
  DocumentSession,
  type Bounds,
  type DocumentPage,
  type EditorElement,
} from "../domain/document-session";

export type EditorStatus = "empty" | "loading" | "ready" | "rendering" | "error";
export type EditorTool = "select" | "text" | "whiteout";
export type PendingDiscardAction = "close" | "replace";

export type EditorErrorCode =
  | "UnsupportedFile"
  | "EmptyFile"
  | "FileTooLarge"
  | "UnreadableFile"
  | "InvalidPdf"
  | "EncryptedPdf"
  | "OpenFailed"
  | "RenderFailure"
  | "NoActiveDocument"
  | "MissingElement"
  | "InvalidElementBounds"
  | "UnsupportedElementUpdate"
  | "InvalidPage"
  | "OperationRejected"
  | "ReplacementFailed"
  | "SessionDisposalFailed";

export interface EditorError {
  readonly code: EditorErrorCode;
  readonly message: string;
}

export interface PdfPageMetadata {
  readonly pageNumber: number;
  readonly width: number;
  readonly height: number;
}

export interface PdfDocumentHandle {
  readonly metadata: {
    readonly pageCount: number;
    readonly pages: readonly PdfPageMetadata[];
  };
  dispose(): void;
}

export interface PdfOpenSuccess {
  readonly ok: true;
  readonly document: PdfDocumentHandle;
}

export interface PdfOpenFailure {
  readonly ok: false;
  readonly error: EditorError;
}

export type PdfOpenResult = PdfOpenSuccess | PdfOpenFailure;

export interface PdfRenderRequest {
  readonly pageNumber: number;
  readonly scale: number;
  readonly canvas: HTMLCanvasElement;
  readonly signal: AbortSignal;
}

export interface PdfEngine {
  open(bytes: Uint8Array): Promise<PdfOpenResult>;
  renderPage(document: PdfDocumentHandle, request: PdfRenderRequest): Promise<void>;
}

export interface LocalPdfFile {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface LocalPdfReadSuccess {
  readonly ok: true;
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

export interface LocalPdfReadFailure {
  readonly ok: false;
  readonly error: EditorError;
}

export type LocalPdfReadResult = LocalPdfReadSuccess | LocalPdfReadFailure;

export interface LocalPdfFileReader {
  read(file: LocalPdfFile): Promise<LocalPdfReadResult>;
}

export interface IdGenerator {
  nextId(prefix: string): string;
}

export interface TextAppearance {
  readonly fontSize: number;
  readonly fontFamily: string;
  readonly color: string;
}

export interface EditorElementSnapshot {
  readonly id: string;
  readonly pageId: string;
  readonly type: "text" | "whiteout";
  readonly bounds: Bounds;
  readonly text?: string;
  readonly textAppearance?: TextAppearance;
}

export interface EditorState {
  readonly status: EditorStatus;
  readonly fileName?: string;
  readonly pageCount: number;
  readonly currentPageNumber: number;
  readonly currentPage?: PdfPageMetadata;
  readonly zoom: number;
  readonly tool: EditorTool;
  readonly isDirty: boolean;
  readonly selectedElementId?: string;
  readonly elements: readonly EditorElementSnapshot[];
  readonly visibleElements: readonly EditorElementSnapshot[];
  readonly pendingDiscardAction?: PendingDiscardAction;
  readonly error?: EditorError;
}

export interface EditorSnapshot {
  readonly state: EditorState;
  readonly canGoPrevious: boolean;
  readonly canGoNext: boolean;
  readonly canZoomIn: boolean;
  readonly canZoomOut: boolean;
}

export interface WheelZoomRequest {
  readonly deltaY: number;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 0.25;
export const MIN_ELEMENT_WIDTH = 16;
export const MIN_ELEMENT_HEIGHT = 16;

const defaultTextAppearance: TextAppearance = {
  fontSize: 16,
  fontFamily: "system-ui, sans-serif",
  color: "#111111",
};

const emptyState = (): EditorState => ({
  status: "empty",
  pageCount: 0,
  currentPageNumber: 0,
  zoom: 1,
  tool: "select",
  isDirty: false,
  elements: [],
  visibleElements: [],
});

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
const clampZoom = (zoom: number): number => clamp(zoom, MIN_ZOOM, MAX_ZOOM);
const isFinitePoint = (point: { readonly x: number; readonly y: number }): boolean =>
  Number.isFinite(point.x) && Number.isFinite(point.y);
const isFiniteBounds = (bounds: Bounds): boolean =>
  isFinitePoint(bounds) && Number.isFinite(bounds.width) && Number.isFinite(bounds.height);

const cloneBounds = (bounds: Bounds): Bounds => ({ ...bounds });

const getText = (element: EditorElement): string =>
  element.type === "text" && element.content !== undefined ? element.content.text : "";

const toSnapshot = (element: EditorElement): EditorElementSnapshot => ({
  id: element.id,
  pageId: element.pageId,
  type: element.type === "whiteout" ? "whiteout" : "text",
  bounds: cloneBounds(element.bounds),
  ...(element.type === "text"
    ? { text: getText(element), textAppearance: defaultTextAppearance }
    : {}),
});

export class SequentialIdGenerator implements IdGenerator {
  #next = 1;

  public nextId(prefix: string): string {
    const id = `${prefix}-${String(this.#next)}`;
    this.#next += 1;
    return id;
  }
}

export class PdfEditorApplication {
  readonly #fileReader: LocalPdfFileReader;
  readonly #pdfEngine: PdfEngine;
  readonly #idGenerator: IdGenerator;
  #document: PdfDocumentHandle | undefined;
  #session: DocumentSession | undefined;
  #state: EditorState = emptyState();
  #renderAbortController: AbortController | undefined;
  #renderSequence = 0;
  #pendingReplacementFile: LocalPdfFile | undefined;

  public constructor(
    fileReader: LocalPdfFileReader,
    pdfEngine: PdfEngine,
    idGenerator: IdGenerator,
  ) {
    this.#fileReader = fileReader;
    this.#pdfEngine = pdfEngine;
    this.#idGenerator = idGenerator;
  }

  public snapshot(): EditorSnapshot {
    return {
      state: this.#state,
      canGoPrevious: this.#state.currentPageNumber > 1,
      canGoNext:
        this.#state.currentPageNumber > 0 && this.#state.currentPageNumber < this.#state.pageCount,
      canZoomIn: this.#state.zoom < MAX_ZOOM,
      canZoomOut: this.#state.zoom > MIN_ZOOM,
    };
  }

  public async openFile(file: LocalPdfFile): Promise<EditorSnapshot> {
    if (this.#session?.isDirty === true) {
      this.#pendingReplacementFile = file;
      this.#state = this.#withState({ pendingDiscardAction: "replace" });
      return this.snapshot();
    }

    return this.#replaceWithFile(file);
  }

  public requestClose(): EditorSnapshot {
    if (this.#session?.isDirty === true) {
      this.#state = this.#withState({ pendingDiscardAction: "close" });
      return this.snapshot();
    }

    return this.#disposeActiveDocument();
  }

  public cancelDiscard(): EditorSnapshot {
    this.#pendingReplacementFile = undefined;
    this.#state = this.#withoutTransient({ pendingDiscardAction: true });
    return this.snapshot();
  }

  public async confirmDiscard(): Promise<EditorSnapshot> {
    const action = this.#state.pendingDiscardAction;
    const replacementFile = this.#pendingReplacementFile;
    this.#pendingReplacementFile = undefined;

    if (action === "replace" && replacementFile !== undefined) {
      return this.#replaceWithFile(replacementFile);
    }

    return this.#disposeActiveDocument();
  }

  public setTool(tool: EditorTool): EditorSnapshot {
    this.#state = this.#withState({ tool });
    return this.snapshot();
  }

  public selectElement(elementId: string): EditorSnapshot {
    if (this.#session === undefined) {
      return this.#operationError("NoActiveDocument", "Open a PDF before selecting an element.");
    }
    const result = this.#session.selectElement(elementId);
    if (!result.ok) {
      return this.#operationError("MissingElement", "The selected element no longer exists.");
    }
    this.#syncState();
    return this.snapshot();
  }

  public clearSelection(): EditorSnapshot {
    this.#session?.clearSelection();
    this.#syncState();
    return this.snapshot();
  }

  public addText(point: { readonly x: number; readonly y: number }, text = "Text"): EditorSnapshot {
    if (!isFinitePoint(point)) {
      return this.#operationError(
        "InvalidElementBounds",
        "Text element coordinates must be finite numbers.",
      );
    }

    return this.#addElement({
      type: "text",
      bounds: { x: point.x, y: point.y, width: 160, height: 40 },
      text,
    });
  }

  public addWhiteout(bounds: Bounds): EditorSnapshot {
    return this.#addElement({
      type: "whiteout",
      bounds,
    });
  }

  public updateText(elementId: string, text: string): EditorSnapshot {
    const element = this.#requireEditableElement(elementId);
    if (element === undefined) {
      return this.#operationError("MissingElement", "The text element no longer exists.");
    }
    if (element.type !== "text") {
      return this.#operationError("UnsupportedElementUpdate", "Only text elements can be edited.");
    }
    return this.#replaceElement({ ...element, content: { text } });
  }

  public moveElement(
    elementId: string,
    nextOrigin: { readonly x: number; readonly y: number },
  ): EditorSnapshot {
    const element = this.#requireEditableElement(elementId);
    if (element === undefined) {
      return this.#operationError("MissingElement", "The element no longer exists.");
    }
    if (!isFinitePoint(nextOrigin)) {
      return this.#operationError(
        "InvalidElementBounds",
        "Element coordinates must be finite numbers.",
      );
    }

    return this.#replaceElement({
      ...element,
      bounds: this.#constrainBounds({ ...element.bounds, x: nextOrigin.x, y: nextOrigin.y }),
    });
  }

  public resizeElement(
    elementId: string,
    size: { readonly width: number; readonly height: number },
  ): EditorSnapshot {
    const element = this.#requireEditableElement(elementId);
    if (element === undefined) {
      return this.#operationError("MissingElement", "The element no longer exists.");
    }
    if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) {
      return this.#operationError(
        "InvalidElementBounds",
        "Element dimensions must be finite numbers.",
      );
    }

    return this.#replaceElement({
      ...element,
      bounds: this.#constrainBounds({ ...element.bounds, width: size.width, height: size.height }),
    });
  }

  public duplicateElement(elementId: string): EditorSnapshot {
    const element = this.#requireEditableElement(elementId);
    if (element === undefined) {
      return this.#operationError("MissingElement", "The element no longer exists.");
    }
    return this.#addElement({
      type: element.type === "whiteout" ? "whiteout" : "text",
      bounds: this.#constrainBounds({
        ...element.bounds,
        x: element.bounds.x + 12,
        y: element.bounds.y + 12,
      }),
      text: getText(element),
    });
  }

  public deleteElement(elementId: string): EditorSnapshot {
    if (this.#session === undefined) {
      return this.#operationError("NoActiveDocument", "Open a PDF before deleting an element.");
    }
    const result = this.#session.deleteElement(elementId);
    if (!result.ok) {
      return this.#operationError("MissingElement", "The element no longer exists.");
    }
    this.#syncState();
    return this.snapshot();
  }

  public goToPage(pageNumber: number): EditorSnapshot {
    if (this.#session === undefined || pageNumber < 1 || pageNumber > this.#state.pageCount) {
      return this.snapshot();
    }
    const page = this.#session.pages()[pageNumber - 1];
    if (page === undefined) {
      return this.snapshot();
    }
    this.cancelRender();
    this.#session.setCurrentPage(page.id);
    this.#syncState();
    return this.snapshot();
  }

  public goPrevious(): EditorSnapshot {
    return this.goToPage(this.#state.currentPageNumber - 1);
  }

  public goNext(): EditorSnapshot {
    return this.goToPage(this.#state.currentPageNumber + 1);
  }

  public zoomIn(): EditorSnapshot {
    this.#state = this.#withState({ zoom: clampZoom(this.#state.zoom + ZOOM_STEP) });
    return this.snapshot();
  }

  public zoomOut(): EditorSnapshot {
    this.#state = this.#withState({ zoom: clampZoom(this.#state.zoom - ZOOM_STEP) });
    return this.snapshot();
  }

  public resetZoom(): EditorSnapshot {
    this.#state = this.#withState({ zoom: 1 });
    return this.snapshot();
  }

  public fitWidth(availableWidth: number): EditorSnapshot {
    const pageWidth = this.#state.currentPage?.width;
    if (pageWidth === undefined || pageWidth <= 0) {
      return this.snapshot();
    }
    this.#state = this.#withState({ zoom: clampZoom(availableWidth / pageWidth) });
    return this.snapshot();
  }

  public handleWheelZoom(request: WheelZoomRequest): {
    readonly handled: boolean;
    readonly snapshot: EditorSnapshot;
  } {
    if (!request.ctrlKey && !request.metaKey) {
      return { handled: false, snapshot: this.snapshot() };
    }

    const snapshot = request.deltaY < 0 ? this.zoomIn() : this.zoomOut();
    return { handled: true, snapshot };
  }

  public async renderCurrentPage(canvas: HTMLCanvasElement): Promise<EditorSnapshot> {
    if (this.#document === undefined || this.#state.currentPageNumber === 0) {
      return this.#operationError("NoActiveDocument", "Open a PDF before rendering.");
    }

    this.cancelRender();
    const renderId = ++this.#renderSequence;
    const controller = new AbortController();
    this.#renderAbortController = controller;
    this.#state = this.#withoutTransient({ error: true }, { status: "rendering" });

    try {
      await this.#pdfEngine.renderPage(this.#document, {
        pageNumber: this.#state.currentPageNumber,
        scale: this.#state.zoom,
        canvas,
        signal: controller.signal,
      });
      if (renderId === this.#renderSequence && !controller.signal.aborted) {
        this.#state = this.#withState({ status: "ready" });
      }
    } catch {
      if (!controller.signal.aborted) {
        this.#state = this.#withState({
          status: "error",
          error: {
            code: "RenderFailure",
            message: "This page could not be rendered. Try another page or reopen the document.",
          },
        });
      }
    } finally {
      if (this.#renderAbortController === controller) {
        this.#renderAbortController = undefined;
      }
    }

    return this.snapshot();
  }

  public cancelRender(): void {
    this.#renderSequence += 1;
    this.#renderAbortController?.abort();
    this.#renderAbortController = undefined;
  }

  async #replaceWithFile(file: LocalPdfFile): Promise<EditorSnapshot> {
    const previousState = this.#state;
    this.#state = this.#withoutTransient(
      { error: true, pendingDiscardAction: true },
      { status: "loading" },
    );
    const readResult = await this.#fileReader.read(file);
    if (!readResult.ok) {
      this.#state = this.#failedReplacementState(previousState, readResult.error);
      return this.snapshot();
    }

    const openResult = await this.#pdfEngine.open(readResult.bytes);
    if (!openResult.ok) {
      this.#state = this.#failedReplacementState(previousState, openResult.error);
      return this.snapshot();
    }

    const pages = openResult.document.metadata.pages.map<DocumentPage>((page) => ({
      id: `page-${String(page.pageNumber)}`,
      width: page.width,
      height: page.height,
      rotation: 0,
    }));
    const session = DocumentSession.create({
      id: this.#idGenerator.nextId("session"),
      pages,
      temporaryPersonalInfo: { originalFileName: readResult.fileName },
      sourceReference: this.#idGenerator.nextId("source"),
    });

    const previousDocument = this.#document;
    this.cancelRender();
    this.#document = openResult.document;
    this.#session = session;
    previousDocument?.dispose();
    this.#syncState({ fileName: readResult.fileName, status: "ready", zoom: 1, tool: "select" });
    return this.snapshot();
  }

  #disposeActiveDocument(): EditorSnapshot {
    this.cancelRender();
    this.#document?.dispose();
    this.#session?.dispose();
    this.#document = undefined;
    this.#session = undefined;
    this.#pendingReplacementFile = undefined;
    this.#state = emptyState();
    return this.snapshot();
  }

  #addElement(request: {
    readonly type: "text" | "whiteout";
    readonly bounds: Bounds;
    readonly text?: string;
  }): EditorSnapshot {
    if (this.#session === undefined) {
      return this.#operationError("NoActiveDocument", "Open a PDF before adding elements.");
    }
    if (!isFiniteBounds(request.bounds)) {
      return this.#operationError("InvalidElementBounds", "Element bounds must be finite numbers.");
    }
    const pageId = this.#session.currentPageId;
    if (pageId === undefined) {
      return this.#operationError("InvalidPage", "The current page is unavailable.");
    }
    const element: EditorElement = {
      id: this.#idGenerator.nextId("element"),
      pageId,
      type: request.type,
      bounds: this.#constrainBounds(request.bounds),
      ...(request.type === "text" ? { content: { text: request.text ?? "Text" } } : {}),
    };
    const result = this.#session.addElement(element);
    if (!result.ok) {
      return this.#operationError("OperationRejected", "The element could not be added.");
    }
    this.#session.selectElement(element.id);
    this.#syncState();
    return this.snapshot();
  }

  #replaceElement(element: EditorElement): EditorSnapshot {
    if (this.#session === undefined) {
      return this.#operationError("NoActiveDocument", "Open a PDF before editing elements.");
    }
    const result = this.#session.updateElement(element);
    if (!result.ok) {
      return this.#operationError("OperationRejected", "The element could not be updated.");
    }
    this.#syncState();
    return this.snapshot();
  }

  #requireEditableElement(elementId: string): EditorElement | undefined {
    return this.#session?.element(elementId);
  }

  #constrainBounds(bounds: Bounds): Bounds {
    const page = this.#state.currentPage;
    const width = Math.max(MIN_ELEMENT_WIDTH, bounds.width);
    const height = Math.max(MIN_ELEMENT_HEIGHT, bounds.height);
    if (page === undefined) {
      return { x: bounds.x, y: bounds.y, width, height };
    }
    return {
      x: clamp(bounds.x, 0, Math.max(0, page.width - width)),
      y: clamp(bounds.y, 0, Math.max(0, page.height - height)),
      width: Math.min(width, page.width),
      height: Math.min(height, page.height),
    };
  }

  #syncState(overrides: Partial<EditorState> = {}): void {
    const session = this.#session;
    if (session === undefined) {
      this.#state = emptyState();
      return;
    }
    const pages = session.pages();
    const currentPageIndex = Math.max(
      0,
      pages.findIndex((page) => page.id === session.currentPageId),
    );
    const currentPage = this.#document?.metadata.pages[currentPageIndex];
    const elements = session
      .elements()
      .filter((element) => element.type === "text" || element.type === "whiteout")
      .map(toSnapshot);
    const baseState: EditorState = {
      status: "ready",
      pageCount: pages.length,
      currentPageNumber: currentPageIndex + 1,
      zoom: this.#state.zoom,
      tool: this.#state.tool,
      isDirty: session.isDirty,
      elements,
      visibleElements: elements.filter((element) => element.pageId === session.currentPageId),
      ...(session.temporaryPersonalInfo.originalFileName === undefined
        ? {}
        : { fileName: session.temporaryPersonalInfo.originalFileName }),
      ...(currentPage === undefined ? {} : { currentPage }),
      ...(session.selectedElementId === undefined
        ? {}
        : { selectedElementId: session.selectedElementId }),
    };
    this.#state = { ...baseState, ...overrides };
  }
  #operationError(code: EditorErrorCode, message: string): EditorSnapshot {
    this.#state = this.#withState({
      status: this.#state.status === "empty" ? "error" : this.#state.status,
      error: { code, message },
    });
    return this.snapshot();
  }

  #failedReplacementState(previousState: EditorState, error: EditorError): EditorState {
    if (previousState.status === "empty") {
      return { ...emptyState(), status: "error", error };
    }

    const { pendingDiscardAction: discardedAction, ...rest } = previousState;
    void discardedAction;
    return { ...rest, error };
  }
  #withState(patch: Partial<EditorState>): EditorState {
    return { ...this.#state, ...patch };
  }

  #withoutTransient(
    remove: { readonly error?: true; readonly pendingDiscardAction?: true },
    patch: Partial<EditorState> = {},
  ): EditorState {
    const { error: discardedError, pendingDiscardAction: discardedAction, ...rest } = this.#state;
    void discardedError;
    void discardedAction;
    return {
      ...rest,
      ...patch,
      ...(remove.error === true
        ? {}
        : this.#state.error === undefined
          ? {}
          : { error: this.#state.error }),
      ...(remove.pendingDiscardAction === true
        ? {}
        : this.#state.pendingDiscardAction === undefined
          ? {}
          : { pendingDiscardAction: this.#state.pendingDiscardAction }),
    };
  }
}
