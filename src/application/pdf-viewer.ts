export type ViewerStatus = "empty" | "loading" | "ready" | "rendering" | "error";

export type PdfViewerErrorCode =
  | "UnsupportedFile"
  | "EmptyFile"
  | "FileTooLarge"
  | "UnreadableFile"
  | "InvalidPdf"
  | "EncryptedPdf"
  | "OpenFailed"
  | "RenderFailure"
  | "SessionClosed";

export interface PdfViewerError {
  readonly code: PdfViewerErrorCode;
  readonly message: string;
}

export interface PdfPageSize {
  readonly width: number;
  readonly height: number;
}

export interface PdfPageMetadata extends PdfPageSize {
  readonly pageNumber: number;
}

export interface PdfDocumentMetadata {
  readonly pageCount: number;
  readonly pages: readonly PdfPageMetadata[];
}

export interface PdfDocumentHandle {
  readonly metadata: PdfDocumentMetadata;
  dispose(): void;
}

export interface PdfOpenSuccess {
  readonly ok: true;
  readonly document: PdfDocumentHandle;
}

export interface PdfOpenFailure {
  readonly ok: false;
  readonly error: PdfViewerError;
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

export interface LocalPdfFileReader {
  read(file: LocalPdfFile): Promise<LocalPdfReadResult>;
}

export interface LocalPdfReadSuccess {
  readonly ok: true;
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

export interface LocalPdfReadFailure {
  readonly ok: false;
  readonly error: PdfViewerError;
}

export type LocalPdfReadResult = LocalPdfReadSuccess | LocalPdfReadFailure;

export interface PdfViewerState {
  readonly status: ViewerStatus;
  readonly fileName?: string;
  readonly pageCount: number;
  readonly currentPageNumber: number;
  readonly currentPageSize?: PdfPageSize;
  readonly zoom: number;
  readonly error?: PdfViewerError;
}

export interface PdfViewerSnapshot {
  readonly state: PdfViewerState;
  readonly canGoPrevious: boolean;
  readonly canGoNext: boolean;
  readonly canZoomIn: boolean;
  readonly canZoomOut: boolean;
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 0.25;

const emptyState = (): PdfViewerState => ({
  status: "empty",
  pageCount: 0,
  currentPageNumber: 0,
  zoom: 1,
});

const clampZoom = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

const clearError = (state: PdfViewerState): PdfViewerState => {
  const { error: discardedError, ...stateWithoutError } = state;
  void discardedError;
  return stateWithoutError;
};

export const calculateFitWidthZoom = (
  pageWidth: number,
  availableWidth: number,
  maxZoom = MAX_ZOOM,
): number => {
  if (pageWidth <= 0 || availableWidth <= 0) {
    return 1;
  }

  return Math.min(maxZoom, Math.max(MIN_ZOOM, availableWidth / pageWidth));
};

export class PdfViewerApplication {
  readonly #fileReader: LocalPdfFileReader;
  readonly #pdfEngine: PdfEngine;
  #state: PdfViewerState = emptyState();
  #document: PdfDocumentHandle | undefined;
  #renderAbortController: AbortController | undefined;
  #renderSequence = 0;

  public constructor(fileReader: LocalPdfFileReader, pdfEngine: PdfEngine) {
    this.#fileReader = fileReader;
    this.#pdfEngine = pdfEngine;
  }

  public snapshot(): PdfViewerSnapshot {
    return {
      state: { ...this.#state },
      canGoPrevious: this.#state.status !== "empty" && this.#state.currentPageNumber > 1,
      canGoNext:
        this.#state.status !== "empty" &&
        this.#state.currentPageNumber > 0 &&
        this.#state.currentPageNumber < this.#state.pageCount,
      canZoomIn: this.#state.zoom < MAX_ZOOM,
      canZoomOut: this.#state.zoom > MIN_ZOOM,
    };
  }

  public async openFile(file: LocalPdfFile): Promise<PdfViewerSnapshot> {
    const previousState = this.#state;
    this.#state = {
      ...clearError(previousState),
      status: "loading",
    };

    const readResult = await this.#fileReader.read(file);
    if (!readResult.ok) {
      this.#state = this.#failureState(previousState, readResult.error);
      return this.snapshot();
    }

    const openResult = await this.#pdfEngine.open(readResult.bytes);
    if (!openResult.ok) {
      this.#state = this.#failureState(previousState, openResult.error);
      return this.snapshot();
    }

    const firstPage = openResult.document.metadata.pages[0];
    if (firstPage === undefined) {
      openResult.document.dispose();
      this.#state = this.#failureState(previousState, {
        code: "InvalidPdf",
        message: "This PDF does not contain a readable page.",
      });
      return this.snapshot();
    }

