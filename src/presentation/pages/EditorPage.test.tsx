import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, type Mock } from "vitest";

import type {
  EditorSnapshot,
  EditorTool,
  ExportElement,
  PdfEditorApplication,
} from "../../application/editor-application";
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

interface TestEditor extends PdfEditorApplication {
  readonly setTool: Mock;
  readonly addText: Mock;
  readonly addWhiteout: Mock;
  readonly selectElement: Mock;
  readonly moveElement: Mock;
  readonly duplicateElement: Mock;
  readonly deleteElement: Mock;
  readonly updateText: Mock;
  readonly updateTextFontSize: Mock;
  readonly resizeElement: Mock;
  readonly addTypedSignature: Mock;
  readonly addTypedInitials: Mock;
  readonly addUploadedSignature: Mock;
  readonly addDrawnSignature: Mock;
}

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

const createEditor = (): TestEditor =>
  ({
    setTool: vi.fn((tool: EditorTool) => baseSnapshot({ tool })),
    addText: vi.fn(() => {
      const element: ExportElement = {
        id: "text-created",
        pageId: "page-1",
        type: "text",
        bounds: { x: 40, y: 50, width: 160, height: 48 },
        text: "Text",
        textAppearance: { fontSize: 16, color: "#111111" },
      };
      return baseSnapshot({
        selectedElementId: element.id,
        selectedElement: element,
        visibleElements: [element],
        isDirty: true,
      });
    }),
    addWhiteout: vi.fn(() => baseSnapshot()),
    addTypedSignature: vi.fn(() =>
      baseSnapshot({
        selectedElementId: "signature-1",
        selectedElement: {
          id: "signature-1",
          pageId: "page-1",
          type: "signature",
          bounds: { x: 56, y: 250, width: 220, height: 70 },
          text: "Ada Lovelace",
          textAppearance: { fontSize: 34, color: "#111111", fontFamily: "serif" },
          source: "type",
        },
        visibleElements: [
          {
            id: "signature-1",
            pageId: "page-1",
            type: "signature",
            bounds: { x: 56, y: 250, width: 220, height: 70 },
            text: "Ada Lovelace",
            textAppearance: { fontSize: 34, color: "#111111", fontFamily: "serif" },
            source: "type",
          },
        ],
        isDirty: true,
      }),
    ),
    addDrawnSignature: vi.fn(() => baseSnapshot()),
    addUploadedSignature: vi.fn(() => baseSnapshot()),
    addTypedInitials: vi.fn(() => baseSnapshot()),
    addDrawnInitials: vi.fn(() => baseSnapshot()),
    selectElement: vi.fn(() => baseSnapshot()),
    moveElement: vi.fn(() => baseSnapshot()),
    resizeElement: vi.fn(() => baseSnapshot()),
    duplicateElement: vi.fn(() => baseSnapshot()),
    deleteElement: vi.fn(() => baseSnapshot()),
    updateText: vi.fn(() => baseSnapshot()),
    updateTextFontSize: vi.fn(() => baseSnapshot()),
    exportCurrentPdf: vi.fn(() => Promise.resolve(baseSnapshot())),
  }) as unknown as TestEditor;

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

const selectedElementForType = (type: ExportElement["type"]): ExportElement => {
  const base = {
    id: `${type}-1`,
    pageId: "page-1",
    type,
    bounds: { x: 40, y: 50, width: 120, height: 48 },
  } as const;
  if (type === "text") {
    return {
      ...base,
      type,
      text: "Editable text",
      textAppearance: { fontSize: 16, color: "#111111" },
    };
  }
  if (type === "signature" || type === "initials") {
    return {
      ...base,
      type,
      text: type === "signature" ? "Ada Lovelace" : "AL",
      textAppearance: { fontSize: 30, color: "#111111", fontFamily: "cursive" },
      source: "type",
    };
  }
  return base;
};

const selectedSnapshot = (type: ExportElement["type"]): EditorSnapshot => {
  const element = selectedElementForType(type);
  return baseSnapshot({
    selectedElementId: element.id,
    selectedElement: element,
    visibleElements: [element],
    isDirty: false,
  });
};

