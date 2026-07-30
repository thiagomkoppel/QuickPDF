import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DownloadAdapter,
  DownloadRequest,
  IdGenerator,
  LocalPdfFile,
  LocalPdfFileReader,
  LocalPdfReadResult,
  PdfExportGateway,
  PdfExportRequest,
  PdfExportResult,
  PdfOpenResult,
  PdfRenderDocumentGateway,
  PdfRenderDocumentResult,
} from "./editor-application";
import { PdfEditorApplication } from "./editor-application";

class TestIds implements IdGenerator {
  #next = 1;

  public nextId(prefix: string): string {
    const id = `${prefix}-${String(this.#next)}`;
    this.#next += 1;
    return id;
  }
}

const file: LocalPdfFile = {
  name: "contract.pdf",
  size: 5,
  type: "application/pdf",
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(5)),
};

describe("PdfEditorApplication export", () => {
  let readResult: LocalPdfReadResult;
  let openResult: PdfOpenResult;
  let exportResult: PdfExportResult;
  let reader: LocalPdfFileReader;
  let gateway: PdfExportGateway;
  let downloader: DownloadAdapter;
  let exportRequests: PdfExportRequest[];
  let downloadRequests: DownloadRequest[];
  let app: PdfEditorApplication;

  beforeEach(async () => {
    readResult = {
      ok: true,
      fileName: "contract.pdf",
      bytes: new Uint8Array([37, 80, 68, 70, 45]),
    };
    openResult = {
      ok: true,
      pages: [{ id: "page-1", width: 300, height: 400, rotation: 0 }],
    };
    exportResult = { ok: true, bytes: new Uint8Array([1, 2, 3]) };
    reader = { read: vi.fn(() => Promise.resolve(readResult)) };
    exportRequests = [];
    downloadRequests = [];
    gateway = {
      open: vi.fn(() => Promise.resolve(openResult)),
      exportPdf: (request) => {
        exportRequests.push(request);
        return Promise.resolve(exportResult);
      },
    };
    downloader = {
      download: (request) => {
        downloadRequests.push(request);
      },
    };
    app = new PdfEditorApplication(reader, gateway, downloader, new TestIds());
    await app.openFile(file);
  });

  it("exports from a copy of original bytes and keeps the editor session open", async () => {
    app.addWhiteout({ x: 40, y: 50, width: 120, height: 30 });
    app.addText({ x: 45, y: 55 }, "Replacement");

    const snapshot = await app.exportCurrentPdf();
    const exportRequest = exportRequests[0];
    expect(exportRequest).toBeDefined();
    if (exportRequest === undefined) {
      return;
    }

    expect(exportRequest.originalBytes).toEqual(new Uint8Array([37, 80, 68, 70, 45]));
    expect(exportRequest.originalBytes).not.toBe(readResult.ok ? readResult.bytes : undefined);
    expect(exportRequest.elements.map((element) => element.type)).toEqual(["whiteout", "text"]);
    const downloadRequest = downloadRequests[0];
    expect(downloadRequest).toBeDefined();
    if (downloadRequest === undefined) {
      return;
    }
    expect(downloadRequest).toMatchObject({
      filename: "contract-edited.pdf",
      mimeType: "application/pdf",
    });
    expect(snapshot.state.status).toBe("ready");
    expect(snapshot.state.isDirty).toBe(false);
    expect(snapshot.state.visibleElements).toHaveLength(2);
    expect(snapshot.canExport).toBe(true);
  });

  it("skips empty text while preserving stable whiteout-before-text ordering", async () => {
    const emptyTextId = app.addText({ x: 10, y: 10 }, "   ").state.selectedElementId;
    app.addWhiteout({ x: 10, y: 20, width: 90, height: 30 });
    app.addText({ x: 10, y: 25 }, "Visible");

    expect(emptyTextId).toBeDefined();
    await app.exportCurrentPdf();
    const exportRequest = exportRequests[0];
    expect(exportRequest).toBeDefined();
    if (exportRequest === undefined) {
      return;
    }

    expect(exportRequest.elements.map((element) => [element.type, element.text])).toEqual([
      ["whiteout", undefined],
      ["text", "Visible"],
    ]);
  });

  it("preserves dirty state and session when export fails", async () => {
    app.addText({ x: 45, y: 55 }, "Replacement");
    exportResult = { ok: false, error: { code: "ExportFailed", message: "Nope" } };

    const snapshot = await app.exportCurrentPdf();

    expect(snapshot.state.error).toMatchObject({ code: "ExportFailed" });
    expect(snapshot.state.status).toBe("ready");
    expect(snapshot.state.isDirty).toBe(true);
    expect(snapshot.state.visibleElements).toHaveLength(1);
    expect(downloadRequests).toEqual([]);
  });

  it("rejects export when no PDF is open", async () => {
    app = new PdfEditorApplication(reader, gateway, downloader, new TestIds());

    const snapshot = await app.exportCurrentPdf();

    expect(snapshot.state.error).toMatchObject({ code: "NoActiveDocument" });
    expect(exportRequests).toEqual([]);
  });
});

