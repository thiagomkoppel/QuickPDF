export interface QuickPdfBuildMetadata {
  readonly version: string;
  readonly sha: string;
  readonly branch: string;
  readonly mode: "development" | "production";
}

export interface QuickPdfBuildMetadataOptions {
  readonly mode?: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly gitValue?: (argumentsList: readonly string[]) => string | undefined;
}

export const resolveQuickPdfBuildMetadata: (
  options?: QuickPdfBuildMetadataOptions,
) => QuickPdfBuildMetadata;
