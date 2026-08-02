import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type {
  ExportElement,
  PdfExportGateway,
  PdfExportRequest,
  PdfExportResult,
  PdfOpenResult,
} from "../../application/editor-application";
import {
  pageTopLeftRectToPdfRect,
  pageTopLeftTextToPdfPoint,
} from "../../application/editor-geometry";
import type { DocumentPage } from "../../domain/document-session";

const exportFailure = (message: string): PdfExportResult => ({
  ok: false,
  error: { code: "ExportFailed", message },
});

const openFailure = (message: string): PdfOpenResult => ({
  ok: false,
  error: { code: "InvalidPdf", message },
});

const parseHexColor = (
  value: string | undefined,
): { readonly red: number; readonly green: number; readonly blue: number } => {
  const normalized = value?.match(/^#?([0-9a-fA-F]{6})$/)?.[1] ?? "000000";
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16) / 255,
    green: Number.parseInt(normalized.slice(2, 4), 16) / 255,
    blue: Number.parseInt(normalized.slice(4, 6), 16) / 255,
  };
};

const pageNumberFromPageId = (pageId: string): number | undefined => {
  const match = /^page-(\d+)$/.exec(pageId);
  if (match === null) {
    return undefined;
  }
  return Number.parseInt(match[1] ?? "", 10);
};

const lineHeight = (fontSize: number): number => fontSize * 1.2;

const dataUrlBytes = (dataUrl: string): Uint8Array => {
  const base64 = dataUrl.split(",")[1];
  if (base64 === undefined) {
    throw new Error("Invalid data URL.");
  }
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const fontForElement = (element: ExportElement, fallback: PDFFont, cursive: PDFFont): PDFFont =>
  element.type === "signature" || element.type === "initials" ? cursive : fallback;
const drawCheckmark = (
  page: PDFPage,
  rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  _hex = "#000000",
): void => {
  const thickness = Math.max(2, Math.min(rect.width, rect.height) * 0.12);
  const colorParts = parseHexColor(_hex);
  const color = rgb(colorParts.red, colorParts.green, colorParts.blue);
  page.drawLine({
    start: { x: rect.x + rect.width * 0.16, y: rect.y + rect.height * 0.46 },
    end: { x: rect.x + rect.width * 0.4, y: rect.y + rect.height * 0.2 },
    thickness,
    color,
  });
  page.drawLine({
    start: { x: rect.x + rect.width * 0.4, y: rect.y + rect.height * 0.2 },
    end: { x: rect.x + rect.width * 0.84, y: rect.y + rect.height * 0.82 },
    thickness,
    color,
  });
};

const drawCross = (
  page: PDFPage,
  rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  _hex = "#000000",
): void => {
  const thickness = Math.max(2, Math.min(rect.width, rect.height) * 0.12);
  const colorParts = parseHexColor(_hex);
  const color = rgb(colorParts.red, colorParts.green, colorParts.blue);
  page.drawLine({
    start: { x: rect.x + rect.width * 0.18, y: rect.y + rect.height * 0.18 },
    end: { x: rect.x + rect.width * 0.82, y: rect.y + rect.height * 0.82 },
    thickness,
    color,
  });
  page.drawLine({
    start: { x: rect.x + rect.width * 0.18, y: rect.y + rect.height * 0.82 },
    end: { x: rect.x + rect.width * 0.82, y: rect.y + rect.height * 0.18 },
    thickness,
    color,
  });
};

export class PdfLibExportGateway implements PdfExportGateway {
  public async open(bytes: Uint8Array): Promise<PdfOpenResult> {
    try {
      const document = await PDFDocument.load(bytes, { ignoreEncryption: false });
      const pages = document.getPages().map<DocumentPage>((page, index) => ({
        id: `page-${String(index + 1)}`,
        width: page.getWidth(),
        height: page.getHeight(),
        rotation: page.getRotation().angle,
      }));
      return { ok: true, pages };
    } catch {
      return openFailure("The PDF could not be opened in the browser.");
    }
  }

  public async exportPdf(request: PdfExportRequest): Promise<PdfExportResult> {
    try {
      const document = await PDFDocument.load(request.originalBytes, { ignoreEncryption: false });
      const font = await document.embedFont(StandardFonts.Helvetica);
      const signatureFont = await document.embedFont(StandardFonts.TimesRomanItalic);
      for (const element of request.elements) {
        await this.#drawElement(document, element, font, signatureFont);
      }
      const bytes = await document.save();
      return { ok: true, bytes };
    } catch {
      return exportFailure("The edited PDF could not be generated.");
    }
  }

  async #drawElement(
    document: PDFDocument,
    element: ExportElement,
    font: PDFFont,
    signatureFont: PDFFont,
  ): Promise<void> {
    const pageNumber = pageNumberFromPageId(element.pageId);
    if (pageNumber === undefined) {
      return;
    }
    const page = document.getPages()[pageNumber - 1];
    if (page === undefined) {
      return;
    }
    if (element.type === "whiteout") {
      const rect = pageTopLeftRectToPdfRect(element.bounds, {
        width: page.getWidth(),
        height: page.getHeight(),
      });
      page.drawRectangle({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        color: rgb(1, 1, 1),
        opacity: 1,
      });
      return;
    }

    if (element.type === "checkmark" || element.type === "cross") {
      const rect = pageTopLeftRectToPdfRect(element.bounds, {
        width: page.getWidth(),
        height: page.getHeight(),
      });
      if (element.type === "checkmark") {
        drawCheckmark(page, rect, element.color);
      } else {
        drawCross(page, rect, element.color);
      }
      return;
    }
    if (element.image !== undefined) {
      const imageBytes = dataUrlBytes(element.image.dataUrl);
      const embeddedImage =
        element.image.mimeType === "image/png"
          ? await document.embedPng(imageBytes)
          : await document.embedJpg(imageBytes);
      const rect = pageTopLeftRectToPdfRect(element.bounds, {
        width: page.getWidth(),
        height: page.getHeight(),
      });
      page.drawImage(embeddedImage, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      });
      return;
    }

    const text = element.text ?? "";
    if (text.trim().length === 0) {
      return;
    }
    const fontSize = element.textAppearance?.fontSize ?? 16;
    const colorParts = parseHexColor(element.textAppearance?.color);
    const activeFont = fontForElement(element, font, signatureFont);
    const start = pageTopLeftTextToPdfPoint({
      bounds: element.bounds,
      page: { width: page.getWidth(), height: page.getHeight() },
      fontSize,
    });
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      page.drawText(line, {
        x: start.x,
        y: start.y - lineHeight(fontSize) * index,
        size: fontSize,
        font: activeFont,
        color: rgb(colorParts.red, colorParts.green, colorParts.blue),
      });
    });
  }
}
