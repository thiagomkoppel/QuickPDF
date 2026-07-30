import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { EditorSnapshot, PdfEditorApplication } from "../../application/editor-application";
import { EditorPage } from "./EditorPage";

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

const deferred = <T,>(): Deferred<T> => {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
};

const baseSnapshot = (overrides: Partial<EditorSnapshot["state"]> = {}): EditorSnapshot => ({
  canExport: true,
  state: {
    status: "ready",
    fileName: "visible.pdf",
    pageCount: 2,
    currentPageNumber: 1,
    currentPage: { id: "page-1", width: 300, height: 400, rotation: 0 },
    renderDocumentId: "render-1",
    tool: "select",
    isDirty: false,
    elements: [],
    visibleElements: [],
    ...overrides,
  },
});

const createEditor = (): PdfEditorApplication =>
  ({
    setTool: vi.fn((tool: "select" | "text" | "whiteout") => baseSnapshot({ tool })),
    addText: vi.fn(() => baseSnapshot()),
    addWhiteout: vi.fn(() => baseSnapshot()),
    updateText: vi.fn(() => baseSnapshot()),
    exportCurrentPdf: vi.fn(() => Promise.resolve(baseSnapshot())),
  }) as unknown as PdfEditorApplication;

const createRenderer = () => ({
  startRenderPage: vi.fn(() => ({
    promise: Promise.resolve({
      ok: true as const,
      cssWidth: 300,
      cssHeight: 400,
      backingWidth: 300,
      backingHeight: 400,
    }),
    cancel: vi.fn(),
  })),
  clearCanvas: vi.fn(),
});

const getEditorViewport = (): HTMLElement => {
  const editorViewport = document.querySelector(".editor-viewer");
  expect(editorViewport).toBeInstanceOf(HTMLElement);
  return editorViewport as HTMLElement;
};

