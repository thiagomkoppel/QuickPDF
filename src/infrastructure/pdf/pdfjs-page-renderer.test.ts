import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PdfJsPageRenderer } from "./pdfjs-page-renderer";

const pdfjsMock = vi.hoisted(() => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn(),
}));

vi.mock("pdfjs-dist", () => pdfjsMock);
vi.mock("pdfjs-dist/build/pdf.worker.mjs?url", () => ({ default: "pdf.worker.mjs" }));

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

const deferred = <T>(): Deferred<T> => {
  let resolvePromise: (value: T) => void = () => undefined;
  let rejectPromise: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
};

const clearRect = vi.fn();
const drawImage = vi.fn();

const context = {
  clearRect,
  drawImage,
} as Partial<CanvasRenderingContext2D> as CanvasRenderingContext2D;

const createCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "getContext", { value: vi.fn(() => context) });
  return canvas;
};

const createPdfDocument = (renderPromise: Promise<undefined> = Promise.resolve(undefined)) => {
  const renderTask = {
    promise: renderPromise,
    cancel: vi.fn(),
  };
  const page = {
    getViewport: vi.fn(({ scale }: { readonly scale: number }) => ({
      width: 300 * scale,
      height: 400 * scale,
    })),
    render: vi.fn(() => renderTask),
    cleanup: vi.fn(),
  };
  const document = {
    getPage: vi.fn(() => Promise.resolve(page)),
    cleanup: vi.fn(() => Promise.resolve(undefined)),
  };
  const task = {
    promise: Promise.resolve(document),
    destroy: vi.fn(() => Promise.resolve(undefined)),
  };
  return { task, document, page, renderTask };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PdfJsPageRenderer", () => {
  it("loads a render document without exposing PDF.js objects", async () => {
    const fixture = createPdfDocument();
    pdfjsMock.getDocument.mockReturnValueOnce(fixture.task);
    const renderer = new PdfJsPageRenderer();

    const result = await renderer.openRenderDocument(new Uint8Array([37, 80, 68, 70, 45]));

    expect(result).toEqual({ ok: true, documentId: "pdfjs-1" });
    expect(pdfjsMock.getDocument).toHaveBeenCalledWith(
      expect.objectContaining({ disableAutoFetch: true, disableStream: true }),
    );
    expect(fixture.document.getPage).toHaveBeenCalledWith(1);
    expect(fixture.page.cleanup).toHaveBeenCalledTimes(1);
  });

  it("does not expose a render document until its first page is available", async () => {
    const firstPage = deferred<ReturnType<typeof createPdfDocument>["page"]>();
    const fixture = createPdfDocument();
    fixture.document.getPage.mockReturnValueOnce(firstPage.promise);
    pdfjsMock.getDocument.mockReturnValueOnce(fixture.task);
    const renderer = new PdfJsPageRenderer();

    const opening = renderer.openRenderDocument(new Uint8Array([37, 80, 68, 70, 45]));
    await Promise.resolve();
    let settled = false;
    void opening.finally(() => {
      settled = true;
    });
    await Promise.resolve();

    expect(settled).toBe(false);
    firstPage.resolve(fixture.page);
    await expect(opening).resolves.toEqual({ ok: true, documentId: "pdfjs-1" });
  });

  it("renders a page to a real canvas with CSS dimensions and DPR backing dimensions", async () => {
    const fixture = createPdfDocument();
    pdfjsMock.getDocument.mockReturnValueOnce(fixture.task);
    const renderer = new PdfJsPageRenderer();
    const openResult = await renderer.openRenderDocument(new Uint8Array([37, 80, 68, 70, 45]));
    expect(openResult.ok).toBe(true);
    if (!openResult.ok) {
      return;
    }
    const canvas = createCanvas();

    const handle = renderer.startRenderPage({
      documentId: openResult.documentId,
      pageNumber: 1,
      scale: 1.5,
      devicePixelRatio: 2,
      canvas,
    });
    const result = await handle.promise;

    expect(result).toEqual({
      ok: true,
      cssWidth: 450,
      cssHeight: 600,
      backingWidth: 900,
      backingHeight: 1200,
    });
    expect(canvas.width).toBe(900);
    expect(canvas.height).toBe(1200);
    expect(canvas.style.width).toBe("450px");
    expect(canvas.style.height).toBe("600px");
    expect(fixture.document.getPage).toHaveBeenCalledWith(1);
    expect(fixture.page.render).toHaveBeenCalledWith(
      expect.objectContaining({
        canvasContext: context,
        transform: [2, 0, 0, 2, 0, 0],
      }),
    );
  });

  it("keeps the visible canvas intact until a staged render completes", async () => {
    const render = deferred<undefined>();
    const fixture = createPdfDocument(render.promise);
    pdfjsMock.getDocument.mockReturnValueOnce(fixture.task);
    const renderer = new PdfJsPageRenderer();
    const openResult = await renderer.openRenderDocument(new Uint8Array([37, 80, 68, 70, 45]));
    expect(openResult.ok).toBe(true);
    if (!openResult.ok) {
      return;
    }
    const canvas = createCanvas();
    canvas.width = 40;
    canvas.height = 50;
    canvas.style.width = "40px";
    canvas.style.height = "50px";

    const handle = renderer.startRenderPage({
      documentId: openResult.documentId,
      pageNumber: 1,
      scale: 1,
      devicePixelRatio: 1,
      canvas,
    });
    await Promise.resolve();

    expect(canvas.width).toBe(40);
    expect(canvas.height).toBe(50);
    expect(drawImage).not.toHaveBeenCalled();

    render.resolve(undefined);
    await expect(handle.promise).resolves.toMatchObject({
      ok: true,
      cssWidth: 300,
      cssHeight: 400,
    });
    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(400);
    expect(drawImage).toHaveBeenCalledTimes(1);
  });
  it("renders a page thumbnail at a bounded CSS size with DPR backing dimensions", async () => {
    const fixture = createPdfDocument();
    pdfjsMock.getDocument.mockReturnValueOnce(fixture.task);
    const renderer = new PdfJsPageRenderer();
    const openResult = await renderer.openRenderDocument(new Uint8Array([37, 80, 68, 70, 45]));
    expect(openResult.ok).toBe(true);
    if (!openResult.ok) {
      return;
    }
    const canvas = createCanvas();
    const result = await renderer.startRenderThumbnail({
      documentId: openResult.documentId,
      pageNumber: 1,
      maxWidth: 120,
      devicePixelRatio: 2,
      canvas,
    }).promise;
    expect(result).toMatchObject({
      ok: true,
      cssWidth: 120,
      cssHeight: 160,
      backingWidth: 240,
      backingHeight: 320,
    });
    expect(fixture.page.render).toHaveBeenCalledWith(
      expect.objectContaining({ canvas, transform: [2, 0, 0, 2, 0, 0] }),
    );
  });
  it("cancels a stale render task", async () => {
    const render = deferred<undefined>();
    const fixture = createPdfDocument(render.promise);
    pdfjsMock.getDocument.mockReturnValueOnce(fixture.task);
    const renderer = new PdfJsPageRenderer();
    const openResult = await renderer.openRenderDocument(new Uint8Array([37, 80, 68, 70, 45]));
    expect(openResult.ok).toBe(true);
    if (!openResult.ok) {
      return;
    }

    const handle = renderer.startRenderPage({
      documentId: openResult.documentId,
      pageNumber: 1,
      scale: 1,
      devicePixelRatio: 1,
      canvas: createCanvas(),
    });
    await Promise.resolve();
    handle.cancel();
    render.reject(Object.assign(new Error("cancelled"), { name: "RenderingCancelledException" }));

    await expect(handle.promise).resolves.toMatchObject({ ok: false, cancelled: true });
    expect(fixture.renderTask.cancel).toHaveBeenCalledTimes(1);
  });

  it("maps canvas preparation failure to a stable render error", async () => {
    const fixture = createPdfDocument();
    pdfjsMock.getDocument.mockReturnValueOnce(fixture.task);
    const renderer = new PdfJsPageRenderer();
    const openResult = await renderer.openRenderDocument(new Uint8Array([37, 80, 68, 70, 45]));
    expect(openResult.ok).toBe(true);
    if (!openResult.ok) {
      return;
    }
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValueOnce(null);
    const canvas = document.createElement("canvas");

    const result = await renderer.startRenderPage({
      documentId: openResult.documentId,
      pageNumber: 1,
      scale: 1,
      devicePixelRatio: 1,
      canvas,
    }).promise;

    expect(result).toMatchObject({ ok: false, cancelled: false, error: { code: "RenderFailed" } });
    expect(fixture.page.render).not.toHaveBeenCalled();
  });

  it("destroys PDF.js resources and clears canvases on cleanup", async () => {
    const fixture = createPdfDocument();
    pdfjsMock.getDocument.mockReturnValueOnce(fixture.task);
    const renderer = new PdfJsPageRenderer();
    const openResult = await renderer.openRenderDocument(new Uint8Array([37, 80, 68, 70, 45]));
    expect(openResult.ok).toBe(true);
    if (!openResult.ok) {
      return;
    }
    const canvas = createCanvas();
    canvas.width = 20;
    canvas.height = 30;

    renderer.disposeRenderDocument(openResult.documentId);
    renderer.clearCanvas(canvas);

    expect(fixture.document.cleanup).toHaveBeenCalledTimes(1);
    expect(fixture.task.destroy).toHaveBeenCalledTimes(1);
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    expect(canvas.style.width).toBe("0px");
  });
});
