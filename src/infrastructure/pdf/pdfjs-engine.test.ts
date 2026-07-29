import { beforeEach, describe, expect, it, vi } from "vitest";

const pdfjs = vi.hoisted(() => {
  class InvalidPDFException extends Error {}
  class PasswordException extends Error {}
  class RenderingCancelledException extends Error {}

  return {
    getDocument: vi.fn(),
    GlobalWorkerOptions: { workerSrc: "" },
    InvalidPDFException,
    PasswordException,
    RenderingCancelledException,
  };
});

vi.mock("pdfjs-dist", () => pdfjs);
vi.mock("pdfjs-dist/build/pdf.worker.mjs?url", () => ({ default: "/pdf.worker.mjs" }));

import { PdfJsEngine } from "./pdfjs-engine";

const bytes = new Uint8Array([37, 80, 68, 70, 45]);

const page = (width: number, height: number) => ({
  getViewport: vi.fn(() => ({ width, height })),
  cleanup: vi.fn(),
});

describe("PdfJsEngine", () => {
  beforeEach(() => {
    pdfjs.getDocument.mockReset();
  });

  it("opens a PDF from bytes and returns page count and dimensions without exposing PDF.js types", async () => {
    const firstPage = page(200, 100);
    const document = {
      numPages: 1,
      getPage: vi.fn(() => Promise.resolve(firstPage)),
      cleanup: vi.fn(),
    };
    pdfjs.getDocument.mockReturnValue({ promise: Promise.resolve(document) });
    const engine = new PdfJsEngine();

    const result = await engine.open(bytes);

    expect(pdfjs.getDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        data: bytes,
        disableAutoFetch: true,
        disableFontFace: true,
        useWorkerFetch: false,
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      document: {
        metadata: {
          pageCount: 1,
          pages: [{ pageNumber: 1, width: 200, height: 100 }],
        },
      },
    });
    if (result.ok) {
      result.document.dispose();
    }
    expect(document.cleanup).toHaveBeenCalledOnce();
  });

  it("maps malformed PDF bytes to a stable application error", async () => {
    pdfjs.getDocument.mockReturnValue({
      promise: Promise.reject(new pdfjs.InvalidPDFException("Invalid PDF structure.")),
    });
    const engine = new PdfJsEngine();

    const result = await engine.open(bytes);

    expect(result).toMatchObject({ ok: false, error: { code: "InvalidPdf" } });
  });

  it("maps password-protected PDFs to a stable application error", async () => {
    pdfjs.getDocument.mockReturnValue({
      promise: Promise.reject(new pdfjs.PasswordException("Password required.")),
    });
    const engine = new PdfJsEngine();

    const result = await engine.open(bytes);

    expect(result).toMatchObject({ ok: false, error: { code: "EncryptedPdf" } });
  });
});
