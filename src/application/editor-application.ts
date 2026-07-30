import {
  DocumentSession,
  type Bounds,
  type DocumentPage,
  type EditorElement,
} from "../domain/document-session";

export type EditorStatus = "empty" | "loading" | "ready" | "exporting" | "error";
export type EditorTool = "select" | "text" | "whiteout";
export type EditorErrorCode =
  | "UnsupportedFile"
  | "EmptyFile"
  | "UnreadableFile"
  | "InvalidPdf"
  | "NoActiveDocument"
  | "MissingElement"
  | "InvalidElementBounds"
  | "OperationRejected"
  | "RenderFailed"
  | "ExportFailed"
  | "DownloadFailed";

export interface EditorError {
  readonly code: EditorErrorCode;
  readonly message: string;
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

export interface PdfOpenSuccess {
  readonly ok: true;
  readonly pages: readonly DocumentPage[];
}

export interface PdfFailure {
  readonly ok: false;
  readonly error: EditorError;
}

export type PdfOpenResult = PdfOpenSuccess | PdfFailure;

export interface PdfRenderDocumentSuccess {
  readonly ok: true;
  readonly documentId: string;
}

export type PdfRenderDocumentResult = PdfRenderDocumentSuccess | PdfFailure;

export interface PdfRenderDocumentGateway {
  openRenderDocument(bytes: Uint8Array): Promise<PdfRenderDocumentResult>;
  disposeRenderDocument(documentId: string): void;
}

export interface TextAppearance {
  readonly fontSize: number;
  readonly color: string;
}

export interface ExportElement {
  readonly id: string;
  readonly pageId: string;
  readonly type: "text" | "whiteout";
  readonly bounds: Bounds;
  readonly text?: string;
  readonly textAppearance?: TextAppearance;
}

export interface PdfExportRequest {
  readonly originalBytes: Uint8Array;
  readonly pages: readonly DocumentPage[];
  readonly elements: readonly ExportElement[];
}

export interface PdfExportSuccess {
  readonly ok: true;
  readonly bytes: Uint8Array;
}

export type PdfExportResult = PdfExportSuccess | PdfFailure;

export interface PdfExportGateway {
  open(bytes: Uint8Array): Promise<PdfOpenResult>;
  exportPdf(request: PdfExportRequest): Promise<PdfExportResult>;
}

export interface DownloadRequest {
  readonly bytes: Uint8Array;
  readonly filename: string;
  readonly mimeType: string;
}

export interface DownloadAdapter {
  download(request: DownloadRequest): void;
}

export interface IdGenerator {
  nextId(prefix: string): string;
}

export interface EditorState {
  readonly status: EditorStatus;
  readonly fileName?: string;
  readonly pageCount: number;
  readonly currentPageNumber: number;
  readonly currentPage?: DocumentPage;
  readonly renderDocumentId?: string;
  readonly tool: EditorTool;
  readonly isDirty: boolean;
  readonly selectedElementId?: string;
  readonly elements: readonly ExportElement[];
  readonly visibleElements: readonly ExportElement[];
  readonly exportFilename?: string;
  readonly error?: EditorError;
}

export interface EditorSnapshot {
  readonly state: EditorState;
  readonly canExport: boolean;
}

export const DEFAULT_TEXT_APPEARANCE: TextAppearance = { fontSize: 16, color: "#111111" };
export const MIN_ELEMENT_WIDTH = 16;
export const MIN_ELEMENT_HEIGHT = 16;

const emptyState = (): EditorState => ({
  status: "empty",
  pageCount: 0,
  currentPageNumber: 0,
  tool: "select",
  isDirty: false,
  elements: [],
  visibleElements: [],
});

const cloneBytes = (bytes: Uint8Array): Uint8Array => new Uint8Array(bytes);
const cloneBounds = (bounds: Bounds): Bounds => ({ ...bounds });
const isFiniteBounds = (bounds: Bounds): boolean =>
  Number.isFinite(bounds.x) &&
  Number.isFinite(bounds.y) &&
  Number.isFinite(bounds.width) &&
  Number.isFinite(bounds.height) &&
  bounds.width > 0 &&
  bounds.height > 0;

const textFromElement = (element: EditorElement): string =>
  element.type === "text" && element.content !== undefined ? element.content.text : "";

const toExportElement = (element: EditorElement): ExportElement => ({
  id: element.id,
  pageId: element.pageId,
  type: element.type === "whiteout" ? "whiteout" : "text",
  bounds: cloneBounds(element.bounds),
  ...(element.type === "text"
    ? { text: textFromElement(element), textAppearance: DEFAULT_TEXT_APPEARANCE }
    : {}),
});

const safeExportFilename = (fileName: string | undefined): string => {
  const fallback = "quickpdf-edited";
  const withoutPath = (fileName ?? fallback).split(/[/\\]/).at(-1) ?? fallback;
  const withoutExtension = withoutPath.replace(/\.pdf$/i, "");
  const safeBase = withoutExtension
    .replace(/[^a-zA-Z0-9._ -]+/g, "")
    .trim()
    .replace(/[. ]+$/g, "");
  return `${safeBase.length === 0 ? fallback : safeBase}-edited.pdf`;
};

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
  readonly #pdfGateway: PdfExportGateway;
  readonly #downloadAdapter: DownloadAdapter;
  readonly #idGenerator: IdGenerator;
  readonly #renderGateway: PdfRenderDocumentGateway | undefined;
  #session: DocumentSession | undefined;
  #originalBytes: Uint8Array | undefined;
  #renderDocumentId: string | undefined;
  #state: EditorState = emptyState();

