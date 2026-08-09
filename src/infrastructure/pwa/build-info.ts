export interface QuickPdfBuildInfo {
  readonly version: string;
  readonly sha: string;
  readonly branch: string;
  readonly mode: "development" | "production";
}

const testFallback: QuickPdfBuildInfo = {
  version: "0.0.0",
  sha: "local",
  branch: "local",
  mode: "development",
};

export const QUICKPDF_BUILD: QuickPdfBuildInfo =
  typeof __QUICKPDF_BUILD__ === "undefined" ? testFallback : __QUICKPDF_BUILD__;

export const formatQuickPdfBuildLabel = (build: QuickPdfBuildInfo = QUICKPDF_BUILD): string =>
  `v${build.version}${build.mode === "development" ? "-dev" : ""} - ${build.sha}`;
