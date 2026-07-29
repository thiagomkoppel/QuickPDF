import "@testing-library/jest-dom/vitest";

if (!("DOMMatrix" in globalThis)) {
  Object.defineProperty(globalThis, "DOMMatrix", {
    value: class DOMMatrix {
      public readonly is2D = true;
    },
  });
}

if (!("ImageData" in globalThis)) {
  Object.defineProperty(globalThis, "ImageData", {
    value: class ImageData {
      public readonly width = 0;
    },
  });
}

if (!("Path2D" in globalThis)) {
  Object.defineProperty(globalThis, "Path2D", {
    value: class Path2D {
      public addPath(): void {
        return undefined;
      }
    },
  });
}

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  value: () => ({
    clearRect: () => undefined,
    setTransform: () => undefined,
  }),
});