describe("EditorPage PDF rendering", () => {
  it("renders the active PDF page into a canvas and removes the placeholder path", async () => {
    const renderer = createRenderer();
    const { container } = render(
      <EditorPage
        editor={createEditor()}
        snapshot={baseSnapshot()}
        onSnapshotChange={vi.fn()}
        pdfRenderer={renderer}
      />,
    );

    expect(screen.getByLabelText("Rendered PDF page")).toBeInTheDocument();
    await waitFor(() => {
      expect(renderer.startRenderPage).toHaveBeenCalledWith(
        expect.objectContaining({ documentId: "render-1", pageNumber: 1, scale: 1 }),
      );
    });
    expect(container.querySelector(".pdf-page-placeholder")).toBeNull();
  });

  it("shows loading while rendering and a recoverable error when rendering fails", async () => {
    const pending = deferred<{
      readonly ok: false;
      readonly cancelled: false;
      readonly error: { readonly code: "RenderFailed"; readonly message: string };
    }>();
    const renderer = {
      startRenderPage: vi.fn(() => ({ promise: pending.promise, cancel: vi.fn() })),
      clearCanvas: vi.fn(),
    };
    render(
      <EditorPage
        editor={createEditor()}
        snapshot={baseSnapshot()}
        onSnapshotChange={vi.fn()}
        pdfRenderer={renderer}
      />,
    );

    expect(screen.getByText("Rendering PDF page...")).toBeInTheDocument();
    pending.resolve({
      ok: false,
      cancelled: false,
      error: { code: "RenderFailed", message: "The PDF page could not be rendered." },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The PDF page could not be rendered.",
    );
  });

  it("cancels stale renders and rerenders when the page changes", async () => {
    const firstCancel = vi.fn();
    const renderer = {
      startRenderPage: vi
        .fn()
        .mockReturnValueOnce({
          promise: Promise.resolve({
            ok: true as const,
            cssWidth: 300,
            cssHeight: 400,
            backingWidth: 300,
            backingHeight: 400,
          }),
          cancel: firstCancel,
        })
        .mockReturnValueOnce({
          promise: Promise.resolve({
            ok: true as const,
            cssWidth: 200,
            cssHeight: 300,
            backingWidth: 200,
            backingHeight: 300,
          }),
          cancel: vi.fn(),
        }),
      clearCanvas: vi.fn(),
    };
    const { rerender } = render(
      <EditorPage
        editor={createEditor()}
        snapshot={baseSnapshot()}
        onSnapshotChange={vi.fn()}
        pdfRenderer={renderer}
      />,
    );

    rerender(
      <EditorPage
        editor={createEditor()}
        snapshot={baseSnapshot({
          currentPageNumber: 2,
          currentPage: { id: "page-2", width: 200, height: 300, rotation: 0 },
          visibleElements: [],
        })}
        onSnapshotChange={vi.fn()}
        pdfRenderer={renderer}
      />,
    );

    expect(firstCancel).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(renderer.startRenderPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ pageNumber: 2 }),
      );
    });
  });

  it("rerenders on zoom and keeps overlay dimensions aligned to canvas CSS size", async () => {
    const user = userEvent.setup();
    const renderer = createRenderer();
    render(
      <EditorPage
        editor={createEditor()}
        snapshot={baseSnapshot({
          visibleElements: [
            {
              id: "element-1",
              pageId: "page-1",
              type: "whiteout",
              bounds: { x: 40, y: 50, width: 120, height: 48 },
            },
          ],
        })}
        onSnapshotChange={vi.fn()}
        pdfRenderer={renderer}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Zoom in" }));

    await waitFor(() => {
      expect(renderer.startRenderPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ scale: 1.25 }),
      );
    });
    const page = screen.getByLabelText("PDF page 1 of 2");
    const whiteout = screen.getByRole("group", { name: "whiteout element" });
    expect(page).toHaveStyle({ width: "375px", height: "500px" });
    expect(whiteout).toHaveStyle({ left: "50px", top: "62.5px", width: "150px", height: "60px" });
  });

  it("passes device pixel ratio to the renderer and clears the canvas on cleanup", async () => {
    const renderer = createRenderer();
    const originalDpr = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });

    const { unmount } = render(
      <EditorPage
        editor={createEditor()}
        snapshot={baseSnapshot()}
        onSnapshotChange={vi.fn()}
        pdfRenderer={renderer}
      />,
    );

    await waitFor(() => {
      expect(renderer.startRenderPage).toHaveBeenCalledWith(
        expect.objectContaining({ devicePixelRatio: 2 }),
      );
    });
    unmount();
    expect(renderer.clearCanvas).toHaveBeenCalled();
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: originalDpr });
  });

  it("uses a native non-passive editor viewport wheel listener for viewer-only modified-wheel zoom", async () => {
    const addEventListener = vi.spyOn(HTMLElement.prototype, "addEventListener");
    const renderer = createRenderer();
    render(
      <EditorPage
        editor={createEditor()}
        snapshot={baseSnapshot()}
        onSnapshotChange={vi.fn()}
        pdfRenderer={renderer}
      />,
    );

    const editorViewport = getEditorViewport();
    await waitFor(() => {
      expect(addEventListener).toHaveBeenCalledWith("wheel", expect.any(Function), {
        passive: false,
      });
    });
    const wheelListenerTargets = addEventListener.mock.calls
      .map((call, index) => ({ call, target: addEventListener.mock.contexts[index] }))
      .filter(({ call }) => call[0] === "wheel")
      .map(({ target }) => target);
    expect(wheelListenerTargets).toContain(editorViewport);
    expect(wheelListenerTargets).not.toContain(screen.getByLabelText("Rendered PDF page"));
    addEventListener.mockRestore();
  });

  it("prevents browser page zoom and rerenders the viewer when modified wheel starts on the stable viewport", async () => {
    const renderer = createRenderer();
    render(
      <EditorPage
        editor={createEditor()}
        snapshot={baseSnapshot()}
        onSnapshotChange={vi.fn()}
        pdfRenderer={renderer}
      />,
    );
    const editorViewport = getEditorViewport();

    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -100,
    });
    editorViewport.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(renderer.startRenderPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ scale: 1.25 }),
      );
    });
  });

  it("leaves ordinary wheel scrolling unchanged", () => {
    const renderer = createRenderer();
    render(
      <EditorPage
        editor={createEditor()}
        snapshot={baseSnapshot()}
        onSnapshotChange={vi.fn()}
        pdfRenderer={renderer}
      />,
    );
    const editorViewport = getEditorViewport();

    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 100,
    });
    editorViewport.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(renderer.startRenderPage).toHaveBeenCalledTimes(1);
  });

  it("prevents browser keyboard zoom shortcuts and changes only viewer zoom", async () => {
    const renderer = createRenderer();
    render(
      <EditorPage
        editor={createEditor()}
        snapshot={baseSnapshot()}
        onSnapshotChange={vi.fn()}
        pdfRenderer={renderer}
      />,
    );

    const zoomIn = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: "+",
    });
    window.dispatchEvent(zoomIn);

    expect(zoomIn.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(renderer.startRenderPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ scale: 1.25 }),
      );
    });

    const reset = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      metaKey: true,
      key: "0",
    });
    window.dispatchEvent(reset);

    expect(reset.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(renderer.startRenderPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ scale: 1 }),
      );
    });
  });
  it("contains repeated modified-wheel zoom-out gestures at the minimum boundary", async () => {
    const renderer = createRenderer();
    const onSnapshotChange = vi.fn();
    render(
      <EditorPage
        editor={createEditor()}
        snapshot={baseSnapshot({ isDirty: false })}
        onSnapshotChange={onSnapshotChange}
        pdfRenderer={renderer}
      />,
    );
    const editorViewport = getEditorViewport();

    act(() => {
      editorViewport.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, cancelable: true, ctrlKey: true, deltaY: 100 }),
      );
      editorViewport.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, cancelable: true, ctrlKey: true, deltaY: 100 }),
      );
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Zoom level")).toHaveTextContent("50%");
    });
    const boundaryEvents = [
      new WheelEvent("wheel", { bubbles: true, cancelable: true, ctrlKey: true, deltaY: 100 }),
      new WheelEvent("wheel", { bubbles: true, cancelable: true, metaKey: true, deltaY: 100 }),
      new WheelEvent("wheel", { bubbles: true, cancelable: true, ctrlKey: true, deltaY: 100 }),
    ];

    act(() => {
      boundaryEvents.forEach((event) => {
        editorViewport.dispatchEvent(event);
      });
    });

    expect(boundaryEvents.every((event) => event.defaultPrevented)).toBe(true);
    expect(screen.getByLabelText("Zoom level")).toHaveTextContent("50%");
    expect(renderer.startRenderPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ scale: 0.5 }),
    );
    expect(screen.getByText("No unsaved edits")).toBeInTheDocument();
    expect(onSnapshotChange).not.toHaveBeenCalled();
  });

  it("contains modified-wheel zoom-in gestures at the maximum boundary", async () => {
    const renderer = createRenderer();
    render(
      <EditorPage
        editor={createEditor()}
        snapshot={baseSnapshot()}
        onSnapshotChange={vi.fn()}
        pdfRenderer={renderer}
      />,
    );
    const editorViewport = getEditorViewport();

    act(() => {
      for (let index = 0; index < 8; index += 1) {
        editorViewport.dispatchEvent(
          new WheelEvent("wheel", { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -100 }),
        );
      }
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Zoom level")).toHaveTextContent("300%");
    });
    const boundaryEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -100,
    });

    act(() => {
      editorViewport.dispatchEvent(boundaryEvent);
    });

    expect(boundaryEvent.defaultPrevented).toBe(true);
    expect(screen.getByLabelText("Zoom level")).toHaveTextContent("300%");
    expect(renderer.startRenderPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ scale: 3 }),
    );
  });

  it("does not prevent ordinary wheel gestures at zoom boundaries", () => {
    const renderer = createRenderer();
    render(
      <EditorPage
        editor={createEditor()}
        snapshot={baseSnapshot()}
        onSnapshotChange={vi.fn()}
        pdfRenderer={renderer}
      />,
    );
    const editorViewport = getEditorViewport();

    act(() => {
      editorViewport.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, cancelable: true, ctrlKey: true, deltaY: 100 }),
      );
      editorViewport.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, cancelable: true, ctrlKey: true, deltaY: 100 }),
      );
    });
    const plainAtMin = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 100 });
    editorViewport.dispatchEvent(plainAtMin);
    expect(plainAtMin.defaultPrevented).toBe(false);

    act(() => {
      for (let index = 0; index < 10; index += 1) {
        editorViewport.dispatchEvent(
          new WheelEvent("wheel", { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -100 }),
        );
      }
    });
    const plainAtMax = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -100 });
    editorViewport.dispatchEvent(plainAtMax);
    expect(plainAtMax.defaultPrevented).toBe(false);
  });

  it("does not intercept browser zoom shortcuts when no editor document is open", () => {
    render(
      <EditorPage
        editor={createEditor()}
        snapshot={{
          canExport: false,
          state: {
            status: "empty",
            pageCount: 0,
            currentPageNumber: 0,
            tool: "select",
            isDirty: false,
            elements: [],
            visibleElements: [],
          },
        }}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );

    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: "+",
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});
