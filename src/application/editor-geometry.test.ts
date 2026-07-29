import { describe, expect, it } from "vitest";

import {
  calculateAnchoredScroll,
  pageToScreenPoint,
  pageToScreenRect,
  screenToPagePoint,
  screenToPageRect,
} from "./editor-geometry";

describe("editor geometry", () => {
  it("converts page points to screen points and back", () => {
    const viewport = { pageWidth: 600, pageHeight: 800, scale: 1.5 };

    expect(pageToScreenPoint({ x: 40, y: 100 }, viewport)).toEqual({ x: 60, y: 150 });
    expect(screenToPagePoint({ x: 60, y: 150 }, viewport)).toEqual({ x: 40, y: 100 });
  });

  it("converts rectangles between page and screen coordinates", () => {
    const viewport = { pageWidth: 300, pageHeight: 500, scale: 2 };

    expect(pageToScreenRect({ x: 10, y: 20, width: 30, height: 40 }, viewport)).toEqual({
      x: 20,
      y: 40,
      width: 60,
      height: 80,
    });
    expect(screenToPageRect({ x: 20, y: 40, width: 60, height: 80 }, viewport)).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    });
  });

  it("keeps the cursor anchor approximately stable during zoom", () => {
    expect(
      calculateAnchoredScroll({
        scrollLeft: 100,
        scrollTop: 200,
        pointerX: 50,
        pointerY: 25,
        previousScale: 1,
        nextScale: 2,
      }),
    ).toEqual({ x: 250, y: 425 });
  });
});
