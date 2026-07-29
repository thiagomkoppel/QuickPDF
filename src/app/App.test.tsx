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
          metadata: { pageCount: 1, pages: [{ pageNumber: 1, width: 300, height: 400 }] },
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

const testFile = (bytes: Uint8Array, name: string): File => {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const file = new File([buffer], name, { type: "application/pdf" });
  Object.defineProperty(file, "arrayBuffer", { value: () => Promise.resolve(buffer.slice(0)) });
  return file;
};

const pdfFile = (name = "sample.pdf") => testFile(new Uint8Array([37, 80, 68, 70, 45]), name);

beforeEach(() => {
  renderPage.mockClear();
  dispose.mockClear();
});

describe("QuickPDF application shell", () => {
  it("opens a selected local PDF and shows editing tools", async () => {
    const user = userEvent.setup();
    renderAt("/");

    await user.upload(screen.getByLabelText(/open a local pdf/i), pdfFile());

    expect(
      await screen.findByRole("heading", { level: 1, name: "sample.pdf" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Text" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/whiteout only covers content visually/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(renderPage).toHaveBeenCalled();
    });
  });

  it("creates and edits text without using document shortcuts while typing", async () => {
    const user = userEvent.setup();
    renderAt("/");
    await user.upload(screen.getByLabelText(/open a local pdf/i), pdfFile());
    await screen.findByRole("heading", { name: "sample.pdf" });

    await user.click(screen.getByRole("button", { name: "Text" }));
    fireEvent.pointerDown(screen.getByLabelText("PDF overlay"), { clientX: 60, clientY: 80 });

    const textBox = await screen.findByLabelText("Edit text element");
    await user.clear(textBox);
    await user.type(textBox, "Hello PDF{Backspace}");

    expect(textBox).toHaveValue("Hello PD");
    expect(screen.getByText("Unsaved temporary edits")).toBeInTheDocument();
  });

  it("creates whiteout, duplicates, deletes, and warns before dirty close", async () => {
    const user = userEvent.setup();
    renderAt("/");
    await user.upload(screen.getByLabelText(/open a local pdf/i), pdfFile());
    await screen.findByRole("heading", { name: "sample.pdf" });

    await user.click(screen.getByRole("button", { name: "Whiteout" }));
    fireEvent.pointerDown(screen.getByLabelText("PDF overlay"), { clientX: 80, clientY: 90 });
    expect(await screen.findByLabelText(/whiteout element selected/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(screen.getAllByRole("group", { name: /whiteout element/i })).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getAllByRole("group", { name: /whiteout element/i })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Close document" }));
    expect(screen.getByRole("dialog", { name: "Discard unsaved edits?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("group", { name: /whiteout element/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close document" }));
    await user.click(screen.getByRole("button", { name: "Discard edits" }));
    expect(screen.getByRole("heading", { name: "QuickPDF" })).toBeInTheDocument();
  });

  it("warns before returning home and cancel preserves dirty edits", async () => {
    const user = userEvent.setup();
    renderAt("/");
    await user.upload(screen.getByLabelText(/open a local pdf/i), pdfFile());
    await screen.findByRole("heading", { name: "sample.pdf" });
    await user.click(screen.getByRole("button", { name: "Text" }));
    fireEvent.pointerDown(screen.getByLabelText("PDF overlay"), { clientX: 60, clientY: 80 });
    await screen.findByLabelText("Edit text element");

    await user.click(screen.getByRole("link", { name: "QuickPDF home" }));
    expect(screen.getByRole("dialog", { name: "Discard unsaved edits?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByLabelText("Edit text element")).toBeInTheDocument();
  });

  it("handles modified wheel zoom while ordinary wheel scroll remains unhandled", async () => {
    const user = userEvent.setup();
    renderAt("/");
    await user.upload(screen.getByLabelText(/open a local pdf/i), pdfFile());
    await screen.findByRole("heading", { name: "sample.pdf" });

    const workspace = screen.getByLabelText("PDF workspace");
    const ordinaryWheel = fireEvent.wheel(workspace, { deltaY: -100 });
    expect(ordinaryWheel).toBe(true);
    expect(screen.getByRole("button", { name: "100%" })).toBeInTheDocument();

    const modifiedWheel = fireEvent.wheel(workspace, { deltaY: -100, ctrlKey: true });
    expect(modifiedWheel).toBe(true);
    expect(screen.getByRole("button", { name: "125%" })).toBeInTheDocument();
    expect(screen.getByText("No unsaved edits")).toBeInTheDocument();
  });

  it("renders a not-found page for unknown routes", () => {
    renderAt("/missing-route");

    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
  });
});
