export type PdfJsCompatibilityReason =
  | "missing-required-api"
  | "pdfjs-module-load-failed"
  | "worker-initialization-failed"
  | "canvas-unavailable"
  | "render-probe-failed";

export interface PdfJsCompatibilityDiagnostics {
  readonly missingRequiredApis: readonly string[];
  readonly canvasAvailable: boolean;
  readonly moduleLoaded: boolean;
  readonly workerInitialized: boolean;
  readonly renderProbeCompleted: boolean;
}

export type PdfJsCompatibilityResult =
  | { readonly status: "compatible"; readonly diagnostics: PdfJsCompatibilityDiagnostics }
  | {
      readonly status: "incompatible";
      readonly reason: PdfJsCompatibilityReason;
      readonly diagnostics: PdfJsCompatibilityDiagnostics;
    }
  | { readonly status: "indeterminate"; readonly diagnostics: PdfJsCompatibilityDiagnostics };

interface PdfJsProbePage {
  getViewport(): { readonly width: number; readonly height: number };
  render(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): Promise<void>;
  cleanup(): void;
}

interface PdfJsProbeDocument {
  getPage(pageNumber: number): Promise<PdfJsProbePage>;
  cleanup(): void;
}

interface PdfJsProbeModule {
  loadProbeDocument(bytes: Uint8Array): Promise<PdfJsProbeDocument>;
}

export interface PdfJsCompatibilityEnvironment {
  readonly Promise: unknown;
  readonly ReadableStream: unknown;
  readonly AbortController: unknown;
  readonly TextDecoder: unknown;
  readonly TextEncoder: unknown;
  readonly Worker: unknown;
  readonly WebAssembly: unknown;
  readonly ResizeObserver: unknown;
  readonly createObjectURL: unknown;
  createCanvas(): HTMLCanvasElement | undefined;
  loadPdfJsModule(): Promise<PdfJsProbeModule>;
  readonly timeoutMs: number;
}

const REQUIRED_APIS: readonly (readonly [
  string,
  (environment: PdfJsCompatibilityEnvironment) => boolean,
])[] = [
  ["Promise", (environment) => typeof environment.Promise === "function"],
  ["ReadableStream", (environment) => typeof environment.ReadableStream === "function"],
  ["AbortController", (environment) => typeof environment.AbortController === "function"],
  ["TextDecoder", (environment) => typeof environment.TextDecoder === "function"],
  ["TextEncoder", (environment) => typeof environment.TextEncoder === "function"],
  ["Worker", (environment) => typeof environment.Worker === "function"],
  ["WebAssembly", (environment) => typeof environment.WebAssembly === "object"],
  ["ResizeObserver", (environment) => typeof environment.ResizeObserver === "function"],
  ["URL.createObjectURL", (environment) => typeof environment.createObjectURL === "function"],
];

const diagnostics = (
  missingRequiredApis: readonly string[],
  canvasAvailable = false,
  moduleLoaded = false,
  workerInitialized = false,
  renderProbeCompleted = false,
): PdfJsCompatibilityDiagnostics => ({
  missingRequiredApis,
  canvasAvailable,
  moduleLoaded,
  workerInitialized,
  renderProbeCompleted,
});

const buildProbePdf = (): Uint8Array => {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 16 16] /Resources << >> /Contents 4 0 R >>",
    "<< /Length 25 >>\nstream\n0 0 0 rg\n0 0 16 16 re f\nendstream",
  ];
  let content = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(content.length);
    content += `${String(index + 1)} 0 obj\n${object}\nendobj\n`;
  });
  const startXref = content.length;
  content += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    content += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  content += `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(startXref)}\n%%EOF`;
  return Uint8Array.from(content, (character) => character.charCodeAt(0));
};

