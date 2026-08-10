import { pdfjs } from "./pdfjs-runtime";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";

import type {
  EditorError,
  PdfRenderDocumentGateway,
  PdfRenderDocumentResult,
} from "../../application/editor-application";

export interface PdfPageRenderRequest {
  readonly documentId: string;
  readonly pageNumber: number;
  readonly scale: number;
  readonly devicePixelRatio: number;
  readonly canvas: HTMLCanvasElement;
}

export interface PdfPageRenderSuccess {
  readonly ok: true;
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly backingWidth: number;
  readonly backingHeight: number;
}

export interface PdfPageRenderFailure {
  readonly ok: false;
  readonly cancelled: boolean;
  readonly error: EditorError;
}

export type PdfPageRenderResult = PdfPageRenderSuccess | PdfPageRenderFailure;

export interface PdfPageRenderHandle {
  readonly promise: Promise<PdfPageRenderResult>;
  cancel(): void;
}

export interface PdfPageThumbnailRequest {
  readonly documentId: string;
  readonly pageNumber: number;
  readonly maxWidth: number;
  readonly devicePixelRatio: number;
  readonly canvas: HTMLCanvasElement;
}

interface LoadedRenderDocument {
  readonly task: PDFDocumentLoadingTask;
  readonly document: PDFDocumentProxy;
}

const renderFailure = (message: string, cancelled = false): PdfPageRenderFailure => ({
  ok: false,
  cancelled,
  error: { code: "RenderFailed", message },
});

const logRenderDiagnostic = (context: string, error: unknown): void => {
  if (import.meta.env.DEV) {
    console.warn("NestlyPDF PDF render diagnostic", {
      context,
      name: error instanceof Error ? error.name : typeof error,
    });
  }
};

const clearCanvas = (canvas: HTMLCanvasElement): void => {
  const context = canvas.getContext("2d");
  context?.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = 0;
  canvas.height = 0;
  canvas.style.width = "0px";
  canvas.style.height = "0px";
};

const copyCompletedRender = (
  source: HTMLCanvasElement,
  target: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  backingWidth: number,
  backingHeight: number,
): boolean => {
  const targetContext = target.getContext("2d");
  if (targetContext === null) {
    return false;
  }
  target.width = backingWidth;
  target.height = backingHeight;
  target.style.width = `${String(cssWidth)}px`;
  target.style.height = `${String(cssHeight)}px`;
  targetContext.clearRect(0, 0, backingWidth, backingHeight);
  targetContext.drawImage(source, 0, 0);
  return true;
};

const isRenderCancelled = (state: { readonly cancelled: boolean }): boolean => state.cancelled;

const positiveScale = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 1);

const positivePixelRatio = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 1;

const isCancellation = (error: unknown): boolean =>
  error instanceof Error && /cancel/i.test(error.name);

export class PdfJsPageRenderer implements PdfRenderDocumentGateway {
  readonly #documents = new Map<string, LoadedRenderDocument>();
  #nextDocumentNumber = 1;

  public async openRenderDocument(bytes: Uint8Array): Promise<PdfRenderDocumentResult> {
    try {
      const task = pdfjs.getDocument({
        data: new Uint8Array(bytes),
        disableAutoFetch: true,
        disableStream: true,
      });
      const document = await task.promise;
      const documentId = `pdfjs-${String(this.#nextDocumentNumber)}`;
      this.#nextDocumentNumber += 1;
      this.#documents.set(documentId, { task, document });
      return { ok: true, documentId };
    } catch (error) {
      logRenderDiagnostic("open", error);
      return {
        ok: false,
        error: { code: "RenderFailed", message: "The PDF page renderer could not open this file." },
      };
    }
  }

  public disposeRenderDocument(documentId: string): void {
    const loaded = this.#documents.get(documentId);
    if (loaded === undefined) {
      return;
    }
    this.#documents.delete(documentId);
    void loaded.document.cleanup();
    void loaded.task.destroy();
  }

