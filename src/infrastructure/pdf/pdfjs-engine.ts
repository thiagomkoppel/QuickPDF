import {
  getDocument,
  GlobalWorkerOptions,
  InvalidPDFException,
  PasswordException,
  RenderingCancelledException,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

import type {
  EditorError,
  PdfDocumentHandle,
  PdfEngine,
  PdfOpenResult,
  PdfRenderRequest,
} from "../../application/editor-application";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

class PdfJsDocumentHandle implements PdfDocumentHandle {
  public readonly metadata: PdfDocumentHandle["metadata"];
  readonly #document: PDFDocumentProxy;

  public constructor(document: PDFDocumentProxy, metadata: PdfDocumentHandle["metadata"]) {
    this.#document = document;
    this.metadata = metadata;
  }

  public get document(): PDFDocumentProxy {
    return this.#document;
  }

  public dispose(): void {
    void this.#document.cleanup();
  }
}

const openError = (code: EditorError["code"], message: string): PdfOpenResult => ({
  ok: false,
  error: { code, message },
});

const mapOpenError = (error: unknown): PdfOpenResult => {
  if (error instanceof PasswordException) {
    return openError(
      "EncryptedPdf",
      "This PDF is encrypted or password protected. Password entry is not supported yet.",
    );
  }

  if (
    error instanceof InvalidPDFException ||
    (error instanceof Error && error.message.toLowerCase().includes("invalid pdf"))
  ) {
    return openError("InvalidPdf", "This file could not be opened as a valid PDF.");
  }

  return openError("OpenFailed", "This PDF could not be opened in the browser.");
};

export class PdfJsEngine implements PdfEngine {
  public async open(bytes: Uint8Array): Promise<PdfOpenResult> {
    try {
      const loadingTask = getDocument({
        data: bytes.slice(),
        disableAutoFetch: true,
        disableFontFace: true,
        useWorkerFetch: false,
      });
      const document = await loadingTask.promise;
      const pages = [];

      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        pages.push({ pageNumber, width: viewport.width, height: viewport.height });
        page.cleanup();
      }

      return {
        ok: true,
        document: new PdfJsDocumentHandle(document, {
          pageCount: document.numPages,
          pages,
        }),
      };
    } catch (error) {
      return mapOpenError(error);
    }
  }

  public async renderPage(document: PdfDocumentHandle, request: PdfRenderRequest): Promise<void> {
    if (!(document instanceof PdfJsDocumentHandle)) {
      throw new Error("PdfJsEngine can render only documents created by PdfJsEngine.");
    }

    const page = await document.document.getPage(request.pageNumber);
    const viewport = page.getViewport({ scale: request.scale });
    const context = request.canvas.getContext("2d");

    if (context === null) {
      throw new Error("A 2D canvas context is required to render a PDF page.");
    }

    const outputScale = window.devicePixelRatio || 1;
    request.canvas.width = Math.ceil(viewport.width * outputScale);
    request.canvas.height = Math.ceil(viewport.height * outputScale);
    request.canvas.style.width = `${String(viewport.width)}px`;
    request.canvas.style.height = `${String(viewport.height)}px`;

    context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
    context.clearRect(0, 0, viewport.width, viewport.height);

    let renderTask: RenderTask | undefined;
    const abortRender = (): void => {
      renderTask?.cancel();
    };

    request.signal.addEventListener("abort", abortRender, { once: true });

    try {
      renderTask = page.render({ canvasContext: context, canvas: request.canvas, viewport });
      await renderTask.promise;
    } catch (error) {
      if (error instanceof RenderingCancelledException || request.signal.aborted) {
        return;
      }
      throw error;
    } finally {
      request.signal.removeEventListener("abort", abortRender);
      page.cleanup();
    }
  }
}
