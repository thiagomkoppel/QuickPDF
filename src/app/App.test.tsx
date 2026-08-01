import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PdfOpenResult } from "../application/editor-application";

import { App } from "./App";

const download = vi.fn();
const openRenderDocument = vi.fn(() =>
  Promise.resolve({ ok: true as const, documentId: "render-1" }),
);
const disposeRenderDocument = vi.fn();
const startRenderPage = vi.fn(() => ({
  promise: Promise.resolve({
    ok: true as const,
    cssWidth: 300,
    cssHeight: 400,
    backingWidth: 300,
    backingHeight: 400,
  }),
  cancel: vi.fn(),
}));
const clearCanvas = vi.fn();

type MockExportResult =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | {
      readonly ok: false;
      readonly error: { readonly code: "ExportFailed"; readonly message: string };
    };
const exportPdf = vi.fn((request: unknown): Promise<MockExportResult> => {
  void request;
  return Promise.resolve({ ok: true, bytes: new Uint8Array([1, 2, 3]) });
});
const open = vi.fn((): Promise<PdfOpenResult> =>
  Promise.resolve({
    ok: true,
    pages: [{ id: "page-1", width: 300, height: 400, rotation: 0 }],
  }),
);

vi.mock("../infrastructure/pdf/pdfjs-page-renderer", () => ({
  PdfJsPageRenderer: class PdfJsPageRenderer {
    public openRenderDocument = openRenderDocument;
    public disposeRenderDocument = disposeRenderDocument;
    public startRenderPage = startRenderPage;
    public clearCanvas = clearCanvas;
  },
}));

vi.mock("../infrastructure/browser/browser-download-adapter", () => ({
  BrowserDownloadAdapter: class BrowserDownloadAdapter {
    public download = download;
  },
}));

vi.mock("../infrastructure/pdf/pdf-lib-export-gateway", () => ({
  PdfLibExportGateway: class PdfLibExportGateway {
    public open = open;
    public exportPdf = exportPdf;
  },
}));

const renderAt = (path: string) => {
  window.history.pushState({}, "", path);
  return render(<App />);
};

const testFile = (bytes: Uint8Array, name: string): File => {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const file = new File([buffer], name, { type: "application/pdf" });
  Object.defineProperty(file, "arrayBuffer", { value: () => Promise.resolve(buffer.slice(0)) });
  return file;
};

const pdfFile = (name = "contract.pdf"): File =>
  testFile(new Uint8Array([37, 80, 68, 70, 45]), name);

const clickOverlay = (element: HTMLElement, clientX: number, clientY: number): void => {
  element.dispatchEvent(
    new MouseEvent("click", { bubbles: true, clientX, clientY, cancelable: true }),
  );
};
const pointerOverlay = (
  element: HTMLElement,
  type: string,
  clientX: number,
  clientY: number,
  pointerId: number,
): void => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: pointerId },
  });
  act(() => {
    element.dispatchEvent(event);
  });
};

const dragWhiteout = (overlay: HTMLElement): void => {
  Object.defineProperty(overlay, "setPointerCapture", { value: vi.fn(), configurable: true });
  Object.defineProperty(overlay, "hasPointerCapture", {
    value: vi.fn(() => false),
    configurable: true,
  });
  Object.defineProperty(overlay, "releasePointerCapture", { value: vi.fn(), configurable: true });
  pointerOverlay(overlay, "pointerdown", 40, 50, 10);
  pointerOverlay(overlay, "pointermove", 160, 98, 10);
  pointerOverlay(overlay, "pointerup", 160, 98, 10);
};

beforeEach(() => {
  download.mockClear();
  exportPdf.mockClear();
  open.mockClear();
  openRenderDocument.mockClear();
  disposeRenderDocument.mockClear();
  startRenderPage.mockClear();
  clearCanvas.mockClear();
});