const browserEnvironment = (): PdfJsCompatibilityEnvironment => ({
  Promise: globalThis.Promise,
  ReadableStream: globalThis.ReadableStream,
  AbortController: globalThis.AbortController,
  TextDecoder: globalThis.TextDecoder,
  TextEncoder: globalThis.TextEncoder,
  Worker: globalThis.Worker,
  WebAssembly: globalThis.WebAssembly,
  ResizeObserver: globalThis.ResizeObserver,
  createObjectURL:
    typeof globalThis.URL === "function" && typeof globalThis.URL.createObjectURL === "function"
      ? () => undefined
      : undefined,
  createCanvas: () =>
    typeof document === "undefined" ? undefined : document.createElement("canvas"),
  loadPdfJsModule: async () => {
    const { pdfjs } = await import("../pdf/pdfjs-runtime");
    const getDocument = (options: Parameters<typeof pdfjs.getDocument>[0]) =>
      pdfjs.getDocument(options);
    return {
      loadProbeDocument: async (bytes) => {
        const loadingTask = getDocument({
          data: bytes,
          disableAutoFetch: true,
          disableStream: true,
        });
        const documentProxy = await loadingTask.promise;
        return {
          getPage: async (pageNumber) => {
            const page = await documentProxy.getPage(pageNumber);
            return {
              getViewport: () => page.getViewport({ scale: 1 }),
              render: async (canvas, context) => {
                await page.render({
                  canvas,
                  canvasContext: context,
                  viewport: page.getViewport({ scale: 1 }),
                }).promise;
              },
              cleanup: () => {
                page.cleanup();
              },
            };
          },
          cleanup: () => {
            void documentProxy.cleanup();
            void loadingTask.destroy();
          },
        };
      },
    };
  },
  timeoutMs: 3_000,
});

const hasRenderedPixels = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): boolean => {
  const pixels = context.getImageData(0, 0, width, height).data;
  for (let index = 0; index < pixels.length; index += 4) {
    if (
      (pixels[index] ?? 255) < 245 ||
      (pixels[index + 1] ?? 255) < 245 ||
      (pixels[index + 2] ?? 255) < 245
    ) {
      return true;
    }
  }
  return false;
};

const timeout = (duration: number): Promise<undefined> =>
  new Promise((resolve) => {
    window.setTimeout(() => {
      resolve(undefined);
    }, duration);
  });

const isPositiveFinite = (value: number): boolean => Number.isFinite(value) && value > 0;

export const preflightPdfJsCompatibility = async (
  environment: PdfJsCompatibilityEnvironment = browserEnvironment(),
): Promise<PdfJsCompatibilityResult> => {
  const missingRequiredApis = REQUIRED_APIS.filter(([, available]) => !available(environment)).map(
    ([name]) => name,
  );
  if (missingRequiredApis.length > 0) {
    return {
      status: "incompatible",
      reason: "missing-required-api",
      diagnostics: diagnostics(missingRequiredApis),
    };
  }

  let canvas: HTMLCanvasElement | undefined;
  let context: CanvasRenderingContext2D | null = null;
  try {
    canvas = environment.createCanvas();
    context = canvas?.getContext("2d") ?? null;
  } catch {
    context = null;
  }
  if (canvas === undefined || context === null) {
    return {
      status: "incompatible",
      reason: "canvas-unavailable",
      diagnostics: diagnostics(missingRequiredApis),
    };
  }

  const probe = async (): Promise<PdfJsCompatibilityResult> => {
    let module: PdfJsProbeModule;
    try {
      module = await environment.loadPdfJsModule();
    } catch {
      return {
        status: "incompatible",
        reason: "pdfjs-module-load-failed",
        diagnostics: diagnostics(missingRequiredApis, true),
      };
    }

    let documentProxy: PdfJsProbeDocument | undefined;
    let page: PdfJsProbePage | undefined;
    try {
      documentProxy = await module.loadProbeDocument(buildProbePdf());
      page = await documentProxy.getPage(1);
      const viewport = page.getViewport();
      const width = Math.ceil(viewport.width);
      const height = Math.ceil(viewport.height);
      if (!isPositiveFinite(width) || !isPositiveFinite(height)) {
        return {
          status: "incompatible",
          reason: "render-probe-failed",
          diagnostics: diagnostics(missingRequiredApis, true, true, true),
        };
      }
      canvas.width = width;
      canvas.height = height;
      await page.render(canvas, context);
      if (!hasRenderedPixels(context, width, height)) {
        return {
          status: "incompatible",
          reason: "render-probe-failed",
          diagnostics: diagnostics(missingRequiredApis, true, true, true),
        };
      }
      return {
        status: "compatible",
        diagnostics: diagnostics(missingRequiredApis, true, true, true, true),
      };
    } catch {
      return {
        status: "incompatible",
        reason:
          documentProxy === undefined ? "worker-initialization-failed" : "render-probe-failed",
        diagnostics: diagnostics(missingRequiredApis, true, true, documentProxy !== undefined),
      };
    } finally {
      page?.cleanup();
      documentProxy?.cleanup();
    }
  };

  const result = await Promise.race([probe(), timeout(environment.timeoutMs)]);
  return (
    result ?? {
      status: "indeterminate",
      diagnostics: diagnostics(missingRequiredApis, true),
    }
  );
};
