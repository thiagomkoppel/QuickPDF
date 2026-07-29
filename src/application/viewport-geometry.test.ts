import { describe, expect, it } from "vitest";

import { pageToScreenPoint, screenToPagePoint } from "./viewport-geometry";

describe("viewport geometry", () => {
  it("converts between PDF page points and top-left screen points", () => {
    const viewport = { pageWidth: 600, pageHeight: 800, scale: 2 };

    expect(pageToScreenPoint({ x: 25, y: 700 }, viewport)).toEqual({ x: 50, y: 200 });
    expect(screenToPagePoint({ x: 50, y: 200 }, viewport)).toEqual({ x: 25, y: 700 });
  });
});
