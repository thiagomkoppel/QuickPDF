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
import {
  MAX_TEXT_FONT_SIZE,
  MIN_TEXT_FONT_SIZE,
  PdfEditorApplication,
  validateSignatureImageFile,
} from "./editor-application";

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

  it("updates selected text font size, clamps it, marks dirty, and includes it in export", async () => {
    const added = app.addText({ x: 45, y: 55 }, "Sized text");
    const elementId = added.state.selectedElementId;
    expect(elementId).toBeDefined();
    if (elementId === undefined) {
      return;
    }

    const sized = app.updateTextFontSize(elementId, 24);
    expect(sized.state.isDirty).toBe(true);
    expect(sized.state.selectedElement?.textAppearance?.fontSize).toBe(24);

    await app.exportCurrentPdf();
    expect(exportRequests[0]?.elements[0]?.textAppearance?.fontSize).toBe(24);
  });

  it("clamps text font size updates to the supported range and rejects non-finite input", () => {
    const elementId = app.addText({ x: 45, y: 55 }, "Sized text").state.selectedElementId;
    expect(elementId).toBeDefined();
    if (elementId === undefined) {
      return;
    }

    expect(
      app.updateTextFontSize(elementId, 2).state.selectedElement?.textAppearance?.fontSize,
    ).toBe(MIN_TEXT_FONT_SIZE);
    expect(
      app.updateTextFontSize(elementId, 240).state.selectedElement?.textAppearance?.fontSize,
    ).toBe(MAX_TEXT_FONT_SIZE);
    const rejected = app.updateTextFontSize(elementId, Number.NaN);
    expect(rejected.state.error).toMatchObject({ code: "InvalidTextAppearance" });
  });

  it("preserves text font size when text content changes and when text is duplicated", () => {
    const elementId = app.addText({ x: 45, y: 55 }, "Sized text").state.selectedElementId;
    expect(elementId).toBeDefined();
    if (elementId === undefined) {
      return;
    }

    app.updateTextFontSize(elementId, 32);
    const edited = app.updateText(elementId, "Changed text");
    expect(edited.state.selectedElement?.textAppearance?.fontSize).toBe(32);
    const duplicated = app.duplicateElement(elementId);
    expect(duplicated.state.selectedElement?.textAppearance?.fontSize).toBe(32);
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

describe("PdfEditorApplication signature and initials overlays", () => {
  let exportRequests: PdfExportRequest[];
  let app: PdfEditorApplication;

  beforeEach(async () => {
    exportRequests = [];
    app = new PdfEditorApplication(
      {
        read: () =>
          Promise.resolve({
            ok: true,
            fileName: "sign.pdf",
            bytes: new Uint8Array([37, 80, 68, 70, 45]),
          }),
      },
      {
        open: () =>
          Promise.resolve({
            ok: true,
            pages: [{ id: "page-1", width: 300, height: 400, rotation: 0 }],
          }),
        exportPdf: (request) => {
          exportRequests.push(request);
          return Promise.resolve({ ok: true, bytes: new Uint8Array([1, 2, 3]) });
        },
      },
      { download: vi.fn() },
      new TestIds(),
    );
    await app.openFile(file);
  });

  it("adds drawn, typed, uploaded signature, and initials overlays to the export plan", async () => {
    const pngDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l5n7WQAAAABJRU5ErkJggg==";

    app.addDrawnSignature(
      { x: 20, y: 30 },
      { dataUrl: pngDataUrl, mimeType: "image/png", width: 200, height: 80, source: "draw" },
    );
    app.addTypedSignature({ x: 30, y: 40 }, { text: "Ada Lovelace", fontFamily: "serif" });
    app.addUploadedSignature(
      { x: 40, y: 50 },
      { dataUrl: pngDataUrl, mimeType: "image/png", width: 100, height: 50, source: "upload" },
    );
    app.addDrawnInitials(
      { x: 50, y: 60 },
      { dataUrl: pngDataUrl, mimeType: "image/png", width: 80, height: 40, source: "draw" },
    );
    const snapshot = app.addTypedInitials({ x: 60, y: 70 }, { text: "AL", fontFamily: "hand" });

    expect(snapshot.state.isDirty).toBe(true);
    expect(snapshot.state.visibleElements.map((element) => element.type)).toEqual([
      "signature",
      "signature",
      "signature",
      "initials",
      "initials",
    ]);
    await app.exportCurrentPdf();
    expect(
      exportRequests[0]?.elements.map((element) => [element.type, element.source, element.text]),
    ).toEqual([
      ["signature", "draw", undefined],
      ["signature", "type", "Ada Lovelace"],
      ["signature", "upload", undefined],
      ["initials", "draw", undefined],
      ["initials", "type", "AL"],
    ]);
  });

  it("moves, resizes, duplicates, selects, and deletes signature elements through the shared element lifecycle", () => {
    const added = app.addTypedSignature({ x: 20, y: 30 }, { text: "Ada", fontFamily: "cursive" });
    const elementId = added.state.selectedElementId;
    expect(elementId).toBeDefined();
    if (elementId === undefined) {
      return;
    }

    expect(app.selectElement(elementId).state.isDirty).toBe(true);
    const moved = app.moveElement(elementId, { x: 70, y: 80 });
    expect(moved.state.selectedElement?.bounds).toMatchObject({ x: 70, y: 80 });
    const resized = app.resizeElement(elementId, { width: 180, height: 60 });
    expect(resized.state.selectedElement?.bounds).toMatchObject({ width: 180, height: 60 });
    const duplicated = app.duplicateElement(elementId);
    expect(duplicated.state.visibleElements).toHaveLength(2);
    expect(duplicated.state.selectedElement?.bounds).toMatchObject({ x: 82, y: 92 });
    const deleted = app.deleteElement(elementId);
    expect(deleted.state.visibleElements).toHaveLength(1);
    expect(deleted.state.isDirty).toBe(true);
  });

  it("duplicates every supported overlay type through the shared element lifecycle", () => {
    const adders = [
      () => app.addText({ x: 10, y: 20 }, "Text"),
      () => app.addWhiteout({ x: 20, y: 30, width: 90, height: 40 }),
      () => app.addTypedSignature({ x: 30, y: 40 }, { text: "Ada", fontFamily: "cursive" }),
      () => app.addTypedInitials({ x: 40, y: 50 }, { text: "AL", fontFamily: "hand" }),
    ] as const;

    for (const add of adders) {
      const added = add();
      const elementId = added.state.selectedElementId;
      const selected = added.state.selectedElement;
      expect(elementId).toBeDefined();
      expect(selected).toBeDefined();
      if (elementId === undefined || selected === undefined) {
        return;
      }

      const duplicated = app.duplicateElement(elementId);

      expect(duplicated.state.isDirty).toBe(true);
      expect(duplicated.state.selectedElementId).not.toBe(elementId);
      expect(duplicated.state.selectedElement?.type).toBe(selected.type);
      expect(duplicated.state.selectedElement?.bounds).toMatchObject({
        x: selected.bounds.x + 12,
        y: selected.bounds.y + 12,
      });
    }
  });

  it("deletes every supported overlay type, clears selection, and excludes them from export", async () => {
    const addedIds = [
      app.addText({ x: 10, y: 20 }, "Text").state.selectedElementId,
      app.addWhiteout({ x: 20, y: 30, width: 90, height: 40 }).state.selectedElementId,
      app.addTypedSignature({ x: 30, y: 40 }, { text: "Ada", fontFamily: "cursive" }).state
        .selectedElementId,
      app.addTypedInitials({ x: 40, y: 50 }, { text: "AL", fontFamily: "hand" }).state
        .selectedElementId,
    ];

    for (const elementId of addedIds) {
      expect(elementId).toBeDefined();
      if (elementId === undefined) {
        return;
      }
      app.selectElement(elementId);
      const deleted = app.deleteElement(elementId);
      expect(deleted.state.isDirty).toBe(true);
      expect(deleted.state.selectedElementId).toBeUndefined();
      expect(deleted.state.selectedElement).toBeUndefined();
      expect(deleted.state.visibleElements.some((element) => element.id === elementId)).toBe(false);
    }

    await app.exportCurrentPdf();
    expect(exportRequests[0]?.elements).toEqual([]);
  });
  it("validates signature image uploads without reading or persisting content", () => {
    expect(
      validateSignatureImageFile({ name: "sig.png", size: 1000, type: "image/png" }),
    ).toBeUndefined();
    expect(
      validateSignatureImageFile({ name: "sig.gif", size: 1000, type: "image/gif" }),
    ).toMatchObject({ code: "UnsupportedSignatureImage" });
    expect(
      validateSignatureImageFile({ name: "sig.jpg", size: 3 * 1024 * 1024, type: "image/jpeg" }),
    ).toMatchObject({ code: "SignatureImageTooLarge" });
  });
});
