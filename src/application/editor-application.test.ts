/* eslint-disable @typescript-eslint/unbound-method */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  IdGenerator,
  LocalPdfFile,
  LocalPdfFileReader,
  LocalPdfReadResult,
  PdfDocumentHandle,
  PdfEngine,
  PdfOpenResult,
} from "./editor-application";
import {
  MAX_ZOOM,
  MIN_ELEMENT_HEIGHT,
  MIN_ELEMENT_WIDTH,
  MIN_ZOOM,
  PdfEditorApplication,
} from "./editor-application";

const file: LocalPdfFile = {
  name: "sample.pdf",
  size: 5,
  type: "application/pdf",
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(5)),
};

const documentHandle = (pageCount = 2): PdfDocumentHandle => ({
  metadata: {
    pageCount,
    pages: Array.from({ length: pageCount }, (_unused, index) => ({
      pageNumber: index + 1,
      width: 600 + index,
      height: 800 + index,
    })),
  },
  dispose: vi.fn(),
});

class TestIds implements IdGenerator {
  #next = 1;

  public nextId(prefix: string): string {
    const id = `${prefix}-${String(this.#next)}`;
    this.#next += 1;
    return id;
  }
}

describe("PdfEditorApplication", () => {
  let readResult: LocalPdfReadResult;
  let openResult: PdfOpenResult;
  let reader: LocalPdfFileReader;
  let engine: PdfEngine;
  let app: PdfEditorApplication;

  beforeEach(async () => {
    readResult = { ok: true, fileName: "sample.pdf", bytes: new Uint8Array([37, 80, 68, 70, 45]) };
    openResult = { ok: true, document: documentHandle() };
    reader = { read: vi.fn(() => Promise.resolve(readResult)) };
    engine = {
      open: vi.fn(() => Promise.resolve(openResult)),
      renderPage: vi.fn(() => Promise.resolve(undefined)),
    };
    app = new PdfEditorApplication(reader, engine, new TestIds());
    await app.openFile(file);
  });

  it("opens a PDF into clean application state", () => {
    expect(app.snapshot().state).toMatchObject({
      status: "ready",
      fileName: "sample.pdf",
      pageCount: 2,
      currentPageNumber: 1,
      isDirty: false,
    });
  });

  it("adds text and whiteout elements on the current page and marks dirty", () => {
    const textSnapshot = app.addText({ x: 40, y: 50 }, "Hello");
    const text = textSnapshot.state.visibleElements[0];
    const whiteoutSnapshot = app.addWhiteout({ x: 20, y: 30, width: 100, height: 40 });

    expect(text).toMatchObject({ type: "text", text: "Hello", pageId: "page-1" });
    expect(whiteoutSnapshot.state.visibleElements).toHaveLength(2);
    expect(whiteoutSnapshot.state.visibleElements[1]).toMatchObject({ type: "whiteout" });
    expect(whiteoutSnapshot.state.isDirty).toBe(true);
  });

  it("edits, moves, resizes, duplicates, deletes, selects, and deselects elements through the application boundary", () => {
    const elementId = app.addText({ x: 40, y: 50 }, "Hello").state.selectedElementId;

    expect(elementId).toBeDefined();
    if (elementId === undefined) {
      return;
    }

    expect(app.updateText(elementId, "Updated").state.visibleElements[0]).toMatchObject({
      text: "Updated",
    });
    expect(
      app.moveElement(elementId, { x: 70, y: 90 }).state.visibleElements[0]?.bounds,
    ).toMatchObject({
      x: 70,
      y: 90,
    });
    expect(
      app.resizeElement(elementId, { width: 220, height: 55 }).state.visibleElements[0]?.bounds,
    ).toMatchObject({
      width: 220,
      height: 55,
    });

    const duplicateSnapshot = app.duplicateElement(elementId);
    expect(duplicateSnapshot.state.visibleElements).toHaveLength(2);
    app.selectElement(elementId);
    expect(app.clearSelection().state.selectedElementId).toBeUndefined();
    expect(app.deleteElement(elementId).state.visibleElements).toHaveLength(1);
  });

  it("keeps elements owned by their page and hides other page elements during navigation", () => {
    app.addText({ x: 40, y: 50 }, "Page 1");
    app.goNext();
    app.addText({ x: 40, y: 50 }, "Page 2");

    expect(app.snapshot().state.visibleElements).toHaveLength(1);
    expect(app.snapshot().state.visibleElements[0]).toMatchObject({ pageId: "page-2" });
    app.goPrevious();
    expect(app.snapshot().state.visibleElements[0]).toMatchObject({ pageId: "page-1" });
  });

  it("enforces minimum dimensions and keeps elements on the page", () => {
    const elementId = app.addWhiteout({ x: 590, y: 790, width: 1, height: 1 }).state
      .selectedElementId;

    expect(elementId).toBeDefined();
    if (elementId === undefined) {
      return;
    }

    expect(app.snapshot().state.visibleElements[0]?.bounds).toEqual({
      x: 584,
      y: 784,
      width: MIN_ELEMENT_WIDTH,
      height: MIN_ELEMENT_HEIGHT,
    });
  });

  it("does not mark dirty for selection, page navigation, or zoom", async () => {
    app = new PdfEditorApplication(reader, engine, new TestIds());
    await app.openFile(file);
    const cleanBefore = app.snapshot().state.isDirty;

    app.goNext();
    app.zoomIn();
    app.zoomOut();
    app.fitWidth(300);
    app.clearSelection();

    expect(cleanBefore).toBe(false);
    expect(app.snapshot().state.isDirty).toBe(false);
  });

  it("preserves previous state when an editing operation fails", () => {
    app.addText({ x: 40, y: 50 }, "Hello");
    const before = app.snapshot().state.visibleElements;

    const snapshot = app.updateText("missing", "Nope");

    expect(snapshot.state.error).toMatchObject({ code: "MissingElement" });
    expect(snapshot.state.visibleElements).toEqual(before);
  });

  it("warns before dirty close and cancel preserves edits", () => {
    app.addText({ x: 40, y: 50 }, "Hello");

    expect(app.requestClose().state.pendingDiscardAction).toBe("close");
    expect(app.cancelDiscard().state.visibleElements).toHaveLength(1);
  });

  it("confirms dirty discard and disposes document resources", async () => {
    const document = openResult.ok ? openResult.document : undefined;
    app.addText({ x: 40, y: 50 }, "Hello");
    app.requestClose();

    const snapshot = await app.confirmDiscard();

    expect(snapshot.state.status).toBe("empty");
    expect(document?.dispose).toHaveBeenCalledOnce();
  });

  it("preserves a dirty document when replacement is cancelled", async () => {
    app.addText({ x: 40, y: 50 }, "Hello");

    const requested = await app.openFile({ ...file, name: "replacement.pdf" });

    expect(requested.state.pendingDiscardAction).toBe("replace");
    expect(app.cancelDiscard().state.visibleElements).toHaveLength(1);
  });

  it("preserves a dirty document when confirmed replacement fails validation", async () => {
    app.addText({ x: 40, y: 50 }, "Hello");
    await app.openFile({ ...file, name: "replacement.pdf" });
    readResult = {
      ok: false,
      error: { code: "UnsupportedFile", message: "Only PDF files can be opened." },
    };

    const snapshot = await app.confirmDiscard();

    expect(snapshot.state.status).toBe("ready");
    expect(snapshot.state.visibleElements).toHaveLength(1);
    expect(snapshot.state.error).toMatchObject({ code: "UnsupportedFile" });
    expect(openResult.ok ? openResult.document.dispose : undefined).not.toHaveBeenCalled();
  });
  it("handles modified-wheel zoom without marking dirty", async () => {
    app = new PdfEditorApplication(reader, engine, new TestIds());
    await app.openFile(file);

    expect(app.handleWheelZoom({ deltaY: -100, ctrlKey: true, metaKey: false }).handled).toBe(true);
    expect(app.snapshot().state.zoom).toBe(1.25);
    expect(app.handleWheelZoom({ deltaY: 100, ctrlKey: false, metaKey: true }).handled).toBe(true);
    expect(app.handleWheelZoom({ deltaY: -100, ctrlKey: false, metaKey: false }).handled).toBe(
      false,
    );

    for (let count = 0; count < 40; count += 1) {
      app.handleWheelZoom({ deltaY: 100, ctrlKey: true, metaKey: false });
    }

    expect(app.snapshot().state.zoom).toBe(MIN_ZOOM);
    expect(app.snapshot().state.isDirty).toBe(false);

    for (let count = 0; count < 40; count += 1) {
      app.handleWheelZoom({ deltaY: -100, ctrlKey: true, metaKey: false });
    }

    expect(app.snapshot().state.zoom).toBe(MAX_ZOOM);
  });
});
