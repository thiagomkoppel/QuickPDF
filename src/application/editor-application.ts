import {
  DocumentSession,
  DomainError,
  type Bounds,
  type DomainResult,
  type DocumentPage,
  type EditorElement,
  type SignatureElementContent,
  type TextElementContent,
} from "../domain/document-session";

export type EditorStatus = "empty" | "loading" | "ready" | "exporting" | "error";
export type EditorTool = "select" | "text" | "whiteout" | "signature" | "initials";
export type SignatureFont = "cursive" | "serif" | "marker" | "hand";
export type SignatureSource = "draw" | "type" | "upload";
export type SignatureElementType = "signature" | "initials";
export type EditorErrorCode =
  | "UnsupportedFile"
  | "EmptyFile"
  | "UnreadableFile"
  | "InvalidPdf"
  | "NoActiveDocument"
  | "MissingElement"
  | "InvalidElementBounds"
  | "InvalidTextAppearance"
  | "InvalidSignature"
  | "UnsupportedSignatureImage"
  | "SignatureImageTooLarge"
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
  readonly fontFamily?: string;
}

export interface ImageAppearance {
  readonly dataUrl: string;
  readonly mimeType: "image/png" | "image/jpeg";
}

export interface ExportElement {
  readonly id: string;
  readonly pageId: string;
  readonly type: "text" | "whiteout" | "signature" | "initials";
  readonly bounds: Bounds;
  readonly text?: string;
  readonly textAppearance?: TextAppearance;
  readonly image?: ImageAppearance;
  readonly source?: SignatureSource;
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
  readonly selectedElement?: ExportElement;
  readonly elements: readonly ExportElement[];
  readonly visibleElements: readonly ExportElement[];
  readonly exportFilename?: string;
  readonly error?: EditorError;
}