describe("PdfEditorApplication render document lifecycle", () => {
  it("opens a render document from copied bytes and exposes an opaque render id", async () => {
    const sourceBytes = new Uint8Array([37, 80, 68, 70, 45]);
    const renderBytes: Uint8Array[] = [];
    const renderGateway: PdfRenderDocumentGateway = {
      openRenderDocument: (bytes) => {
        renderBytes.push(bytes);
        return Promise.resolve({ ok: true, documentId: "render-1" });
      },
      disposeRenderDocument: vi.fn(),
    };
    const application = new PdfEditorApplication(
      { read: () => Promise.resolve({ ok: true, fileName: "visible.pdf", bytes: sourceBytes }) },
      {
        open: () =>
          Promise.resolve({
            ok: true,
            pages: [{ id: "page-1", width: 300, height: 400, rotation: 0 }],
          }),
        exportPdf: () => Promise.resolve({ ok: true, bytes: new Uint8Array([1]) }),
      },
      { download: vi.fn() },
      new TestIds(),
      renderGateway,
    );

    const snapshot = await application.openFile(file);

    expect(snapshot.state.renderDocumentId).toBe("render-1");
    expect(renderBytes[0]).toEqual(sourceBytes);
    expect(renderBytes[0]).not.toBe(sourceBytes);
  });

  it("disposes the active render document when the editor closes", async () => {
    const disposeRenderDocument = vi.fn();
    const application = new PdfEditorApplication(
      {
        read: () =>
          Promise.resolve({
            ok: true,
            fileName: "visible.pdf",
            bytes: new Uint8Array([37, 80, 68, 70, 45]),
          }),
      },
      {
        open: () =>
          Promise.resolve({
            ok: true,
            pages: [{ id: "page-1", width: 300, height: 400, rotation: 0 }],
          }),
        exportPdf: () => Promise.resolve({ ok: true, bytes: new Uint8Array([1]) }),
      },
      { download: vi.fn() },
      new TestIds(),
      {
        openRenderDocument: () => Promise.resolve({ ok: true, documentId: "render-1" }),
        disposeRenderDocument,
      },
    );

    await application.openFile(file);
    const snapshot = application.closeDocument();

    expect(disposeRenderDocument).toHaveBeenCalledWith("render-1");
    expect(snapshot.state.status).toBe("empty");
    expect(snapshot.state.renderDocumentId).toBeUndefined();
  });

  it("maps render document load failures to a recoverable editor error", async () => {
    const renderResult: PdfRenderDocumentResult = {
      ok: false,
      error: { code: "RenderFailed", message: "The PDF page renderer could not open this file." },
    };
    const application = new PdfEditorApplication(
      {
        read: () =>
          Promise.resolve({
            ok: true,
            fileName: "visible.pdf",
            bytes: new Uint8Array([37, 80, 68, 70, 45]),
          }),
      },
      {
        open: () =>
          Promise.resolve({
            ok: true,
            pages: [{ id: "page-1", width: 300, height: 400, rotation: 0 }],
          }),
        exportPdf: () => Promise.resolve({ ok: true, bytes: new Uint8Array([1]) }),
      },
      { download: vi.fn() },
      new TestIds(),
      {
        openRenderDocument: () => Promise.resolve(renderResult),
        disposeRenderDocument: vi.fn(),
      },
    );

    const snapshot = await application.openFile(file);

    expect(snapshot.state.status).toBe("error");
    expect(snapshot.state.error).toEqual(renderResult.error);
    expect(snapshot.canExport).toBe(false);
  });
});
