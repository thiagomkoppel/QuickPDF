import { describe, expect, it } from "vitest";

import { calculateViewerFit } from "./editor-view-modes";

describe("calculateViewerFit", () => {
  const input = {
    workspaceWidth: 1000,
    workspaceHeight: 700,
    horizontalPadding: 80,
    verticalPadding: 100,
    pageWidth: 600,
    pageHeight: 800,
  };

  it("fits a whole page into the actual available workspace", () => {
    expect(calculateViewerFit("fit-page", input)).toBe(0.75);
  });

  it("fits the page width using actual available workspace width", () => {
    expect(calculateViewerFit("fit-width", input)).toBe(920 / 600);
  });

  it("rejects invalid dimensions rather than producing a non-finite zoom", () => {
    expect(calculateViewerFit("fit-page", { ...input, pageWidth: 0 })).toBeUndefined();
  });
});
