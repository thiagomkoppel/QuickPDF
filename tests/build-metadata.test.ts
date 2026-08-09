import { describe, expect, it } from "vitest";

import { resolveQuickPdfBuildMetadata } from "../scripts/build-metadata.mjs";

describe("build metadata resolver", () => {
  it("keeps package version available when Git metadata is unavailable", () => {
    const metadata = resolveQuickPdfBuildMetadata({
      mode: "production",
      environment: {},
      gitValue: () => undefined,
    });

    expect(metadata.version).toBe("0.0.0");
    expect(metadata.sha).toBe("unknown");
    expect(metadata.branch).toBe("unknown");
    expect(metadata.mode).toBe("production");
  });
});