export interface EditorSnapshot {
  readonly state: EditorState;
  readonly canExport: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface SignatureImageInput {
  readonly dataUrl: string;
  readonly mimeType: "image/png" | "image/jpeg";
  readonly width: number;
  readonly height: number;
  readonly source: "draw" | "upload";
}

export interface TypedSignatureInput {
  readonly text: string;
  readonly fontFamily: SignatureFont;
}

export const COMMAND_HISTORY_LIMIT = 100;
export const MIN_TEXT_FONT_SIZE = 8;
export const MAX_TEXT_FONT_SIZE = 96;
export const DEFAULT_TEXT_APPEARANCE: TextAppearance = { fontSize: 16, color: "#111111" };
export const DEFAULT_SIGNATURE_APPEARANCE: TextAppearance = {
  fontSize: 34,
  color: "#111111",
  fontFamily: "cursive",
};
export const DEFAULT_INITIALS_APPEARANCE: TextAppearance = {
  fontSize: 26,
  color: "#111111",
  fontFamily: "cursive",
};
export const MIN_ELEMENT_WIDTH = 16;
export const MIN_ELEMENT_HEIGHT = 16;
export const MAX_SIGNATURE_IMAGE_BYTES = 2 * 1024 * 1024;

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

const isTextContent = (content: EditorElement["content"]): content is TextElementContent =>
  content !== undefined && !("kind" in content);

const isSignatureContent = (
  content: EditorElement["content"],
): content is SignatureElementContent => content !== undefined && "kind" in content;

const textFromElement = (element: EditorElement): string =>
  element.type === "text" && isTextContent(element.content) ? element.content.text : "";

const textFontSizeFromElement = (element: EditorElement): number => {
  const content = element.content;
  return element.type === "text" && isTextContent(content) && content.fontSize !== undefined
    ? content.fontSize
    : DEFAULT_TEXT_APPEARANCE.fontSize;
};

const clampTextFontSize = (fontSize: number): number =>
  Math.min(MAX_TEXT_FONT_SIZE, Math.max(MIN_TEXT_FONT_SIZE, fontSize));

const toExportElement = (element: EditorElement): ExportElement => {
  if (element.type === "whiteout") {
    return {
      id: element.id,
      pageId: element.pageId,
      type: "whiteout",
      bounds: cloneBounds(element.bounds),
    };
  }
  if (element.type === "signature" || element.type === "initials") {
    const content = isSignatureContent(element.content) ? element.content : undefined;
    if (content?.kind === "typed") {
      const appearance =
        element.type === "signature" ? DEFAULT_SIGNATURE_APPEARANCE : DEFAULT_INITIALS_APPEARANCE;
      return {
        id: element.id,
        pageId: element.pageId,
        type: element.type,
        bounds: cloneBounds(element.bounds),
        text: content.text,
        textAppearance: { ...appearance, fontFamily: content.fontFamily },
        source: "type",
      };
    }
    if (content?.kind === "image") {
      return {
        id: element.id,
        pageId: element.pageId,
        type: element.type,
        bounds: cloneBounds(element.bounds),
        image: { dataUrl: content.dataUrl, mimeType: content.mimeType },
        source: content.source,
      };
    }
  }
  return {
    id: element.id,
    pageId: element.pageId,
    type: "text",
    bounds: cloneBounds(element.bounds),
    text: textFromElement(element),
    textAppearance: { ...DEFAULT_TEXT_APPEARANCE, fontSize: textFontSizeFromElement(element) },
  };
};

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

export const validateSignatureImageFile = (
  file: Pick<LocalPdfFile, "name" | "size" | "type">,
): EditorError | undefined => {
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  const isSupportedType = file.type === "image/png" || file.type === "image/jpeg";
  const isSupportedExtension = extension === "png" || extension === "jpg" || extension === "jpeg";
  if (!isSupportedType || !isSupportedExtension) {
    return {
      code: "UnsupportedSignatureImage",
      message: "Use a PNG, JPG, or JPEG signature image.",
    };
  }
  if (file.size > MAX_SIGNATURE_IMAGE_BYTES) {
    return { code: "SignatureImageTooLarge", message: "Signature images must be 2 MB or smaller." };
  }
  return undefined;
};

interface HistoryState {
  readonly elements: readonly EditorElement[];
  readonly selectedElementId?: string;
}

interface HistoryEntry {
  readonly type: "add-element" | "delete-element" | "duplicate-element" | "update-element";
  readonly before: HistoryState;
  readonly after: HistoryState;
  readonly beforeRevision: number;
  readonly afterRevision: number;
}

const cloneHistoryElement = (element: EditorElement): EditorElement => ({
  ...element,
  bounds: { ...element.bounds },
  ...(element.content === undefined ? {} : { content: { ...element.content } }),
});

const cloneHistoryState = (state: HistoryState): HistoryState => ({
  elements: state.elements.map(cloneHistoryElement),
  ...(state.selectedElementId === undefined ? {} : { selectedElementId: state.selectedElementId }),
});

const elementsMatch = (left: EditorElement, right: EditorElement): boolean =>
  left.id === right.id &&
  left.pageId === right.pageId &&
  left.type === right.type &&
  left.bounds.x === right.bounds.x &&
  left.bounds.y === right.bounds.y &&
  left.bounds.width === right.bounds.width &&
  left.bounds.height === right.bounds.height &&
  JSON.stringify(left.content ?? {}) === JSON.stringify(right.content ?? {});
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
  #undoStack: HistoryEntry[] = [];
  #redoStack: HistoryEntry[] = [];
  #currentRevision = 0;
  #cleanRevision = 0;

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
    return {
      state: this.#state,
      canExport: this.#session !== undefined,
      canUndo: this.#undoStack.length > 0,
      canRedo: this.#redoStack.length > 0,
    };
  }

  public async openFile(file: LocalPdfFile): Promise<EditorSnapshot> {
    this.#disposeRenderDocument();
    this.#session = undefined;
    this.#originalBytes = undefined;
    this.#resetHistory();
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
    this.#resetHistory();
    this.#session = DocumentSession.create({
      id: this.#idGenerator.nextId("session"),
      pages: openResult.pages,
      temporaryPersonalInfo: { originalFileName: readResult.fileName },
      sourceReference: this.#idGenerator.nextId("source"),
    });
    this.#resetHistory();
    this.#syncState({ fileName: readResult.fileName, status: "ready" });
    return this.snapshot();
  }

  public closeDocument(): EditorSnapshot {
    this.#disposeRenderDocument();
    this.#session = undefined;
    this.#originalBytes = undefined;
    this.#resetHistory();
    this.#state = emptyState();
    return this.snapshot();
  }

  public setTool(tool: EditorTool): EditorSnapshot {
    this.#state = { ...this.#state, tool };
    return this.snapshot();
  }

  public selectElement(elementId: string): EditorSnapshot {
    const result = this.#session?.selectElement(elementId);
    if (result?.ok !== true) {
      return this.#operationError("MissingElement", "The selected element no longer exists.");
    }
    this.#syncState();
    return this.snapshot();
  }

  public clearSelection(): EditorSnapshot {
    const result = this.#session?.clearSelection();
    if (result?.ok !== true) {
      return this.#operationError("NoActiveDocument", "Open a PDF before editing.");
    }
    this.#syncState();
    return this.snapshot();
  }

  public addText(point: { readonly x: number; readonly y: number }, text = "Text"): EditorSnapshot {
    return this.#addElement({
      type: "text",
      bounds: { x: point.x, y: point.y, width: 160, height: 40 },
      text,
      fontSize: DEFAULT_TEXT_APPEARANCE.fontSize,
    });
  }

  public addWhiteout(bounds: Bounds): EditorSnapshot {
    return this.#addElement({ type: "whiteout", bounds });
  }

  public addTypedSignature(
    point: { readonly x: number; readonly y: number },
    input: TypedSignatureInput,
  ): EditorSnapshot {
    return this.#addElement({
      type: "signature",
      bounds: { x: point.x, y: point.y, width: 220, height: 70 },
      signatureContent: { kind: "typed", text: input.text, fontFamily: input.fontFamily },
    });
  }

  public addDrawnSignature(
    point: { readonly x: number; readonly y: number },
    image: SignatureImageInput,
  ): EditorSnapshot {
    return this.#addImageSignature("signature", point, image);
  }

  public addUploadedSignature(
    point: { readonly x: number; readonly y: number },
    image: SignatureImageInput,
  ): EditorSnapshot {
    return this.#addImageSignature("signature", point, { ...image, source: "upload" });
  }

  public addTypedInitials(
    point: { readonly x: number; readonly y: number },
    input: TypedSignatureInput,
  ): EditorSnapshot {
    return this.#addElement({
      type: "initials",
      bounds: { x: point.x, y: point.y, width: 96, height: 52 },
      signatureContent: { kind: "typed", text: input.text, fontFamily: input.fontFamily },
    });
  }

  public addDrawnInitials(
    point: { readonly x: number; readonly y: number },
    image: SignatureImageInput,
  ): EditorSnapshot {
    return this.#addImageSignature("initials", point, image);
  }

  public updateText(elementId: string, text: string): EditorSnapshot {
    const element = this.#session?.element(elementId);
    if (element?.type !== "text") {
      return this.#operationError("MissingElement", "The text element no longer exists.");
    }
    const content = element.content;
    const fontSize = isTextContent(content) ? content.fontSize : undefined;
    return this.#untrackedElementUpdate({
      ...element,
      content: { text, ...(fontSize === undefined ? {} : { fontSize }) },
    });
  }

  public updateTextFontSize(elementId: string, fontSize: number): EditorSnapshot {
    const element = this.#session?.element(elementId);
    if (element?.type !== "text") {
      return this.#operationError("MissingElement", "The text element no longer exists.");
    }
    if (!Number.isFinite(fontSize)) {
      return this.#operationError("InvalidTextAppearance", "Text size must be a finite number.");
    }
    const text = textFromElement(element);
    return this.#commitElementUpdate({
      ...element,
      content: { text, fontSize: clampTextFontSize(fontSize) },
    });
  }

  public previewTextResizeElement(
    elementId: string,
    bounds: Bounds,
    fontSize: number,
  ): EditorSnapshot {
    const element = this.#session?.element(elementId);
    if (element?.type !== "text") {
      return this.#operationError("MissingElement", "The text element no longer exists.");
    }
    if (!isFiniteBounds(bounds) || !Number.isFinite(fontSize)) {
      return this.#operationError("InvalidElementBounds", "Text resize values must be finite.");
    }
    return this.#previewElementUpdate({
      ...element,
      bounds: this.#constrainBounds(bounds),
      content: { text: textFromElement(element), fontSize: clampTextFontSize(fontSize) },
    });
  }

  public commitTextResizeElement(
    elementId: string,
    start: { readonly bounds: Bounds; readonly fontSize: number },
    end: { readonly bounds: Bounds; readonly fontSize: number },
  ): EditorSnapshot {
    const element = this.#session?.element(elementId);
    if (element?.type !== "text") {
      return this.#operationError("MissingElement", "The text element no longer exists.");
    }
    if (
      !isFiniteBounds(start.bounds) ||
      !isFiniteBounds(end.bounds) ||
      !Number.isFinite(start.fontSize) ||
      !Number.isFinite(end.fontSize)
    ) {
      return this.#operationError("InvalidElementBounds", "Text resize values must be finite.");
    }
    const text = textFromElement(element);
    const beforeElement: EditorElement = {
      ...element,
      bounds: this.#constrainBounds(start.bounds),
      content: { text, fontSize: clampTextFontSize(start.fontSize) },
    };
    const afterElement: EditorElement = {
      ...element,
      bounds: this.#constrainBounds(end.bounds),
      content: { text, fontSize: clampTextFontSize(end.fontSize) },
    };
    if (elementsMatch(beforeElement, afterElement)) {
      return this.#previewElementUpdate(afterElement);
    }
    return this.#commitElementUpdate(
      afterElement,
      this.#historyStateWithElement(beforeElement, elementId),
    );
  }

  public previewMoveElement(
    elementId: string,
    point: { readonly x: number; readonly y: number },
  ): EditorSnapshot {
    const element = this.#session?.element(elementId);
    if (element === undefined) {
      return this.#operationError("MissingElement", "The element no longer exists.");
    }
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return this.#operationError("InvalidElementBounds", "Element position must be finite.");
    }
    return this.#previewElementUpdate({
      ...element,
      bounds: this.#constrainBounds({ ...element.bounds, x: point.x, y: point.y }),
    });
  }

  public commitMoveElement(
    elementId: string,
    start: { readonly x: number; readonly y: number },
    end: { readonly x: number; readonly y: number },
  ): EditorSnapshot {
    const element = this.#session?.element(elementId);
    if (element === undefined) {
      return this.#operationError("MissingElement", "The element no longer exists.");
    }
    if (
      !Number.isFinite(start.x) ||
      !Number.isFinite(start.y) ||
      !Number.isFinite(end.x) ||
      !Number.isFinite(end.y)
    ) {
      return this.#operationError("InvalidElementBounds", "Element position must be finite.");
    }
    const beforeElement: EditorElement = {
      ...element,
      bounds: this.#constrainBounds({ ...element.bounds, x: start.x, y: start.y }),
    };
    const afterElement: EditorElement = {
      ...element,
      bounds: this.#constrainBounds({ ...element.bounds, x: end.x, y: end.y }),
    };
    if (elementsMatch(beforeElement, afterElement)) {
      return this.#previewElementUpdate(afterElement);
    }
    return this.#commitElementUpdate(
      afterElement,
      this.#historyStateWithElement(beforeElement, elementId),
    );
  }

  public moveElement(
    elementId: string,
    point: { readonly x: number; readonly y: number },
  ): EditorSnapshot {
    const element = this.#session?.element(elementId);
    if (element === undefined) {
      return this.#operationError("MissingElement", "The element no longer exists.");
    }
    return this.#commitElementUpdate({
      ...element,
      bounds: this.#constrainBounds({ ...element.bounds, x: point.x, y: point.y }),
    });
  }

  public previewResizeElement(elementId: string, bounds: Bounds): EditorSnapshot {
    const element = this.#session?.element(elementId);
    if (element === undefined) {
      return this.#operationError("MissingElement", "The element no longer exists.");
    }
    if (!isFiniteBounds(bounds)) {
      return this.#operationError("InvalidElementBounds", "Element bounds must be finite.");
    }
    return this.#previewElementUpdate({ ...element, bounds: this.#constrainBounds(bounds) });
  }

  public commitResizeElement(elementId: string, start: Bounds, end: Bounds): EditorSnapshot {
    const element = this.#session?.element(elementId);
    if (element === undefined) {
      return this.#operationError("MissingElement", "The element no longer exists.");
    }
    if (!isFiniteBounds(start) || !isFiniteBounds(end)) {
      return this.#operationError("InvalidElementBounds", "Element bounds must be finite.");
    }
    const beforeElement: EditorElement = { ...element, bounds: this.#constrainBounds(start) };
    const afterElement: EditorElement = { ...element, bounds: this.#constrainBounds(end) };
    if (elementsMatch(beforeElement, afterElement)) {
      return this.#previewElementUpdate(afterElement);
    }
    return this.#commitElementUpdate(
      afterElement,
      this.#historyStateWithElement(beforeElement, elementId),
    );
  }

  public resizeElement(
    elementId: string,
    size: { readonly width: number; readonly height: number },
  ): EditorSnapshot {
    const element = this.#session?.element(elementId);
    if (element === undefined) {
      return this.#operationError("MissingElement", "The element no longer exists.");
    }
    return this.#replaceElement({
      ...element,
      bounds: this.#constrainBounds({ ...element.bounds, width: size.width, height: size.height }),
    });
  }
  public duplicateElement(elementId: string): EditorSnapshot {
    const element = this.#session?.element(elementId);
    if (element === undefined) {
      return this.#operationError("MissingElement", "The element no longer exists.");
    }
    return this.#addElement({
      historyType: "duplicate-element",
      type: element.type,
      bounds: { ...element.bounds, x: element.bounds.x + 12, y: element.bounds.y + 12 },
      ...(isTextContent(element.content)
        ? { text: element.content.text, fontSize: textFontSizeFromElement(element) }
        : {}),
      ...(isSignatureContent(element.content) ? { signatureContent: element.content } : {}),
    });
  }

  public deleteElement(elementId: string): EditorSnapshot {
    const element = this.#session?.element(elementId);
    if (element === undefined) {
      return this.#operationError("MissingElement", "The element no longer exists.");
    }
    const before = this.#currentHistoryState(elementId);
    const result = this.#session?.deleteElement(elementId);
    if (result?.ok !== true) {
      return this.#operationError("MissingElement", "The element no longer exists.");
    }
    const after = this.#currentHistoryState(undefined);
    this.#recordHistory("delete-element", before, after);
    this.#syncState();
    return this.snapshot();
  }

  public undo(): EditorSnapshot {
    const entry = this.#undoStack.at(-1);
    if (entry === undefined) {
      return this.snapshot();
    }
    const result = this.#restoreHistoryState(entry.before);
    if (!result.ok) {
      return this.#operationError("OperationRejected", "The last action could not be undone.");
    }
    this.#undoStack.pop();
    this.#redoStack.push(entry);
    this.#currentRevision = entry.beforeRevision;
    this.#syncState();
    return this.snapshot();
  }

  public redo(): EditorSnapshot {
    const entry = this.#redoStack.at(-1);
    if (entry === undefined) {
      return this.snapshot();
    }
    const result = this.#restoreHistoryState(entry.after);
    if (!result.ok) {
      return this.#operationError(
        "OperationRejected",
        "The last undone action could not be redone.",
      );
    }
    this.#redoStack.pop();
    this.#undoStack.push(entry);
    this.#currentRevision = entry.afterRevision;
    this.#syncState();
    return this.snapshot();
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
    this.#cleanRevision = this.#currentRevision;
    this.#syncState({ status: "ready", exportFilename: filename });
    return this.snapshot();
  }

  #currentHistoryState(selectedElementId = this.#session?.selectedElementId): HistoryState {
    return cloneHistoryState({
      elements: this.#session?.elements() ?? [],
      ...(selectedElementId === undefined ? {} : { selectedElementId }),
    });
  }

  #historyStateWithElement(element: EditorElement, selectedElementId = element.id): HistoryState {
    return cloneHistoryState({
      elements: (this.#session?.elements() ?? []).map((candidate) =>
        candidate.id === element.id ? cloneHistoryElement(element) : candidate,
      ),
      selectedElementId,
    });
  }

  #restoreHistoryState(state: HistoryState): DomainResult {
    const session = this.#session;
    if (session === undefined) {
      return { ok: false, error: new DomainError("SessionDisposed", "No active session.") };
    }
    return session.replaceElements(state.elements, state.selectedElementId);
  }

  #recordHistory(type: HistoryEntry["type"], before: HistoryState, after: HistoryState): void {
    const beforeRevision = this.#currentRevision;
    const afterRevision = beforeRevision + 1;
    this.#currentRevision = afterRevision;
    this.#undoStack.push({
      type,
      before: cloneHistoryState(before),
      after: cloneHistoryState(after),
      beforeRevision,
      afterRevision,
    });
    if (this.#undoStack.length > COMMAND_HISTORY_LIMIT) {
      this.#undoStack.shift();
    }
    this.#redoStack = [];
  }

  #rewriteHistoryElement(element: EditorElement): void {
    const replaceInState = (state: HistoryState): HistoryState => {
      if (!state.elements.some((candidate) => candidate.id === element.id)) {
        return state;
      }
      return cloneHistoryState({
        ...state,
        elements: state.elements.map((candidate) =>
          candidate.id === element.id ? cloneHistoryElement(element) : candidate,
        ),
      });
    };

    const rewriteEntry = (entry: HistoryEntry): HistoryEntry => {
      const nextBefore = replaceInState(entry.before);
      const nextAfter = replaceInState(entry.after);
      return {
        ...entry,
        before: nextBefore,
        after: nextAfter,
        afterRevision: nextAfter !== entry.after ? this.#currentRevision : entry.afterRevision,
      };
    };

    this.#undoStack = this.#undoStack.map(rewriteEntry);
    this.#redoStack = this.#redoStack.map(rewriteEntry);
  }
  #markUntrackedEdit(): void {
    this.#currentRevision += 1;
    this.#redoStack = [];
  }

  #resetHistory(): void {
    this.#undoStack = [];
    this.#redoStack = [];
    this.#currentRevision = 0;
    this.#cleanRevision = 0;
  }
  #addImageSignature(
    type: SignatureElementType,
    point: { readonly x: number; readonly y: number },
    image: SignatureImageInput,
  ): EditorSnapshot {
    if (
      !Number.isFinite(image.width) ||
      !Number.isFinite(image.height) ||
      image.width <= 0 ||
      image.height <= 0
    ) {
      return this.#operationError("InvalidSignature", "Signature image dimensions must be valid.");
    }
    const width = type === "signature" ? 220 : 96;
    const height = Math.max(MIN_ELEMENT_HEIGHT, width * (image.height / image.width));
    return this.#addElement({
      type,
      bounds: { x: point.x, y: point.y, width, height },
      signatureContent: {
        kind: "image",
        dataUrl: image.dataUrl,
        mimeType: image.mimeType,
        source: image.source,
      },
    });
  }

  #addElement(request: {
    readonly historyType?: HistoryEntry["type"];
    readonly type: "text" | "whiteout" | "signature" | "initials";
    readonly bounds: Bounds;
    readonly text?: string;
    readonly fontSize?: number;
    readonly signatureContent?: SignatureElementContent;
  }): EditorSnapshot {
    const session = this.#session;
    const pageId = session?.currentPageId;
    if (session === undefined || pageId === undefined) {
      return this.#operationError("NoActiveDocument", "Open a PDF before adding elements.");
    }
    if (!isFiniteBounds(request.bounds)) {
      return this.#operationError("InvalidElementBounds", "Element bounds must be finite.");
    }
    if (
      (request.type === "signature" || request.type === "initials") &&
      request.signatureContent === undefined
    ) {
      return this.#operationError("InvalidSignature", "Signature content is required.");
    }

    const before = this.#currentHistoryState(
      request.historyType === "add-element" || request.historyType === undefined
        ? undefined
        : session.selectedElementId,
    );

    const element: EditorElement = {
      id: this.#idGenerator.nextId("element"),
      pageId,
      type: request.type,
      bounds: this.#constrainBounds(request.bounds),
      ...(request.type === "text"
        ? {
            content: {
              text: request.text ?? "Text",
              fontSize:
                request.fontSize === undefined
                  ? DEFAULT_TEXT_APPEARANCE.fontSize
                  : clampTextFontSize(request.fontSize),
            },
          }
        : {}),
      ...(request.type === "signature" || request.type === "initials"
        ? { content: request.signatureContent }
        : {}),
    };
    const result = session.addElement(element);
    if (!result.ok) {
      return this.#operationError("OperationRejected", "The element could not be added.");
    }
    session.selectElement(element.id);
    this.#recordHistory(
      request.historyType ?? "add-element",
      before,
      this.#currentHistoryState(element.id),
    );
    this.#syncState();
    return this.snapshot();
  }

  #replaceElement(element: EditorElement): EditorSnapshot {
    return this.#commitElementUpdate(element);
  }

  #previewElementUpdate(element: EditorElement): EditorSnapshot {
    const result = this.#session?.updateElement(element);
    if (result?.ok !== true) {
      return this.#operationError("OperationRejected", "The element could not be updated.");
    }
    this.#session?.selectElement(element.id);
    this.#syncState();
    return this.snapshot();
  }

  #untrackedElementUpdate(element: EditorElement): EditorSnapshot {
    const result = this.#session?.updateElement(element);
    if (result?.ok !== true) {
      return this.#operationError("OperationRejected", "The element could not be updated.");
    }
    this.#session?.selectElement(element.id);
    this.#markUntrackedEdit();
    this.#rewriteHistoryElement(element);
    this.#syncState();
    return this.snapshot();
  }

  #commitElementUpdate(
    element: EditorElement,
    before = this.#currentHistoryState(element.id),
  ): EditorSnapshot {
    const result = this.#session?.updateElement(element);
    if (result?.ok !== true) {
      return this.#operationError("OperationRejected", "The element could not be updated.");
    }
    this.#session?.selectElement(element.id);
    const after = this.#currentHistoryState(element.id);
    if (JSON.stringify(before.elements) !== JSON.stringify(after.elements)) {
      this.#recordHistory("update-element", before, after);
    }
    this.#syncState();
    return this.snapshot();
  }

  #orderedExportElements(): readonly ExportElement[] {
    const elements = this.#session?.elements().map(toExportElement) ?? [];
    return [
      ...elements.filter((element) => element.type === "whiteout"),
      ...elements.filter((element) => element.type === "signature" || element.type === "initials"),
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
    const selectedElement = elements.find((element) => element.id === session.selectedElementId);
    const baseState: EditorState = {
      status: "ready",
      pageCount: pages.length,
      currentPageNumber: currentPageIndex + 1,
      tool: this.#state.tool,
      isDirty: this.#currentRevision !== this.#cleanRevision,
      elements,
      visibleElements: elements.filter((element) => element.pageId === session.currentPageId),
      ...(originalFileName === undefined ? {} : { fileName: originalFileName }),
      ...(currentPage === undefined ? {} : { currentPage }),
      ...(this.#renderDocumentId === undefined ? {} : { renderDocumentId: this.#renderDocumentId }),
      ...(session.selectedElementId === undefined
        ? {}
        : { selectedElementId: session.selectedElementId }),
      ...(selectedElement === undefined ? {} : { selectedElement }),
    };
    this.#state = { ...baseState, ...overrides };
  }
}
