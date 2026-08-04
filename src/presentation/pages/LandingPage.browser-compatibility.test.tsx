import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { EditorSnapshot, PdfEditorApplication } from "../../application/editor-application";
import type { PdfJsCompatibilityResult } from "../../infrastructure/browser/browser-compatibility";

import { LandingPage } from "./LandingPage";

const emptySnapshot: EditorSnapshot = {
  state: {
    status: "empty",
    pageCount: 0,
    pages: [],
    currentPageNumber: 0,
    tool: "select",
    isDirty: false,
    elements: [],
    visibleElements: [],
  },
  canUndo: false,
  canRedo: false,
  canExport: false,
  canPaste: false,
};

const compatible: PdfJsCompatibilityResult = {
  status: "compatible",
  diagnostics: {
    missingRequiredApis: [],
    canvasAvailable: true,
    moduleLoaded: true,
    workerInitialized: true,
    renderProbeCompleted: true,
  },
};

const incompatible: PdfJsCompatibilityResult = {
  status: "incompatible",
  reason: "render-probe-failed",
  diagnostics: {
    missingRequiredApis: [],
    canvasAvailable: true,
    moduleLoaded: true,
    workerInitialized: true,
    renderProbeCompleted: false,
  },
};

const renderLanding = (compatibilityCheck: () => Promise<PdfJsCompatibilityResult>) =>
  render(
    <LandingPage
      compatibilityCheck={compatibilityCheck}
      editor={{ openFile: vi.fn() } as unknown as PdfEditorApplication}
      snapshot={emptySnapshot}
      onDocumentOpened={vi.fn()}
      onSnapshotChange={vi.fn()}
    />,
  );

describe("LandingPage PDF.js compatibility preflight", () => {
  it("shows the compatibility panel only after a confirmed incompatible result", async () => {
    renderLanding(() => Promise.resolve(incompatible));

    expect(screen.getByRole("status")).toHaveTextContent("Checking browser support...");
    expect(
      screen.queryByRole("heading", { name: "Browser not supported" }),
    ).not.toBeInTheDocument();

    expect(
      await screen.findByRole("heading", { name: "Browser not supported" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Choose a PDF file")).not.toBeInTheDocument();
  });

  it("never mounts the unsupported panel for a compatible renderer preflight", async () => {
    let resolvePreflight: (result: PdfJsCompatibilityResult) => void = () => undefined;
    renderLanding(
      () =>
        new Promise<PdfJsCompatibilityResult>((resolve) => {
          resolvePreflight = resolve;
        }),
    );

    expect(screen.getByRole("status")).toHaveTextContent("Checking browser support...");
    expect(
      screen.queryByRole("heading", { name: "Browser not supported" }),
    ).not.toBeInTheDocument();

    resolvePreflight(compatible);

    expect(await screen.findByRole("button", { name: "Open a PDF file" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Browser not supported" }),
    ).not.toBeInTheDocument();
  });

  it("allows opening after an indeterminate probe instead of falsely blocking the browser", async () => {
    renderLanding(() => Promise.resolve({ ...compatible, status: "indeterminate" }));

    const dropZone = await screen.findByRole("button", { name: "Open a PDF file" });
    fireEvent.dragEnter(dropZone, { dataTransfer: { types: ["Files"] } });

    await waitFor(() => {
      expect(dropZone).toHaveClass("is-drag-active");
    });
    expect(
      screen.queryByRole("heading", { name: "Browser not supported" }),
    ).not.toBeInTheDocument();
  });
});
