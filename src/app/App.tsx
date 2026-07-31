import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  PdfEditorApplication,
  SequentialIdGenerator,
  type EditorSnapshot,
} from "../application/editor-application";
import { BrowserDownloadAdapter } from "../infrastructure/browser/browser-download-adapter";
import { BrowserLocalPdfFileReader } from "../infrastructure/browser/local-pdf-file-reader";
import { PdfJsPageRenderer } from "../infrastructure/pdf/pdfjs-page-renderer";
import { PdfLibExportGateway } from "../infrastructure/pdf/pdf-lib-export-gateway";
import { Shell } from "../presentation/components/Shell";
import { EditorPage } from "../presentation/pages/EditorPage";
import { LandingPage } from "../presentation/pages/LandingPage";
import { NotFoundPage } from "../presentation/pages/NotFoundPage";

const getPathname = (): string => window.location.pathname;

const subscribeToNavigation = (onStoreChange: () => void): (() => void) => {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("quickpdf:navigation", onStoreChange);

  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("quickpdf:navigation", onStoreChange);
  };
};

const getServerPathname = (): string => "/";

const navigate = (href: string): void => {
  window.history.pushState({}, "", href);
  window.dispatchEvent(new Event("quickpdf:navigation"));
};

interface EditorServices {
  readonly editor: PdfEditorApplication;
  readonly pdfRenderer: PdfJsPageRenderer;
}

const createEditorServices = (): EditorServices => {
  const pdfRenderer = new PdfJsPageRenderer();
  return {
    pdfRenderer,
    editor: new PdfEditorApplication(
      new BrowserLocalPdfFileReader(),
      new PdfLibExportGateway(),
      new BrowserDownloadAdapter(),
      new SequentialIdGenerator(),
      pdfRenderer,
    ),
  };
};

export const App = (): React.ReactElement => {
  const pathname = useSyncExternalStore(subscribeToNavigation, getPathname, getServerPathname);
  const { editor, pdfRenderer } = useMemo(() => createEditorServices(), []);
  const [snapshot, setSnapshot] = useState<EditorSnapshot>(() => editor.snapshot());

  useEffect(
    () => () => {
      editor.closeDocument();
    },
    [editor],
  );

  const openEditor = (): void => {
    navigate("/editor");
  };

  switch (pathname) {
    case "/":
      return (
        <Shell>
          <LandingPage
            editor={editor}
            snapshot={snapshot}
            onSnapshotChange={setSnapshot}
            onDocumentOpened={openEditor}
          />
        </Shell>
      );
    case "/editor":
      return (
        <Shell>
          <EditorPage
            editor={editor}
            snapshot={snapshot}
            onSnapshotChange={setSnapshot}
            pdfRenderer={pdfRenderer}
          />
        </Shell>
      );
    default:
      return (
        <Shell>
          <NotFoundPage />
        </Shell>
      );
  }
};
