import { describe, expect, it, vi } from "vitest";

import {
  preflightPdfJsCompatibility,
  type PdfJsCompatibilityEnvironment,
} from "./browser-compatibility";

const available = (): void => undefined;

const compatibleEnvironment = (): PdfJsCompatibilityEnvironment => {
  const context = {
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })),
  } as unknown as CanvasRenderingContext2D;
  const page = {
    getViewport: vi.fn(() => ({ width: 16, height: 16 })),
    render: vi.fn(() => Promise.resolve()),
    cleanup: vi.fn(),
  };
  const documentProxy = {
    getPage: vi.fn(() => Promise.resolve(page)),
    cleanup: vi.fn(),
  };
  return {
    Promise: available,
    ReadableStream: available,
    AbortController: available,
    TextDecoder: available,
    TextEncoder: available,
    Worker: available,
    WebAssembly: {},
    ResizeObserver: available,
    createObjectURL: available,
    createCanvas: () =>
      ({ width: 0, height: 0, getContext: vi.fn(() => context) }) as unknown as HTMLCanvasElement,
    loadPdfJsModule: () =>
      Promise.resolve({
        loadProbeDocument: vi.fn(() => Promise.resolve(documentProxy)),
      }),
    timeoutMs: 50,
  };
};

describe("PDF.js compatibility preflight", () => {
  it("accepts an environment that initializes the worker and renders the probe", async () => {
    await expect(preflightPdfJsCompatibility(compatibleEnvironment())).resolves.toMatchObject({
      status: "compatible",
      diagnostics: {
        moduleLoaded: true,
        workerInitialized: true,
        renderProbeCompleted: true,
      },
    });
  });

  it("does not use browser name or version to decide renderer compatibility", async () => {
    await expect(preflightPdfJsCompatibility(compatibleEnvironment())).resolves.toMatchObject({
      status: "compatible",
    });
  });

  it("rejects missing browser APIs before loading PDF.js", async () => {
    const environment = { ...compatibleEnvironment(), Worker: undefined };
    await expect(preflightPdfJsCompatibility(environment)).resolves.toMatchObject({
      status: "incompatible",
      reason: "missing-required-api",
      diagnostics: { missingRequiredApis: ["Worker"] },
    });
  });

  it("reports module loading failure distinctly", async () => {
    const environment = {
      ...compatibleEnvironment(),
      loadPdfJsModule: () => Promise.reject(new Error("module unavailable")),
    };
    await expect(preflightPdfJsCompatibility(environment)).resolves.toMatchObject({
      status: "incompatible",
      reason: "pdfjs-module-load-failed",
    });
  });

  it("reports worker initialization failure distinctly", async () => {
    const environment = {
      ...compatibleEnvironment(),
      loadPdfJsModule: () =>
        Promise.resolve({
          loadProbeDocument: vi.fn(() => Promise.reject(new Error("worker failed"))),
        }),
    };
    await expect(preflightPdfJsCompatibility(environment)).resolves.toMatchObject({
      status: "incompatible",
      reason: "worker-initialization-failed",
    });
  });

  it("reports an empty render probe as incompatible", async () => {
    const environment = {
      ...compatibleEnvironment(),
      createCanvas: () =>
        ({
          width: 0,
          height: 0,
          getContext: vi.fn(
            () =>
              ({
                getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([255, 255, 255, 255]) })),
              }) as unknown as CanvasRenderingContext2D,
          ),
        }) as unknown as HTMLCanvasElement,
    };
    await expect(preflightPdfJsCompatibility(environment)).resolves.toMatchObject({
      status: "incompatible",
      reason: "render-probe-failed",
    });
  });

  it("keeps the app usable when the probe times out", async () => {
    const environment = {
      ...compatibleEnvironment(),
      loadPdfJsModule: () => new Promise<never>(() => undefined),
      timeoutMs: 1,
    };
    await expect(preflightPdfJsCompatibility(environment)).resolves.toMatchObject({
      status: "indeterminate",
    });
  });
});
