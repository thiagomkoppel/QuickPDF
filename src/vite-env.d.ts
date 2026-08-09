/// <reference types="vite/client" />

interface QuickPdfInjectedBuild {
  readonly version: string;
  readonly sha: string;
  readonly branch: string;
  readonly mode: "development" | "production";
}

declare const __QUICKPDF_BUILD__: QuickPdfInjectedBuild;

declare module "pdfjs-dist/build/pdf.worker.mjs?url" {
  const workerUrl: string;
  export default workerUrl;
}