    const previousDocument = this.#document;
    this.cancelRender();
    this.#document = openResult.document;
    previousDocument?.dispose();

    this.#state = {
      status: "ready",
      fileName: readResult.fileName,
      pageCount: openResult.document.metadata.pageCount,
      currentPageNumber: 1,
      currentPageSize: firstPage,
      zoom: 1,
    };

    return this.snapshot();
  }

  public closeDocument(): PdfViewerSnapshot {
    this.cancelRender();
    this.#document?.dispose();
    this.#document = undefined;
    this.#state = emptyState();
    return this.snapshot();
  }

  public goToPage(pageNumber: number): PdfViewerSnapshot {
    const page = this.#document?.metadata.pages[pageNumber - 1];
    if (this.#document === undefined || pageNumber < 1 || pageNumber > this.#state.pageCount) {
      return this.snapshot();
    }

    if (page === undefined) {
      return this.snapshot();
    }

    this.cancelRender();
    this.#state = {
      ...clearError(this.#state),
      status: "ready",
      currentPageNumber: pageNumber,
      currentPageSize: page,
    };
    return this.snapshot();
  }

  public goPrevious(): PdfViewerSnapshot {
    return this.goToPage(this.#state.currentPageNumber - 1);
  }

  public goNext(): PdfViewerSnapshot {
    return this.goToPage(this.#state.currentPageNumber + 1);
  }

  public zoomIn(): PdfViewerSnapshot {
    this.#state = { ...this.#state, zoom: clampZoom(this.#state.zoom + ZOOM_STEP) };
    return this.snapshot();
  }

  public zoomOut(): PdfViewerSnapshot {
    this.#state = { ...this.#state, zoom: clampZoom(this.#state.zoom - ZOOM_STEP) };
    return this.snapshot();
  }

  public resetZoom(): PdfViewerSnapshot {
    this.#state = { ...this.#state, zoom: 1 };
    return this.snapshot();
  }

  public fitWidth(availableWidth: number): PdfViewerSnapshot {
    const pageWidth = this.#state.currentPageSize?.width;
    if (pageWidth !== undefined) {
      this.#state = { ...this.#state, zoom: calculateFitWidthZoom(pageWidth, availableWidth) };
    }
    return this.snapshot();
  }

  public async renderCurrentPage(canvas: HTMLCanvasElement): Promise<PdfViewerSnapshot> {
    if (this.#document === undefined || this.#state.currentPageNumber === 0) {
      this.#state = {
        ...this.#state,
        status: "error",
        error: {
          code: "SessionClosed",
          message: "No document is open.",
        },
      };
      return this.snapshot();
    }

    this.cancelRender();
    const renderId = ++this.#renderSequence;
    const controller = new AbortController();
    this.#renderAbortController = controller;
    this.#state = { ...clearError(this.#state), status: "rendering" };

    try {
      await this.#pdfEngine.renderPage(this.#document, {
        pageNumber: this.#state.currentPageNumber,
        scale: this.#state.zoom,
        canvas,
        signal: controller.signal,
      });

      if (renderId === this.#renderSequence && !controller.signal.aborted) {
        this.#state = { ...this.#state, status: "ready" };
      }
    } catch {
      if (controller.signal.aborted) {
        return this.snapshot();
      }

      this.#state = {
        ...this.#state,
        status: "error",
        error: {
          code: "RenderFailure",
          message: "This page could not be rendered. Try another page or reopen the document.",
        },
      };
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

  #failureState(previousState: PdfViewerState, error: PdfViewerError): PdfViewerState {
    if (this.#document !== undefined && previousState.status !== "empty") {
      return {
        ...previousState,
        status: "ready",
        error,
      };
    }

    return {
      status: "error",
      pageCount: 0,
      currentPageNumber: 0,
      zoom: 1,
      error,
    };
  }
}
