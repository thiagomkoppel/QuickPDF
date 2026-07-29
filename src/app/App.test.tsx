import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

const renderPage = vi.fn(() => Promise.resolve(undefined));
const dispose = vi.fn();

vi.mock("../infrastructure/pdf/pdfjs-engine", () => ({
  PdfJsEngine: class PdfJsEngine {
    public open = vi.fn(() =>
      Promise.resolve({
        ok: true,
        document: {
          metadata: {
            pageCount: 2,
            pages: [
              { pageNumber: 1, width: 600, height: 800 },
              { pageNumber: 2, width: 601, height: 801 },
            ],
          },
          dispose,
        },
      }),
    );

    public renderPage = renderPage;
  },
}));

const renderAt = (path: string) => {
  window.history.pushState({}, "", path);
  return render(<App />);
};

const testFile = (bytes: Uint8Array, name: string, type = "application/pdf"): File => {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const file = new File([buffer], name, { type });
  Object.defineProperty(file, "arrayBuffer", {
    value: () => Promise.resolve(buffer.slice(0)),
  });
  return file;
};

const pdfFile = () => testFile(new Uint8Array([37, 80, 68, 70, 45]), "sample.pdf");

beforeEach(() => {
  renderPage.mockClear();
  dispose.mockClear();
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

  it("opens a selected local PDF and navigates to the editor", async () => {
    const user = userEvent.setup();
    renderAt("/");

    await user.upload(screen.getByLabelText(/open a local pdf/i), pdfFile());

    expect(
      await screen.findByRole("heading", { level: 1, name: "sample.pdf" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("PDF page 1 of 2")).toBeInTheDocument();
  });

  it("supports drag-and-drop validation and rejects more than one file", () => {
    renderAt("/");
    const dropZone = screen.getByText("Open a local PDF").closest("label");

    expect(dropZone).not.toBeNull();
    if (dropZone === null) {
      return;
    }

    const first = pdfFile();
    const second = new File([new Uint8Array([37, 80, 68, 70, 45])], "two.pdf", {
      type: "application/pdf",
    });

    fireEvent.drop(dropZone, { dataTransfer: { files: [first, second] } });

    expect(screen.getByRole("alert")).toHaveTextContent("Choose one PDF file at a time.");
  });

  it("shows validation errors for invalid local files", async () => {
    const user = userEvent.setup();
    renderAt("/");

    await user.upload(
      screen.getByLabelText(/open a local pdf/i),
      testFile(new Uint8Array([110, 111, 116]), "bad.pdf"),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a valid PDF file.");
  });

  it("renders editor loading, navigation, zoom, and close controls", async () => {
    const user = userEvent.setup();
    renderAt("/");

    await user.upload(screen.getByLabelText(/open a local pdf/i), pdfFile());
    expect(
      await screen.findByRole("heading", { level: 1, name: "sample.pdf" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(renderPage).toHaveBeenCalled();
    });

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("PDF page 2 of 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByRole("button", { name: "125%" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close document" }));

    expect(dispose).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { level: 1, name: "QuickPDF" })).toBeInTheDocument();
  });

  it("keeps download disabled until export exists", async () => {
    const user = userEvent.setup();
    renderAt("/");

    await user.upload(screen.getByLabelText(/open a local pdf/i), pdfFile());

    expect(await screen.findByRole("button", { name: "Download" })).toBeDisabled();
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