describe("QuickPDF application shell", () => {
  it("renders the landing page with the product name, product statement, and accurate privacy promise", () => {
    renderAt("/");

    expect(screen.getByRole("img", { name: "QuickPDF" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Edit PDFs in seconds." }),
    ).toBeInTheDocument();
    expect(screen.getByText("Your files never leave your browser.")).toBeInTheDocument();
    expect(screen.getByText("Browser Only")).toBeInTheDocument();
    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByLabelText("Choose a PDF file")).toHaveAttribute(
      "accept",
      "application/pdf,.pdf",
    );
  });

  it("opens the accessible local picker from the complete drop zone", () => {
    renderAt("/");
    const input = screen.getByLabelText("Choose a PDF file");
    const openPicker = vi.fn();
    Object.defineProperty(input, "click", { configurable: true, value: openPicker });

    fireEvent.click(screen.getByRole("button", { name: "Open a PDF file" }));

    expect(openPicker).toHaveBeenCalledTimes(1);
  });
  it("keeps the release state stable across nested drag events", () => {
    renderAt("/");
    const dropZone = screen.getByRole("button", { name: "Open a PDF file" });
    const dataTransfer = { types: ["Files"], files: [] };

    fireEvent.dragEnter(dropZone, { dataTransfer });
    fireEvent.dragEnter(dropZone, { dataTransfer });
    expect(screen.getByText("Release to open your PDF")).toBeInTheDocument();

    fireEvent.dragLeave(dropZone, { dataTransfer });
    expect(screen.getByText("Release to open your PDF")).toBeInTheDocument();

    fireEvent.dragLeave(dropZone, { dataTransfer });
    expect(screen.getByText("Drop your PDF here")).toBeInTheDocument();
  });

  it("shows the browser-local opening stages while a file is opening", async () => {
    let resolveOpen: (result: PdfOpenResult) => void = () => {
      throw new Error("The PDF gateway did not begin opening.");
    };
    open.mockImplementationOnce(
      () =>
        new Promise<PdfOpenResult>((resolve) => {
          resolveOpen = resolve;
        }),
    );
    renderAt("/");

    fireEvent.change(screen.getByLabelText("Choose a PDF file"), {
      target: { files: [pdfFile()] },
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Opening document...");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 700));
    expect(screen.getByRole("status")).toHaveTextContent("Reading pages...");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 700));
    expect(screen.getByRole("status")).toHaveTextContent("Preparing workspace...");
    expect(screen.getByText("Processing locally in your browser")).toBeInTheDocument();

    act(() => {
      resolveOpen({ ok: true, pages: [{ id: "page-1", width: 300, height: 400, rotation: 0 }] });
    });
  });

  it("uses the same opening shell for a dropped PDF", async () => {
    let resolveOpen: (result: PdfOpenResult) => void = () => {
      throw new Error("The PDF gateway did not begin opening.");
    };
    open.mockImplementationOnce(
      () =>
        new Promise<PdfOpenResult>((resolve) => {
          resolveOpen = resolve;
        }),
    );
    renderAt("/");

    fireEvent.drop(screen.getByRole("button", { name: "Open a PDF file" }), {
      dataTransfer: { files: [pdfFile()], types: ["Files"] },
    });

    expect(await screen.findByRole("status")).toHaveTextContent("Opening document...");
    act(() => {
      resolveOpen({ ok: true, pages: [{ id: "page-1", width: 300, height: 400, rotation: 0 }] });
    });
  });
  it("returns to a retryable landing error after an invalid PDF", async () => {
    open.mockResolvedValueOnce({
      ok: false,
      error: { code: "InvalidPdf", message: "That file is not a valid PDF." },
    });
    renderAt("/");

    fireEvent.change(screen.getByLabelText("Choose a PDF file"), {
      target: { files: [pdfFile()] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("That file is not a valid PDF.");
    expect(screen.getByRole("button", { name: "Try another PDF" })).toBeInTheDocument();
  });

  it("uses the non-animated opening path when reduced motion is preferred", async () => {
    const originalMatchMedia = window.matchMedia.bind(window);
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    let resolveOpen: (result: PdfOpenResult) => void = () => {
      throw new Error("The PDF gateway did not begin opening.");
    };
    open.mockImplementationOnce(
      () =>
        new Promise<PdfOpenResult>((resolve) => {
          resolveOpen = resolve;
        }),
    );
    renderAt("/");

    fireEvent.change(screen.getByLabelText("Choose a PDF file"), {
      target: { files: [pdfFile()] },
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Opening document...");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 1600));
    expect(screen.getByRole("status")).toHaveTextContent("Opening document...");

    act(() => {
      resolveOpen({ ok: true, pages: [{ id: "page-1", width: 300, height: 400, rotation: 0 }] });
    });
    Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
  });
  it("opens a local PDF, renders the current page, adds overlays, downloads, and keeps the editor open", async () => {
    const user = userEvent.setup();
    renderAt("/");

    await user.upload(screen.getByLabelText("Choose a PDF file"), pdfFile());
    expect(await screen.findByRole("heading", { name: "contract.pdf" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Rendered PDF page")).toBeInTheDocument();
    await waitFor(() => {
      expect(startRenderPage).toHaveBeenCalledWith(
        expect.objectContaining({ documentId: "render-1", pageNumber: 1, scale: 1 }),
      );
    });

    await user.click(screen.getByRole("button", { name: "Whiteout" }));
    dragWhiteout(screen.getByLabelText("PDF overlay"));
    const whiteout = await screen.findByRole("group", { name: "whiteout element" });
    expect(whiteout).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Text" }));
    clickOverlay(screen.getByLabelText("PDF overlay"), 130, 110);
    const textBox = await screen.findByLabelText("Edit text element");
    await user.clear(textBox);
    await user.type(textBox, "Replacement");

    await user.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() => {
      expect(download).toHaveBeenCalledWith({
        bytes: new Uint8Array([1, 2, 3]),
        filename: "contract-edited.pdf",
        mimeType: "application/pdf",
      });
    });
    expect(screen.getByRole("heading", { name: "contract.pdf" })).toBeInTheDocument();
    expect(
      screen.getByText("Downloaded contract-edited.pdf. The editor remains open."),
    ).toBeInTheDocument();
    const exportRequest = exportPdf.mock.calls[0]?.[0] as {
      readonly elements: readonly { readonly type: string }[];
    };
    expect(exportRequest.elements.map((element) => element.type)).toEqual(["whiteout", "text"]);
  });

  it("keeps the editor open and dirty when export fails", async () => {
    exportPdf.mockResolvedValueOnce({
      ok: false,
      error: { code: "ExportFailed", message: "Nope" },
    });
    const user = userEvent.setup();
    renderAt("/");

    await user.upload(screen.getByLabelText("Choose a PDF file"), pdfFile());
    await screen.findByRole("heading", { name: "contract.pdf" });
    await user.click(screen.getByRole("button", { name: "Text" }));
    clickOverlay(screen.getByLabelText("PDF overlay"), 45, 55);
    await screen.findByLabelText("Edit text element");
    await user.click(screen.getByRole("button", { name: "Download" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nope");
    expect(screen.getByRole("heading", { name: "contract.pdf" })).toBeInTheDocument();
    expect(screen.getByText("Unsaved temporary edits")).toBeInTheDocument();
  });

  it("renders the editor route without a document as an open-first state", () => {
    renderAt("/editor");

    expect(screen.getByRole("heading", { level: 1, name: "Open a PDF first" })).toBeInTheDocument();
  });

  it("renders a not-found page for unknown routes", () => {
    renderAt("/missing-route");

    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to QuickPDF home" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("uses a semantic responsive shell structure", () => {
    renderAt("/");

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });
});
