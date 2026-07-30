import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
const open = vi.fn(() =>
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

    expect(screen.getByRole("heading", { level: 1, name: "QuickPDF" })).toBeInTheDocument();
    expect(screen.getByText("Fill, sign, fix, and download a PDF in minutes.")).toBeInTheDocument();
    expect(
      screen.getByText("Your PDF is processed in your browser and is not uploaded to us."),
    ).toBeInTheDocument();
  });

  it("opens a local PDF, renders the current page, adds overlays, downloads, and keeps the editor open", async () => {
    const user = userEvent.setup();
    renderAt("/");

    await user.upload(screen.getByLabelText(/open a local pdf/i), pdfFile());
    expect(await screen.findByRole("heading", { name: "contract.pdf" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Rendered PDF page")).toBeInTheDocument();
    await waitFor(() => {
      expect(startRenderPage).toHaveBeenCalledWith(
        expect.objectContaining({ documentId: "render-1", pageNumber: 1, scale: 1 }),
      );
    });

    await user.click(screen.getByRole("button", { name: "Whiteout" }));
    clickOverlay(screen.getByLabelText("PDF overlay"), 40, 50);
    const whiteout = await screen.findByRole("group", { name: "whiteout element" });
    expect(whiteout).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Text" }));
    clickOverlay(whiteout, 45, 55);
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

    await user.upload(screen.getByLabelText(/open a local pdf/i), pdfFile());
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
