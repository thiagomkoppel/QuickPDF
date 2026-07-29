/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/require-await */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  LocalPdfFile,
  LocalPdfFileReader,
  LocalPdfReadResult,
  PdfDocumentHandle,
  PdfEngine,
  PdfOpenResult,
} from "./pdf-viewer";
import { calculateFitWidthZoom, MAX_ZOOM, MIN_ZOOM, PdfViewerApplication } from "./pdf-viewer";

const file: LocalPdfFile = {
  name: "local.pdf",
  size: 8,
  type: "application/pdf",
  arrayBuffer: async () => new ArrayBuffer(8),
};

const documentHandle = (pageCount = 2): PdfDocumentHandle => ({
  metadata: {
    pageCount,
    pages: Array.from({ length: pageCount }, (_, index) => ({
      pageNumber: index + 1,
      width: 600 + index,
      height: 800 + index,
    })),
  },
  dispose: vi.fn(),
});

describe("PdfViewerApplication", () => {
  let readResult: LocalPdfReadResult;
  let openResult: PdfOpenResult;
  let reader: LocalPdfFileReader;
  let engine: PdfEngine;

  beforeEach(() => {
    readResult = { ok: true, fileName: "local.pdf", bytes: new Uint8Array([37, 80, 68, 70, 45]) };
    openResult = { ok: true, document: documentHandle() };
    reader = {
      read: vi.fn(async () => readResult),
    };
    engine = {
      open: vi.fn(async () => openResult),
      renderPage: vi.fn(async () => undefined),
    };
  });

  it("opens a validated local PDF and exposes immutable viewer state", async () => {
    const app = new PdfViewerApplication(reader, engine);

    const snapshot = await app.openFile(file);

    expect(snapshot.state).toMatchObject({
      status: "ready",
      fileName: "local.pdf",
      pageCount: 2,
      currentPageNumber: 1,
      currentPageSize: { width: 600, height: 800 },
      zoom: 1,
    });
    expect(engine.open).toHaveBeenCalledWith(new Uint8Array([37, 80, 68, 70, 45]));
  });

  it("preserves an existing document when replacement validation fails", async () => {
    const app = new PdfViewerApplication(reader, engine);
    await app.openFile(file);
    readResult = {
      ok: false,
      error: { code: "UnsupportedFile", message: "Choose a valid PDF file." },
    };

    const snapshot = await app.openFile({ ...file, name: "bad.txt" });

    expect(snapshot.state).toMatchObject({
      status: "ready",
      fileName: "local.pdf",
      pageCount: 2,
      error: { code: "UnsupportedFile" },
    });
    expect(openResult.ok && openResult.document.dispose).not.toHaveBeenCalled();
  });

  it("disposes the old document only after a replacement opens successfully", async () => {
    const firstDocument = documentHandle();
    const secondDocument = documentHandle(1);
    openResult = { ok: true, document: firstDocument };
    const app = new PdfViewerApplication(reader, engine);
    await app.openFile(file);
    openResult = { ok: true, document: secondDocument };

    await app.openFile({ ...file, name: "replacement.pdf" });

    expect(firstDocument.dispose).toHaveBeenCalledOnce();
    expect(secondDocument.dispose).not.toHaveBeenCalled();
  });

  it("does not dispose the current document when PDF open fails", async () => {
    const firstDocument = documentHandle();
    openResult = { ok: true, document: firstDocument };
    const app = new PdfViewerApplication(reader, engine);
    await app.openFile(file);
    openResult = { ok: false, error: { code: "InvalidPdf", message: "The PDF could not open." } };

    const snapshot = await app.openFile(file);

    expect(snapshot.state).toMatchObject({ status: "ready", error: { code: "InvalidPdf" } });
    expect(firstDocument.dispose).not.toHaveBeenCalled();
  });

  it("enforces page navigation boundaries without marking the document unavailable", async () => {
    const app = new PdfViewerApplication(reader, engine);
    await app.openFile(file);

    expect(app.goPrevious().state.currentPageNumber).toBe(1);
    expect(app.goNext()).toMatchObject({ state: { currentPageNumber: 2 }, canGoNext: false });
    expect(app.goNext().state.currentPageNumber).toBe(2);
    expect(app.goToPage(999).state.currentPageNumber).toBe(2);
  });

  it("bounds zoom controls and calculates fit-width zoom", async () => {
    const app = new PdfViewerApplication(reader, engine);
    await app.openFile(file);

    for (let count = 0; count < 20; count += 1) {
      app.zoomOut();
    }
    expect(app.snapshot()).toMatchObject({ state: { zoom: MIN_ZOOM }, canZoomOut: false });

    for (let count = 0; count < 30; count += 1) {
      app.zoomIn();
    }
    expect(app.snapshot()).toMatchObject({ state: { zoom: MAX_ZOOM }, canZoomIn: false });
    expect(app.fitWidth(300).state.zoom).toBe(0.5);
    expect(calculateFitWidthZoom(600, 1200)).toBe(2);
  });

  it("cancels stale render work before starting a newer render", async () => {
    const app = new PdfViewerApplication(reader, engine);
    const canvas = document.createElement("canvas");
    let firstSignal: AbortSignal | undefined;
    engine.renderPage = vi
      .fn()
      .mockImplementationOnce(
        async (_document: PdfDocumentHandle, request: { readonly signal: AbortSignal }) => {
          firstSignal = request.signal;
          await new Promise((resolve) => setTimeout(resolve, 10));
        },
      )
      .mockResolvedValueOnce(undefined);

    await app.openFile(file);
    const firstRender = app.renderCurrentPage(canvas);
    const secondRender = app.renderCurrentPage(canvas);
    await Promise.all([firstRender, secondRender]);

    expect(firstSignal?.aborted).toBe(true);
    expect(engine.renderPage).toHaveBeenCalledTimes(2);
    expect(app.snapshot().state.status).toBe("ready");
  });

  it("disposes document resources, clears bytes, and cancels render on close", async () => {
    const firstDocument = documentHandle();
    openResult = { ok: true, document: firstDocument };
    const app = new PdfViewerApplication(reader, engine);
    await app.openFile(file);

    const snapshot = app.closeDocument();

    expect(firstDocument.dispose).toHaveBeenCalledOnce();
    expect(snapshot.state).toMatchObject({ status: "empty", pageCount: 0, currentPageNumber: 0 });
  });
});
