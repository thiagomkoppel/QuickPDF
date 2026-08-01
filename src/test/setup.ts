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