  public startRenderPage(request: PdfPageRenderRequest): PdfPageRenderHandle {
    const renderState = { cancelled: false };
    let renderTask: RenderTask | undefined;

    const promise = (async (): Promise<PdfPageRenderResult> => {
      const loaded = this.#documents.get(request.documentId);
      if (loaded === undefined) {
        clearCanvas(request.canvas);
        return renderFailure("The PDF page is no longer available.");
      }

      try {
        const page = await loaded.document.getPage(request.pageNumber);
        if (isRenderCancelled(renderState)) {
          page.cleanup();
          return renderFailure("The PDF page render was cancelled.", true);
        }

        const scale = positiveScale(request.scale);
        const pixelRatio = positivePixelRatio(request.devicePixelRatio);
        const viewport = page.getViewport({ scale });
        const cssWidth = viewport.width;
        const cssHeight = viewport.height;
        const backingWidth = Math.max(1, Math.floor(cssWidth * pixelRatio));
        const backingHeight = Math.max(1, Math.floor(cssHeight * pixelRatio));
        const renderCanvas = document.createElement("canvas");
        const context = renderCanvas.getContext("2d");
        if (context === null) {
          page.cleanup();
          return renderFailure("The browser could not prepare a PDF canvas.");
        }

        renderCanvas.width = backingWidth;
        renderCanvas.height = backingHeight;
        context.clearRect(0, 0, backingWidth, backingHeight);
        renderTask = page.render({
          canvas: renderCanvas,
          canvasContext: context,
          viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });
        await renderTask.promise;
        page.cleanup();
        if (isRenderCancelled(renderState)) {
          return renderFailure("The PDF page render was cancelled.", true);
        }
        if (
          !copyCompletedRender(
            renderCanvas,
            request.canvas,
            cssWidth,
            cssHeight,
            backingWidth,
            backingHeight,
          )
        ) {
          return renderFailure("The browser could not display the rendered PDF page.");
        }
        return { ok: true, cssWidth, cssHeight, backingWidth, backingHeight };
      } catch (error) {
        if (renderState.cancelled || isCancellation(error)) {
          return renderFailure("The PDF page render was cancelled.", true);
        }
        logRenderDiagnostic("render", error);
        clearCanvas(request.canvas);
        return renderFailure("The PDF page could not be rendered.");
      }
    })();

    return {
      promise,
      cancel: () => {
        renderState.cancelled = true;
        renderTask?.cancel();
      },
    };
  }

  /** Renders a compact page preview using the same document lifecycle as the main canvas. */
  public startRenderThumbnail(request: PdfPageThumbnailRequest): PdfPageRenderHandle {
    const renderState = { cancelled: false };
    let renderTask: RenderTask | undefined;
    const promise = (async (): Promise<PdfPageRenderResult> => {
      const loaded = this.#documents.get(request.documentId);
      if (loaded === undefined) {
        clearCanvas(request.canvas);
        return renderFailure("The PDF thumbnail is no longer available.");
      }
      try {
        const page = await loaded.document.getPage(request.pageNumber);
        if (isRenderCancelled(renderState)) {
          page.cleanup();
          return renderFailure("The PDF thumbnail render was cancelled.", true);
        }
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = positiveScale(request.maxWidth / baseViewport.width);
        const viewport = page.getViewport({ scale });
        const pixelRatio = positivePixelRatio(request.devicePixelRatio);
        const context = request.canvas.getContext("2d");
        if (context === null) {
          page.cleanup();
          return renderFailure("The browser could not prepare a PDF thumbnail.");
        }
        const backingWidth = Math.max(1, Math.floor(viewport.width * pixelRatio));
        const backingHeight = Math.max(1, Math.floor(viewport.height * pixelRatio));
        request.canvas.width = backingWidth;
        request.canvas.height = backingHeight;
        request.canvas.style.width = `${String(viewport.width)}px`;
        request.canvas.style.height = `${String(viewport.height)}px`;
        context.clearRect(0, 0, backingWidth, backingHeight);
        renderTask = page.render({
          canvas: request.canvas,
          canvasContext: context,
          viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });
        await renderTask.promise;
        page.cleanup();
        return {
          ok: true,
          cssWidth: viewport.width,
          cssHeight: viewport.height,
          backingWidth,
          backingHeight,
        };
      } catch (error) {
        if (renderState.cancelled || isCancellation(error)) {
          return renderFailure("The PDF thumbnail render was cancelled.", true);
        }
        logRenderDiagnostic("thumbnail", error);
        clearCanvas(request.canvas);
        return renderFailure("The PDF thumbnail could not be rendered.");
      }
    })();
    return {
      promise,
      cancel: () => {
        renderState.cancelled = true;
        renderTask?.cancel();
      },
    };
  }
  public clearCanvas(canvas: HTMLCanvasElement): void {
    clearCanvas(canvas);
  }
}
