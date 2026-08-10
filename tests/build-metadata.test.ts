import packageJson from "../package.json";
import { describe, expect, it } from "vitest";

import { resolveQuickPdfBuildMetadata } from "../scripts/build-metadata.mjs";

describe("build metadata resolver", () => {
  it("uses package version and Git metadata for development", () => {
    const metadata = resolveQuickPdfBuildMetadata({
      mode: "development",
      environment: {},
      gitValue: (argumentsList) =>
        argumentsList.includes("--short=7") ? "abcdef123" : "release/1.0",
    });

    expect(metadata).toEqual({
      version: packageJson.version,
      sha: "abcdef1",
      branch: "release/1.0",
      mode: "development",
    });
  });
  it("keeps package version available when Git metadata is unavailable", () => {
    const metadata = resolveQuickPdfBuildMetadata({
      mode: "production",
      environment: {},
      gitValue: () => undefined,
    });

    expect(metadata.version).toBe(packageJson.version);
    expect(metadata.sha).toBe("unknown");
    expect(metadata.branch).toBe("unknown");
    expect(metadata.mode).toBe("production");
  });
});
