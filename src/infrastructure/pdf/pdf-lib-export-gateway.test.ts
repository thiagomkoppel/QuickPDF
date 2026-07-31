import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import type { ExportElement } from "../../application/editor-application";
import { PdfLibExportGateway } from "./pdf-lib-export-gateway";

const createPdf = async (): Promise<Uint8Array> => {
  const document = await PDFDocument.create();
  document.addPage([300, 400]);
  document.addPage([500, 700]);
  return document.save();
};

const textElement = (id: string, pageId: string, text: string): ExportElement => ({
  id,
  pageId,
  type: "text",
  bounds: { x: 40, y: 50, width: 160, height: 40 },
  text,
  textAppearance: { fontSize: 16, color: "#111111" },
});

const whiteoutElement = (id: string, pageId: string): ExportElement => ({
  id,
  pageId,
  type: "whiteout",
  bounds: { x: 35, y: 45, width: 180, height: 50 },
});

describe("PdfLibExportGateway", () => {
  it("opens page metadata from browser PDF bytes", async () => {
    const gateway = new PdfLibExportGateway();

    const result = await gateway.open(await createPdf());

    expect(result).toEqual({
      ok: true,
      pages: [
        { id: "page-1", width: 300, height: 400, rotation: 0 },
        { id: "page-2", width: 500, height: 700, rotation: 0 },
      ],
    });
  });

  it("exports text and whiteout overlays while preserving page count and dimensions", async () => {
    const originalBytes = await createPdf();
    const gateway = new PdfLibExportGateway();

    const result = await gateway.exportPdf({
      originalBytes,
      pages: [
        { id: "page-1", width: 300, height: 400, rotation: 0 },
        { id: "page-2", width: 500, height: 700, rotation: 0 },
      ],
      elements: [
        whiteoutElement("whiteout-1", "page-1"),
        textElement("text-1", "page-1", "Replacement"),
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.bytes).not.toEqual(originalBytes);
    const exported = await PDFDocument.load(result.bytes);
    expect(exported.getPageCount()).toBe(2);
    expect(exported.getPage(0).getWidth()).toBe(300);
    expect(exported.getPage(0).getHeight()).toBe(400);
    expect(exported.getPage(1).getWidth()).toBe(500);
    expect(exported.getPage(1).getHeight()).toBe(700);
  });

  it("fails safely for invalid PDF bytes", async () => {
    const result = await new PdfLibExportGateway().exportPdf({
      originalBytes: new Uint8Array([1, 2, 3]),
      pages: [],
      elements: [],
    });

    expect(result).toMatchObject({ ok: false, error: { code: "ExportFailed" } });
  });
});

const transparentPngDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l5n7WQAAAABJRU5ErkJggg==";

const typedSignatureElement = (id: string, pageId: string): ExportElement => ({
  id,
  pageId,
  type: "signature",
  bounds: { x: 70, y: 250, width: 180, height: 70 },
  text: "Ada Lovelace",
  textAppearance: { fontSize: 34, color: "#111111", fontFamily: "serif" },
  source: "type",
});

const imageInitialsElement = (id: string, pageId: string): ExportElement => ({
  id,
  pageId,
  type: "initials",
  bounds: { x: 70, y: 170, width: 90, height: 45 },
  image: { dataUrl: transparentPngDataUrl, mimeType: "image/png" },
  source: "draw",
});

const generalImageElement = (id: string, pageId: string): ExportElement => ({
  id,
  pageId,
  type: "image",
  bounds: { x: 30, y: 60, width: 80, height: 40 },
  image: { dataUrl: transparentPngDataUrl, mimeType: "image/png" },
});
describe("PdfLibExportGateway signature overlays", () => {
  it("embeds general image overlays while preserving the PDF", async () => {
    const originalBytes = await createPdf();
    const gateway = new PdfLibExportGateway();

    const result = await gateway.exportPdf({
      originalBytes,
      pages: [{ id: "page-1", width: 300, height: 400, rotation: 0 }],
      elements: [generalImageElement("image-1", "page-1")],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.bytes.length).toBeGreaterThan(originalBytes.length);
    const exported = await PDFDocument.load(result.bytes);
    expect(exported.getPageCount()).toBe(2);
  });
  it("embeds typed signatures and image initials while preserving the PDF", async () => {
    const originalBytes = await createPdf();
    const gateway = new PdfLibExportGateway();

    const result = await gateway.exportPdf({
      originalBytes,
      pages: [{ id: "page-1", width: 300, height: 400, rotation: 0 }],
      elements: [
        typedSignatureElement("signature-1", "page-1"),
        imageInitialsElement("initials-1", "page-1"),
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.bytes.length).toBeGreaterThan(originalBytes.length);
    const exported = await PDFDocument.load(result.bytes);
    expect(exported.getPageCount()).toBe(2);
    expect(exported.getPage(0).getWidth()).toBe(300);
  });
});

describe("PdfLibExportGateway annotation overlays", () => {
  it("exports checkmark, cross, and captured date overlays without changing pages", async () => {
    const originalBytes = await createPdf();
    const gateway = new PdfLibExportGateway();

    const result = await gateway.exportPdf({
      originalBytes,
      pages: [{ id: "page-1", width: 300, height: 400, rotation: 0 }],
      elements: [
        {
          id: "checkmark-1",
          pageId: "page-1",
          type: "checkmark",
          bounds: { x: 40, y: 60, width: 32, height: 32 },
        },
        {
          id: "cross-1",
          pageId: "page-1",
          type: "cross",
          bounds: { x: 90, y: 60, width: 32, height: 32 },
        },
        {
          id: "date-1",
          pageId: "page-1",
          type: "date",
          bounds: { x: 130, y: 60, width: 96, height: 28 },
          text: "07/31/2026",
          textAppearance: { fontSize: 16, color: "#111111" },
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.bytes.length).toBeGreaterThan(originalBytes.length);
    const exported = await PDFDocument.load(result.bytes);
    expect(exported.getPageCount()).toBe(2);
    expect(exported.getPage(0).getWidth()).toBe(300);
    expect(exported.getPage(0).getHeight()).toBe(400);
  });
});
