import { describe, expect, it } from "vitest";

import { classifyEditorFormFactor } from "./editor-form-factor";

describe("classifyEditorFormFactor", () => {
  it("keeps narrow touch viewports in Phone Quick Edit", () => {
    expect(
      classifyEditorFormFactor({
        width: 430,
        height: 932,
        hasCoarsePointer: true,
        maxTouchPoints: 5,
      }),
    ).toBe("phone");
  });

  it("uses the portrait tablet shell for a tall coarse-pointer viewport", () => {
    expect(
      classifyEditorFormFactor({
        width: 820,
        height: 1180,
        hasCoarsePointer: true,
        maxTouchPoints: 5,
      }),
    ).toBe("tablet-portrait");
  });

  it("keeps a wide physical tablet in tablet landscape instead of desktop", () => {
    expect(
      classifyEditorFormFactor({
        width: 1280,
        height: 800,
        hasCoarsePointer: true,
        maxTouchPoints: 10,
      }),
    ).toBe("tablet-landscape");
  });

  it("keeps a wide touch tablet in the landscape tablet shell", () => {
    expect(
      classifyEditorFormFactor({
        width: 1366,
        height: 1024,
        hasCoarsePointer: true,
        maxTouchPoints: 5,
      }),
    ).toBe("tablet-landscape");
  });

  it("keeps a wide non-touch desktop in the desktop shell", () => {
    expect(
      classifyEditorFormFactor({
        width: 1440,
        height: 900,
        hasCoarsePointer: false,
        maxTouchPoints: 0,
      }),
    ).toBe("desktop");
  });
  it("does not mistake a short desktop viewport for a phone", () => {
    expect(
      classifyEditorFormFactor({
        width: 1280,
        height: 720,
        hasCoarsePointer: false,
        maxTouchPoints: 0,
      }),
    ).toBe("desktop");
  });
});
