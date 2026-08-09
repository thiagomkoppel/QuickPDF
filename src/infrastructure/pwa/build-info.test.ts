import packageJson from "../../../package.json";
import { describe, expect, it } from "vitest";

import { QUICKPDF_BUILD, formatQuickPdfBuildLabel } from "./build-info";

describe("QuickPDF build identity", () => {
  it("uses the package semantic version and formats a non-sensitive runtime label", () => {
    expect(QUICKPDF_BUILD.version).toBe(packageJson.version);
    expect(formatQuickPdfBuildLabel(QUICKPDF_BUILD)).toBe(
      `v${QUICKPDF_BUILD.version}${QUICKPDF_BUILD.mode === "development" ? "-dev" : ""} - ${QUICKPDF_BUILD.sha}`,
    );
    expect(JSON.stringify(QUICKPDF_BUILD)).not.toMatch(/pdf|document|filename|signature/i);
  });
});
