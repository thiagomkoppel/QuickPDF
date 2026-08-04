import "@testing-library/jest-dom/vitest";

const noOp = (): void => {
  return undefined;
};

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  writable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: noOp,
    removeEventListener: noOp,
    addListener: noOp,
    removeListener: noOp,
    dispatchEvent: () => false,
  }),
});

function TestWorker(): void {
  return undefined;
}

class TestResizeObserver {
  public observe(): void {
    return undefined;
  }

  public unobserve(): void {
    return undefined;
  }

  public disconnect(): void {
    return undefined;
  }
}

function TestCanvasRenderingContext2D(): void {
  return undefined;
}

Object.defineProperty(window.navigator, "userAgent", {
  configurable: true,
  value: "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36",
});
Object.defineProperty(globalThis, "Worker", { configurable: true, value: TestWorker });
Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  value: TestResizeObserver,
});
Object.defineProperty(globalThis, "CanvasRenderingContext2D", {
  configurable: true,
  value: TestCanvasRenderingContext2D,
});
Object.defineProperty(URL, "createObjectURL", {
  configurable: true,
  value: () => "blob:quickpdf-test",
});
