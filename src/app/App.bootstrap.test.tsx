import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PdfJsCompatibilityResult } from "../infrastructure/browser/browser-compatibility";

import { App } from "./App";
vi.mock("../infrastructure/pdf/pdfjs-page-renderer", () => ({
  PdfJsPageRenderer: vi.fn(),
}));

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

const flushPromises = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState({}, "", "/");
});

describe("QuickPDF bootstrap compatibility screen", () => {
  it("shows only the startup screen until the compatible preflight and five-second minimum both complete", async () => {
    vi.useFakeTimers();
    const probe = vi.fn(() => Promise.resolve(compatible));
    render(<App compatibilityProbe={probe} />);

    expect(screen.getByRole("heading", { name: "Preparing QuickPDF" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Checking PDF renderer compatibility...");
    expect(
      screen.queryByRole("heading", { name: "Browser not supported" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Choose a PDF file")).not.toBeInTheDocument();
    expect(probe).toHaveBeenCalledTimes(1);

    await flushPromises();
    await act(() => vi.advanceTimersByTimeAsync(4_999));
    expect(screen.getByRole("heading", { name: "Preparing QuickPDF" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Choose a PDF file")).not.toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByLabelText("Choose a PDF file")).toBeInTheDocument();
  });

  it("keeps the startup screen visible while a slow probe is still running", async () => {
    vi.useFakeTimers();
    let resolveProbe: (result: PdfJsCompatibilityResult) => void = () => undefined;
    render(
      <App
        compatibilityProbe={() =>
          new Promise<PdfJsCompatibilityResult>((resolve) => {
            resolveProbe = resolve;
          })
        }
      />,
    );

    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(screen.getByRole("heading", { name: "Preparing QuickPDF" })).toBeInTheDocument();

    await act(async () => {
      resolveProbe(compatible);
      await Promise.resolve();
    });
    expect(screen.getByLabelText("Choose a PDF file")).toBeInTheDocument();
  });

  it("shows the existing compatibility page only after the startup minimum for a confirmed incompatible probe", async () => {
    vi.useFakeTimers();
    render(<App initialCompatibilityResult={incompatible} />);

    expect(screen.getByRole("heading", { name: "Preparing QuickPDF" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Browser not supported" }),
    ).not.toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(screen.getByRole("heading", { name: "Browser not supported" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Choose a PDF file")).not.toBeInTheDocument();
  });

  it("removes the static boot fallback after React mounts", () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<section id="quickpdf-boot-fallback">Starting QuickPDF...</section>',
    );

    render(<App initialCompatibilityResult={compatible} startupMinimumDurationMs={0} />);

    expect(document.getElementById("quickpdf-boot-fallback")).toBeNull();
  });
  it("continues to the requested route after an indeterminate preflight", () => {
    window.history.replaceState({}, "", "/privacy");
    render(
      <App
        initialCompatibilityResult={{ ...compatible, status: "indeterminate" }}
        startupMinimumDurationMs={0}
      />,
    );

    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeInTheDocument();
  });
});
