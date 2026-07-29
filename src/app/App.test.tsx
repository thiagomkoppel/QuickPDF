import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const numericStyleValue = (value: string): number => Number.parseFloat(value.replace("px", ""));

const expectFiniteOverlayGeometry = (element: HTMLElement): void => {
  expect(Number.isFinite(numericStyleValue(element.style.left))).toBe(true);
  expect(Number.isFinite(numericStyleValue(element.style.top))).toBe(true);
  expect(Number.isFinite(numericStyleValue(element.style.width))).toBe(true);
  expect(Number.isFinite(numericStyleValue(element.style.height))).toBe(true);
};

const dispatchPointerDown = (element: HTMLElement, clientX: number, clientY: number): void => {
  fireEvent(
    element,
    new MouseEvent("pointerdown", { bubbles: true, clientX, clientY, cancelable: true }),
  );
};

const dispatchNonFinitePointerDown = (element: HTMLElement): void => {
  const event = new Event("pointerdown", { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: Number.NaN },
    clientY: { value: 80 },
  });
  fireEvent(element, event);
};

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
    dispatchPointerDown(screen.getByLabelText("PDF overlay"), 60, 80);

    const textBox = await screen.findByLabelText("Edit text element");
    const textElement = screen.getByRole("group", { name: /text element selected/i });
    expectFiniteOverlayGeometry(textElement);

    await user.clear(textBox);
    await user.type(textBox, "Hello PDF{Backspace}");

    expect(textBox).toHaveValue("Hello PD");
    expect(screen.getByText("Unsaved temporary edits")).toBeInTheDocument();
  });

  it("ignores non-finite text placement before it can render invalid CSS coordinates", async () => {
    const user = userEvent.setup();
    renderAt("/");
    await user.upload(screen.getByLabelText(/open a local pdf/i), pdfFile());
    await screen.findByRole("heading", { name: "sample.pdf" });

    await user.click(screen.getByRole("button", { name: "Text" }));
    dispatchNonFinitePointerDown(screen.getByLabelText("PDF overlay"));

    expect(screen.queryByLabelText("Edit text element")).not.toBeInTheDocument();
    expect(screen.getByText("No unsaved edits")).toBeInTheDocument();
  });
  it("creates whiteout, duplicates, deletes, and warns before dirty close", async () => {
    const user = userEvent.setup();
    renderAt("/");
    await user.upload(screen.getByLabelText(/open a local pdf/i), pdfFile());
    await screen.findByRole("heading", { name: "sample.pdf" });

    await user.click(screen.getByRole("button", { name: "Whiteout" }));
    dispatchPointerDown(screen.getByLabelText("PDF overlay"), 80, 90);
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
    dispatchPointerDown(screen.getByLabelText("PDF overlay"), 60, 80);
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
    let ordinaryWheel = false;
    act(() => {
      ordinaryWheel = fireEvent.wheel(workspace, { deltaY: -100 });
    });
    expect(ordinaryWheel).toBe(true);
    expect(screen.getByRole("button", { name: "100%" })).toBeInTheDocument();

    let modifiedWheel = false;
    act(() => {
      modifiedWheel = fireEvent.wheel(workspace, { deltaY: -100, ctrlKey: true });
    });
    expect(modifiedWheel).toBe(true);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "125%" })).toBeInTheDocument();
    });
    expect(screen.getByText("No unsaved edits")).toBeInTheDocument();
  });

  it("renders a not-found page for unknown routes", () => {
    renderAt("/missing-route");

    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
  });
});
