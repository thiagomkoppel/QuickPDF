export interface QuickPdfBuildInfo {
  readonly version: string;
  readonly sha: string;
  readonly branch: string;
  readonly mode: "development" | "production";
}

export const QUICKPDF_BUILD: QuickPdfBuildInfo = __QUICKPDF_BUILD__;

export const formatQuickPdfBuildLabel = (build: QuickPdfBuildInfo = QUICKPDF_BUILD): string =>
  `v${build.version}${build.mode === "development" ? "-dev" : ""} - ${build.sha}`;
