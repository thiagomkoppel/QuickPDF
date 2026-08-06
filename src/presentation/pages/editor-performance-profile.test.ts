import { describe, expect, it } from "vitest";

import {
  renderPixelRatioForProfile,
  resolveEditorPerformanceProfile,
} from "./editor-performance-profile";

describe("resolveEditorPerformanceProfile", () => {
  it("uses Light Mode automatically on a low-powered touch device", () => {
    expect(
      resolveEditorPerformanceProfile("automatic", {
        formFactor: "tablet-landscape",
        hardwareConcurrency: 4,
        deviceMemory: undefined,
      }),
    ).toBe("light");
  });

  it("uses Light Mode when an older touch browser exposes no capacity signal", () => {
    expect(
      resolveEditorPerformanceProfile("automatic", {
        formFactor: "tablet-landscape",
        hardwareConcurrency: undefined,
        deviceMemory: undefined,
      }),
    ).toBe("light");
  });
  it("keeps Automatic at full quality on a capable touch device", () => {
    expect(
      resolveEditorPerformanceProfile("automatic", {
        formFactor: "tablet-portrait",
        hardwareConcurrency: 8,
        deviceMemory: 4,
      }),
    ).toBe("full");
  });

  it("never downgrades a desktop automatically", () => {
    expect(
      resolveEditorPerformanceProfile("automatic", {
        formFactor: "desktop",
        hardwareConcurrency: 2,
        deviceMemory: 1,
      }),
    ).toBe("full");
  });

  it("honors a reversible explicit profile choice", () => {
    const environment = {
      formFactor: "phone" as const,
      hardwareConcurrency: 2,
      deviceMemory: 1,
    };

    expect(resolveEditorPerformanceProfile("full", environment)).toBe("full");
    expect(resolveEditorPerformanceProfile("light", environment)).toBe("light");
  });
});

describe("renderPixelRatioForProfile", () => {
  it("caps Light Mode rendering at a 1x backing store", () => {
    expect(renderPixelRatioForProfile("light", 2)).toBe(1);
  });

  it("preserves full-quality device pixel ratio", () => {
    expect(renderPixelRatioForProfile("full", 2)).toBe(2);
  });
});
