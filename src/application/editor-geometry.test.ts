import { describe, expect, it } from "vitest";

import { pageTopLeftRectToPdfRect, pageTopLeftTextToPdfPoint } from "./editor-geometry";

describe("editor export geometry", () => {
  it("maps top-left overlay rectangles into bottom-left PDF rectangles", () => {
    expect(
      pageTopLeftRectToPdfRect(
        { x: 25, y: 40, width: 120, height: 30 },
        { width: 300, height: 400 },
      ),
    ).toEqual({ x: 25, y: 330, width: 120, height: 30 });
  });

  it("maps text to a PDF baseline independent of viewer zoom", () => {
    expect(
      pageTopLeftTextToPdfPoint({
        bounds: { x: 30, y: 50, width: 160, height: 40 },
        page: { width: 612, height: 792 },
        fontSize: 16,
      }),
    ).toEqual({ x: 30, y: 726 });
  });

  it("uses each page height for page-size variation", () => {
    expect(
      pageTopLeftRectToPdfRect(
        { x: 10, y: 20, width: 80, height: 25 },
        { width: 500, height: 700 },
      ),
    ).toEqual({ x: 10, y: 655, width: 80, height: 25 });
  });
});