const renderStatefulEditor = (editor: TestEditor, initialSnapshot: EditorSnapshot) => {
  let currentSnapshot = initialSnapshot;
  const renderer = createRenderer();
  const onSnapshotChange = vi.fn((nextSnapshot: EditorSnapshot) => {
    currentSnapshot = nextSnapshot;
    view.rerender(
      <EditorPage
        editor={editor}
        snapshot={currentSnapshot}
        onSnapshotChange={onSnapshotChange}
        pdfRenderer={renderer}
      />,
    );
  });
  const view = render(
    <EditorPage
      editor={editor}
      snapshot={currentSnapshot}
      onSnapshotChange={onSnapshotChange}
      pdfRenderer={renderer}
    />,
  );
  return { ...view, onSnapshotChange, renderer };
};

const dispatchPointerEvent = (
  target: HTMLElement | Window,
  type: string,
  init: { readonly clientX: number; readonly clientY: number; readonly pointerId: number },
): void => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: init.clientX },
    clientY: { value: init.clientY },
    pointerId: { value: init.pointerId },
  });
  act(() => {
    target.dispatchEvent(event);
  });
};
const textSnapshot = (text: string, fontSize = 16): EditorSnapshot => {
  const element: ExportElement = {
    id: "text-1",
    pageId: "page-1",
    type: "text",
    bounds: { x: 40, y: 50, width: 160, height: 48 },
    text,
    textAppearance: { fontSize, color: "#111111" },
  };
  return baseSnapshot({
    selectedElementId: element.id,
    selectedElement: element,
    visibleElements: [element],
    isDirty: true,
  });
};
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
  it("selects text with one click anywhere inside the text box without entering edit mode", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    const element = selectedElementForType("text");
    render(
      <EditorPage
        editor={editor}
        snapshot={baseSnapshot({ visibleElements: [element] })}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );

    await user.click(screen.getByLabelText("Text element content"));

    expect(editor.selectElement).toHaveBeenCalledWith("text-1");
    expect(screen.queryByLabelText("Edit text element")).toBeNull();
  });

  it("enters text editing on double-click and keeps normal typing inside the text input", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    render(
      <EditorPage
        editor={editor}
        snapshot={selectedSnapshot("text")}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );

    await user.dblClick(screen.getByLabelText("Text element content"));
    const input = screen.getByLabelText("Edit text element");
    expect(input).toHaveFocus();
    await user.keyboard("A");

    expect(editor.updateText).toHaveBeenCalled();
    expect(editor.deleteElement).not.toHaveBeenCalled();
  });

  it("types multi-character text without losing prior characters or resetting the caret", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    let currentText = "Editable text";
    editor.selectElement.mockImplementation(() => textSnapshot(currentText));
    editor.updateText.mockImplementation((elementId: string, text: string) => {
      expect(elementId).toBe("text-1");
      currentText = text;
      return textSnapshot(currentText);
    });
    renderStatefulEditor(editor, textSnapshot(currentText));

    await user.dblClick(screen.getByLabelText("Text element content"));
    const input = screen.getByLabelText("Edit text element");
    expect(input).toBeInstanceOf(HTMLTextAreaElement);
    const textArea = input as HTMLTextAreaElement;
    await user.keyboard("ABCDE");

    expect(textArea).toHaveValue("ABCDE");
    expect(textArea.selectionStart).toBe(5);
    expect(editor.deleteElement).not.toHaveBeenCalled();
  });

  it("edits in the middle of existing text while preserving caret position", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    let currentText = "Editable text";
    editor.selectElement.mockImplementation(() => textSnapshot(currentText));
    editor.updateText.mockImplementation((_elementId: string, text: string) => {
      currentText = text;
      return textSnapshot(currentText);
    });
    renderStatefulEditor(editor, textSnapshot(currentText));

    await user.dblClick(screen.getByLabelText("Text element content"));
    const input = screen.getByLabelText("Edit text element");
    expect(input).toBeInstanceOf(HTMLTextAreaElement);
    const textArea = input as HTMLTextAreaElement;
    textArea.setSelectionRange(4, 4);
    await user.keyboard("XYZ");

    expect(textArea).toHaveValue("EditXYZable text");
    expect(textArea.selectionStart).toBe(7);
  });

  it("lets Backspace and Delete edit text content without deleting the element", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    let currentText = "ABCDE";
    editor.selectElement.mockImplementation(() => textSnapshot(currentText));
    editor.updateText.mockImplementation((_elementId: string, text: string) => {
      currentText = text;
      return textSnapshot(currentText);
    });
    renderStatefulEditor(editor, textSnapshot(currentText));

    await user.dblClick(screen.getByLabelText("Text element content"));
    const input = screen.getByLabelText("Edit text element");
    expect(input).toBeInstanceOf(HTMLTextAreaElement);
    const textArea = input as HTMLTextAreaElement;
    textArea.setSelectionRange(2, 2);
    await user.keyboard("{Backspace}");
    expect(textArea).toHaveValue("ACDE");
    textArea.setSelectionRange(1, 1);
    await user.keyboard("{Delete}");

    expect(textArea).toHaveValue("ADE");
    expect(editor.deleteElement).not.toHaveBeenCalled();
  });
  it("enters text editing with Enter while selected", () => {
    render(
      <EditorPage
        editor={createEditor()}
        snapshot={selectedSnapshot("text")}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
    });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByLabelText("Edit text element")).toHaveFocus();
  });

  it("exits text editing with Escape and keeps the element selected", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    render(
      <EditorPage
        editor={editor}
        snapshot={selectedSnapshot("text")}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );
    await user.dblClick(screen.getByLabelText("Text element content"));
    const input = screen.getByLabelText("Edit text element");

    await user.keyboard("{Escape}");

    expect(screen.queryByLabelText("Edit text element")).toBeNull();
    expect(screen.getByRole("complementary", { name: "Selected element actions" })).toBeVisible();
    expect(screen.getByLabelText("Resize text element")).toBeVisible();
    expect(editor.deleteElement).not.toHaveBeenCalled();
    expect(input).not.toHaveFocus();
  });

  it("clicking outside text editing commits and exits editing", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    render(
      <EditorPage
        editor={editor}
        snapshot={selectedSnapshot("text")}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );
    await user.dblClick(screen.getByLabelText("Text element content"));

    await user.click(screen.getByLabelText("PDF overlay"));

    expect(screen.queryByLabelText("Edit text element")).toBeNull();
    expect(screen.getByRole("complementary", { name: "Selected element actions" })).toBeVisible();
  });

  it("Backspace edits text while editing and does not delete the selected text element", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    render(
      <EditorPage
        editor={editor}
        snapshot={selectedSnapshot("text")}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );
    await user.dblClick(screen.getByLabelText("Text element content"));

    await user.keyboard("{Backspace}");

    expect(editor.updateText).toHaveBeenCalled();
    expect(editor.deleteElement).not.toHaveBeenCalled();
  });

  it("dragging selected text moves it without entering editing", async () => {
    const editor = createEditor();
    render(
      <EditorPage
        editor={editor}
        snapshot={selectedSnapshot("text")}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );
    const text = screen.getByRole("group", { name: "text element" });

    const down = new Event("pointerdown", { bubbles: true });
    Object.defineProperties(down, {
      clientX: { value: 55 },
      clientY: { value: 65 },
      pointerId: { value: 1 },
    });
    act(() => {
      text.dispatchEvent(down);
    });
    expect(editor.selectElement).toHaveBeenCalledWith("text-1");
    await waitFor(() => {
      expect(text).toHaveFocus();
    });
    const move = new Event("pointermove", { bubbles: true });
    Object.defineProperties(move, {
      clientX: { value: 75 },
      clientY: { value: 85 },
    });
    const up = new Event("pointerup", { bubbles: true });
    act(() => {
      window.dispatchEvent(move);
      window.dispatchEvent(up);
    });

    await waitFor(() => {
      expect(editor.moveElement).toHaveBeenCalledWith(
        "text-1",
        expect.objectContaining({ x: 60, y: 70 }),
      );
    });
    expect(screen.queryByLabelText("Edit text element")).toBeNull();
  });

  it("newly created text is selected and enters editing automatically", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    const { rerender } = render(
      <EditorPage
        editor={editor}
        snapshot={baseSnapshot({ tool: "text" })}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );

    await user.click(screen.getByLabelText("PDF overlay"));
    const createdSnapshot = editor.addText.mock.results[0]?.value as EditorSnapshot;
    rerender(
      <EditorPage
        editor={editor}
        snapshot={createdSnapshot}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );

    expect(editor.addText).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByLabelText("Edit text element")).toHaveFocus();
    });
  });

  it("shows a text-only font-size control and updates text appearance through the editor use case", () => {
    const editor = createEditor();
    render(
      <EditorPage
        editor={editor}
        snapshot={selectedSnapshot("text")}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );

    const fontSize = screen.getByLabelText("Text font size");
    expect(fontSize).toHaveValue(16);
    fireEvent.change(fontSize, { target: { value: "24" } });

    expect(editor.updateTextFontSize).toHaveBeenCalledWith("text-1", 24);
  });

  it.each(["whiteout", "signature", "initials"] as const)(
    "hides the font-size control for selected %s overlays",
    (type) => {
      render(
        <EditorPage
          editor={createEditor()}
          snapshot={selectedSnapshot(type)}
          onSnapshotChange={vi.fn()}
          pdfRenderer={createRenderer()}
        />,
      );

      expect(screen.queryByLabelText("Text font size")).toBeNull();
    },
  );

  it("ignores empty or non-finite font-size input safely", () => {
    const editor = createEditor();
    render(
      <EditorPage
        editor={editor}
        snapshot={selectedSnapshot("text")}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );

    const fontSize = screen.getByLabelText("Text font size");
    fireEvent.change(fontSize, { target: { value: "" } });

    expect(editor.updateTextFontSize).not.toHaveBeenCalled();
  });

  it("renders normal overlays without document-like borders while keeping selected outlines", () => {
    render(
      <EditorPage
        editor={createEditor()}
        snapshot={selectedSnapshot("whiteout")}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );

    const whiteout = screen.getByRole("group", { name: "whiteout element" });
    expect(whiteout).toHaveClass("is-selected");
    expect(whiteout).not.toHaveStyle({ border: "1px solid #245e47" });
  });

  it("draws whiteout by pointer drag with a live preview and pointer capture", () => {
    const editor = createEditor();
    render(
      <EditorPage
        editor={editor}
        snapshot={baseSnapshot({ tool: "whiteout" })}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );
    const overlay = screen.getByLabelText("PDF overlay");
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    Object.defineProperty(overlay, "setPointerCapture", { value: setPointerCapture });
    Object.defineProperty(overlay, "hasPointerCapture", { value: vi.fn(() => true) });
    Object.defineProperty(overlay, "releasePointerCapture", { value: releasePointerCapture });
    Object.defineProperty(overlay, "getBoundingClientRect", {
      value: () => ({ left: 10, top: 20, width: 300, height: 400, right: 310, bottom: 420 }),
    });

    dispatchPointerEvent(overlay, "pointerdown", { clientX: 50, clientY: 70, pointerId: 7 });
    expect(setPointerCapture).toHaveBeenCalledWith(7);
    dispatchPointerEvent(overlay, "pointermove", { clientX: 170, clientY: 130, pointerId: 7 });
    expect(screen.getByLabelText("Whiteout preview")).toBeVisible();
    dispatchPointerEvent(overlay, "pointerup", { clientX: 170, clientY: 130, pointerId: 7 });

    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    expect(editor.addWhiteout).toHaveBeenCalledWith({ x: 40, y: 50, width: 120, height: 60 });
  });

  it("normalizes up-left whiteout drags and ignores tiny accidental drags", () => {
    const editor = createEditor();
    render(
      <EditorPage
        editor={editor}
        snapshot={baseSnapshot({ tool: "whiteout" })}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );
    const overlay = screen.getByLabelText("PDF overlay");
    Object.defineProperty(overlay, "setPointerCapture", { value: vi.fn() });
    Object.defineProperty(overlay, "hasPointerCapture", { value: vi.fn(() => false) });
    Object.defineProperty(overlay, "releasePointerCapture", { value: vi.fn() });
    Object.defineProperty(overlay, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, width: 300, height: 400, right: 300, bottom: 400 }),
    });

    dispatchPointerEvent(overlay, "pointerdown", { clientX: 180, clientY: 150, pointerId: 1 });
    dispatchPointerEvent(overlay, "pointermove", { clientX: 120, clientY: 90, pointerId: 1 });
    dispatchPointerEvent(overlay, "pointerup", { clientX: 120, clientY: 90, pointerId: 1 });
    expect(editor.addWhiteout).toHaveBeenCalledWith({ x: 120, y: 90, width: 60, height: 60 });

    editor.addWhiteout.mockClear();
    dispatchPointerEvent(overlay, "pointerdown", { clientX: 20, clientY: 20, pointerId: 2 });
    dispatchPointerEvent(overlay, "pointermove", { clientX: 22, clientY: 22, pointerId: 2 });
    dispatchPointerEvent(overlay, "pointerup", { clientX: 22, clientY: 22, pointerId: 2 });
    expect(editor.addWhiteout).not.toHaveBeenCalled();
  });

  it("cancels in-progress whiteout drag with Escape", () => {
    const editor = createEditor();
    render(
      <EditorPage
        editor={editor}
        snapshot={baseSnapshot({ tool: "whiteout" })}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );
    const overlay = screen.getByLabelText("PDF overlay");
    Object.defineProperty(overlay, "setPointerCapture", { value: vi.fn() });
    Object.defineProperty(overlay, "hasPointerCapture", { value: vi.fn(() => false) });
    Object.defineProperty(overlay, "releasePointerCapture", { value: vi.fn() });
    Object.defineProperty(overlay, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, width: 300, height: 400, right: 300, bottom: 400 }),
    });

    dispatchPointerEvent(overlay, "pointerdown", { clientX: 30, clientY: 40, pointerId: 3 });
    dispatchPointerEvent(overlay, "pointermove", { clientX: 130, clientY: 140, pointerId: 3 });
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Escape" });
    act(() => {
      window.dispatchEvent(event);
    });
    dispatchPointerEvent(overlay, "pointerup", { clientX: 130, clientY: 140, pointerId: 3 });

    expect(event.defaultPrevented).toBe(true);
    expect(editor.addWhiteout).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Whiteout preview")).toBeNull();
  });

  it.each(["select", "text", "whiteout", "signature", "initials"] as const)(
    "marks the %s tool as active with aria-pressed",
    async (tool) => {
      const user = userEvent.setup();
      const editor = createEditor();
      render(
        <EditorPage
          editor={editor}
          snapshot={baseSnapshot()}
          onSnapshotChange={vi.fn()}
          pdfRenderer={createRenderer()}
        />,
      );

      await user.click(screen.getByRole("button", { name: new RegExp(tool, "i") }));

      expect(editor.setTool).toHaveBeenCalledWith(tool);
    },
  );
  it.each(["whiteout", "signature", "initials"] as const)(
    "keeps %s selection behavior unchanged",
    async (type) => {
      const user = userEvent.setup();
      const editor = createEditor();
      const element = selectedElementForType(type);
      render(
        <EditorPage
          editor={editor}
          snapshot={baseSnapshot({ visibleElements: [element] })}
          onSnapshotChange={vi.fn()}
          pdfRenderer={createRenderer()}
        />,
      );

      await user.click(screen.getByRole("group", { name: `${type} element` }));

      expect(editor.selectElement).toHaveBeenCalledWith(`${type}-1`);
      expect(screen.queryByLabelText("Edit text element")).toBeNull();
    },
  );
  it.each(["text", "whiteout", "signature", "initials"] as const)(
    "shows shared delete and duplicate actions for selected %s overlays",
    (type) => {
      const editor = createEditor();
      render(
        <EditorPage
          editor={editor}
          snapshot={selectedSnapshot(type)}
          onSnapshotChange={vi.fn()}
          pdfRenderer={createRenderer()}
        />,
      );

      expect(screen.getByRole("complementary", { name: "Selected element actions" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Delete" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Duplicate" })).toBeVisible();
      expect(screen.getByLabelText(`Resize ${type} element`)).toBeVisible();
    },
  );

  it.each(["text", "whiteout", "signature", "initials"] as const)(
    "routes shared delete and duplicate controls for selected %s overlays through application use cases",
    async (type) => {
      const user = userEvent.setup();
      const editor = createEditor();
      render(
        <EditorPage
          editor={editor}
          snapshot={selectedSnapshot(type)}
          onSnapshotChange={vi.fn()}
          pdfRenderer={createRenderer()}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Duplicate" }));
      expect(editor.duplicateElement).toHaveBeenCalledWith(`${type}-1`);
      await user.click(screen.getByRole("button", { name: "Delete" }));
      expect(editor.deleteElement).toHaveBeenCalledWith(`${type}-1`);
    },
  );

  it.each(["text", "whiteout", "signature", "initials"] as const)(
    "deletes selected %s overlays with the keyboard",
    (type) => {
      const editor = createEditor();
      render(
        <EditorPage
          editor={editor}
          snapshot={selectedSnapshot(type)}
          onSnapshotChange={vi.fn()}
          pdfRenderer={createRenderer()}
        />,
      );
      const event = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Delete",
      });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(event.defaultPrevented).toBe(true);
      expect(editor.deleteElement).toHaveBeenCalledWith(`${type}-1`);
    },
  );

  it("deletes selected overlays with Backspace", () => {
    const editor = createEditor();
    render(
      <EditorPage
        editor={editor}
        snapshot={selectedSnapshot("text")}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Backspace",
    });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(editor.deleteElement).toHaveBeenCalledWith("text-1");
  });

  it("does not show selected element actions when nothing is selected", () => {
    render(
      <EditorPage
        editor={createEditor()}
        snapshot={baseSnapshot()}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );

    expect(screen.queryByRole("complementary", { name: "Selected element actions" })).toBeNull();
  });

  it("does not delete selected overlays while focus is inside editing controls", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    render(
      <EditorPage
        editor={editor}
        snapshot={selectedSnapshot("text")}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );

    await user.dblClick(screen.getByLabelText("Text element content"));
    const textArea = screen.getByLabelText("Edit text element");
    await user.click(textArea);
    const textAreaDelete = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Delete",
    });
    act(() => {
      textArea.dispatchEvent(textAreaDelete);
    });
    expect(editor.deleteElement).not.toHaveBeenCalled();

    const widthInput = screen.getByLabelText("Selected element width");
    await user.click(widthInput);
    const inputDelete = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Delete",
    });
    act(() => {
      widthInput.dispatchEvent(inputDelete);
    });
    expect(editor.deleteElement).not.toHaveBeenCalled();

    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    document.body.append(editable);
    const editableDelete = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Delete",
    });
    act(() => {
      editable.dispatchEvent(editableDelete);
    });
    expect(editor.deleteElement).not.toHaveBeenCalled();
    editable.remove();

    await user.click(screen.getByRole("button", { name: "Signature" }));
    await user.click(screen.getByRole("tab", { name: "Type" }));
    const fontSelect = screen.getByLabelText("Font");
    await user.click(fontSelect);
    const selectDelete = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Delete",
    });
    act(() => {
      fontSelect.dispatchEvent(selectDelete);
    });
    expect(editor.deleteElement).not.toHaveBeenCalled();

    await user.click(screen.getByRole("tab", { name: "Draw" }));
    const signaturePad = screen.getByLabelText("Draw signature");
    signaturePad.focus();
    const padDelete = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Delete",
    });
    act(() => {
      signaturePad.dispatchEvent(padDelete);
    });

    expect(editor.deleteElement).not.toHaveBeenCalled();
  });
  it("opens a signature dialog with draw, type, and upload tabs and accepts typed signatures", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    render(
      <EditorPage
        editor={editor}
        snapshot={baseSnapshot()}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Signature" }));

    expect(screen.getByRole("dialog", { name: "Signature" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Draw" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Type" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Upload" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Type" }));
    await user.clear(screen.getByLabelText("Signature name"));
    await user.type(screen.getByLabelText("Signature name"), "Ada Lovelace");
    await user.selectOptions(screen.getByLabelText("Font"), "serif");
    expect(screen.getByLabelText("Signature preview")).toHaveTextContent("Ada Lovelace");
    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(editor.addTypedSignature).toHaveBeenCalledWith(
      { x: 56, y: 250 },
      { text: "Ada Lovelace", fontFamily: "serif" },
    );
  });

  it("opens initials without an upload tab and accepts typed initials", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    render(
      <EditorPage
        editor={editor}
        snapshot={baseSnapshot()}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Initials" }));

    expect(screen.getByRole("dialog", { name: "Initials" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Upload" })).toBeNull();
    await user.click(screen.getByRole("tab", { name: "Type" }));
    await user.clear(screen.getByLabelText("Initials text"));
    await user.type(screen.getByLabelText("Initials text"), "AL");
    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(editor.addTypedInitials).toHaveBeenCalledWith(
      { x: 56, y: 180 },
      { text: "AL", fontFamily: "cursive" },
    );
  });

  it("rejects unsupported signature uploads and closes the dialog with Escape", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const editor = createEditor();
    render(
      <EditorPage
        editor={editor}
        snapshot={baseSnapshot()}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Signature" }));
    await user.click(screen.getByRole("tab", { name: "Upload" }));
    await user.upload(
      screen.getByLabelText("Upload signature image"),
      new File(["gif"], "sig.gif", { type: "image/gif" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Use a PNG, JPG, or JPEG signature image.");
    expect(editor.addUploadedSignature).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("supports pointer drawing with a transparent canvas background", async () => {
    const user = userEvent.setup();
    const editor = createEditor();
    class TestPointerEvent extends MouseEvent {
      public readonly pointerId: number;

      public constructor(type: string, init: MouseEventInit & { readonly pointerId?: number }) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    Object.defineProperty(window, "PointerEvent", { configurable: true, value: TestPointerEvent });
    const stroke = vi.fn();
    const context = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke,
      clearRect: vi.fn(),
      lineCap: "round",
      lineJoin: "round",
      lineWidth: 4,
      strokeStyle: "#111111",
    } as unknown as CanvasRenderingContext2D;
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    const toDataUrl = vi
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockReturnValue("data:image/png;base64,iVBORw0KGgo=");
    Object.defineProperty(HTMLCanvasElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    render(
      <EditorPage
        editor={editor}
        snapshot={baseSnapshot()}
        onSnapshotChange={vi.fn()}
        pdfRenderer={createRenderer()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Signature" }));
    const pad = screen.getByLabelText("Draw signature");
    expect(pad).toHaveClass("signature-pad");
    act(() => {
      pad.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: 10, clientY: 12 }),
      );
      pad.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: 40, clientY: 42 }),
      );
      pad.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
    });
    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(stroke).toHaveBeenCalled();
    expect(toDataUrl).toHaveBeenCalledWith("image/png");
    expect(editor.addDrawnSignature).toHaveBeenCalledWith(
      { x: 56, y: 250 },
      expect.objectContaining({ mimeType: "image/png", source: "draw" }),
    );
    getContext.mockRestore();
    toDataUrl.mockRestore();
  });
});