  public constructor(
    fileReader: LocalPdfFileReader,
    pdfGateway: PdfExportGateway,
    downloadAdapter: DownloadAdapter,
    idGenerator: IdGenerator,
    renderGateway?: PdfRenderDocumentGateway,
  ) {
    this.#fileReader = fileReader;
    this.#pdfGateway = pdfGateway;
    this.#downloadAdapter = downloadAdapter;
    this.#idGenerator = idGenerator;
    this.#renderGateway = renderGateway;
  }

  public snapshot(): EditorSnapshot {
    return { state: this.#state, canExport: this.#session !== undefined };
  }

  public async openFile(file: LocalPdfFile): Promise<EditorSnapshot> {
    this.#disposeRenderDocument();
    this.#session = undefined;
    this.#originalBytes = undefined;
    const {
      error: discardedOpenError,
      exportFilename: discardedExportFilename,
      ...openState
    } = this.#state;
    void discardedOpenError;
    void discardedExportFilename;
    this.#state = { ...openState, status: "loading" };
    const readResult = await this.#fileReader.read(file);
    if (!readResult.ok) {
      this.#state = { ...emptyState(), status: "error", error: readResult.error };
      return this.snapshot();
    }

    const originalBytes = cloneBytes(readResult.bytes);
    const openResult = await this.#pdfGateway.open(originalBytes);
    if (!openResult.ok) {
      this.#state = { ...emptyState(), status: "error", error: openResult.error };
      return this.snapshot();
    }

    if (this.#renderGateway !== undefined) {
      const renderResult = await this.#renderGateway.openRenderDocument(cloneBytes(originalBytes));
      if (!renderResult.ok) {
        this.#state = { ...emptyState(), status: "error", error: renderResult.error };
        return this.snapshot();
      }
      this.#renderDocumentId = renderResult.documentId;
    }

    this.#originalBytes = originalBytes;
    this.#session = DocumentSession.create({
      id: this.#idGenerator.nextId("session"),
      pages: openResult.pages,
      temporaryPersonalInfo: { originalFileName: readResult.fileName },
      sourceReference: this.#idGenerator.nextId("source"),
    });
    this.#syncState({ fileName: readResult.fileName, status: "ready" });
    return this.snapshot();
  }

  public closeDocument(): EditorSnapshot {
    this.#disposeRenderDocument();
    this.#session = undefined;
    this.#originalBytes = undefined;
    this.#state = emptyState();
    return this.snapshot();
  }

  public setTool(tool: EditorTool): EditorSnapshot {
    this.#state = { ...this.#state, tool };
    return this.snapshot();
  }

  public addText(point: { readonly x: number; readonly y: number }, text = "Text"): EditorSnapshot {
    return this.#addElement({
      type: "text",
      bounds: { x: point.x, y: point.y, width: 160, height: 40 },
      text,
    });
  }

  public addWhiteout(bounds: Bounds): EditorSnapshot {
    return this.#addElement({ type: "whiteout", bounds });
  }

  public updateText(elementId: string, text: string): EditorSnapshot {
    const element = this.#session?.element(elementId);
    if (element?.type !== "text") {
      return this.#operationError("MissingElement", "The text element no longer exists.");
    }
    return this.#replaceElement({ ...element, content: { text } });
  }

  public async exportCurrentPdf(): Promise<EditorSnapshot> {
    const session = this.#session;
    const originalBytes = this.#originalBytes;
    if (session === undefined || originalBytes === undefined) {
      return this.#operationError("NoActiveDocument", "Open a PDF before downloading.");
    }

    const before = this.#state;
    const { error: discardedExportError, ...exportingState } = this.#state;
    void discardedExportError;
    this.#state = { ...exportingState, status: "exporting" };
    const exportResult = await this.#pdfGateway.exportPdf({
      originalBytes: cloneBytes(originalBytes),
      pages: session.pages(),
      elements: this.#orderedExportElements(),
    });
    if (!exportResult.ok) {
      this.#state = { ...before, error: exportResult.error };
      return this.snapshot();
    }

    const filename = safeExportFilename(this.#state.fileName);
    try {
      this.#downloadAdapter.download({
        bytes: exportResult.bytes,
        filename,
        mimeType: "application/pdf",
      });
    } catch {
      this.#state = {
        ...before,
        error: { code: "DownloadFailed", message: "The edited PDF could not be downloaded." },
      };
      return this.snapshot();
    }

    session.markClean();
    this.#syncState({ status: "ready", exportFilename: filename });
    return this.snapshot();
  }

  #addElement(request: {
    readonly type: "text" | "whiteout";
    readonly bounds: Bounds;
    readonly text?: string;
  }): EditorSnapshot {
    const session = this.#session;
    const pageId = session?.currentPageId;
    if (session === undefined || pageId === undefined) {
      return this.#operationError("NoActiveDocument", "Open a PDF before adding elements.");
    }
    if (!isFiniteBounds(request.bounds)) {
      return this.#operationError("InvalidElementBounds", "Element bounds must be finite.");
    }

    const element: EditorElement = {
      id: this.#idGenerator.nextId("element"),
      pageId,
      type: request.type,
      bounds: this.#constrainBounds(request.bounds),
      ...(request.type === "text" ? { content: { text: request.text ?? "Text" } } : {}),
    };
    const result = session.addElement(element);
    if (!result.ok) {
      return this.#operationError("OperationRejected", "The element could not be added.");
    }
    session.selectElement(element.id);
    this.#syncState();
    return this.snapshot();
  }

  #replaceElement(element: EditorElement): EditorSnapshot {
    const result = this.#session?.updateElement(element);
    if (result?.ok !== true) {
      return this.#operationError("OperationRejected", "The element could not be updated.");
    }
    this.#syncState();
    return this.snapshot();
  }

  #orderedExportElements(): readonly ExportElement[] {
    const elements = this.#session?.elements().map(toExportElement) ?? [];
    return [
      ...elements.filter((element) => element.type === "whiteout"),
      ...elements.filter(
        (element) => element.type === "text" && (element.text ?? "").trim().length > 0,
      ),
    ];
  }

  #constrainBounds(bounds: Bounds): Bounds {
    const page = this.#state.currentPage;
    const width = Math.max(MIN_ELEMENT_WIDTH, bounds.width);
    const height = Math.max(MIN_ELEMENT_HEIGHT, bounds.height);
    if (page === undefined) {
      return { ...bounds, width, height };
    }
    return {
      x: Math.min(Math.max(bounds.x, 0), Math.max(0, page.width - width)),
      y: Math.min(Math.max(bounds.y, 0), Math.max(0, page.height - height)),
      width: Math.min(width, page.width),
      height: Math.min(height, page.height),
    };
  }

  #operationError(code: EditorErrorCode, message: string): EditorSnapshot {
    this.#state = { ...this.#state, error: { code, message } };
    return this.snapshot();
  }

  #disposeRenderDocument(): void {
    const renderDocumentId = this.#renderDocumentId;
    if (renderDocumentId !== undefined) {
      this.#renderGateway?.disposeRenderDocument(renderDocumentId);
      this.#renderDocumentId = undefined;
    }
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
    const elements = session.elements().map(toExportElement);
    const currentPage = pages[currentPageIndex];
    const originalFileName = session.temporaryPersonalInfo.originalFileName;
    const baseState: EditorState = {
      status: "ready",
      pageCount: pages.length,
      currentPageNumber: currentPageIndex + 1,
      tool: this.#state.tool,
      isDirty: session.isDirty,
      elements,
      visibleElements: elements.filter((element) => element.pageId === session.currentPageId),
      ...(originalFileName === undefined ? {} : { fileName: originalFileName }),
      ...(currentPage === undefined ? {} : { currentPage }),
      ...(this.#renderDocumentId === undefined ? {} : { renderDocumentId: this.#renderDocumentId }),
      ...(session.selectedElementId === undefined
        ? {}
        : { selectedElementId: session.selectedElementId }),
    };
    this.#state = { ...baseState, ...overrides };
  }
}
