import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  PdfEditorApplication,
  SequentialIdGenerator,
  type EditorSnapshot,
} from "../application/editor-application";
import { BrowserBeforeUnloadWarning } from "../infrastructure/browser/before-unload-warning";
import { BrowserLocalPdfFileReader } from "../infrastructure/browser/local-pdf-file-reader";
import { PdfJsEngine } from "../infrastructure/pdf/pdfjs-engine";
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

const createEditor = (): PdfEditorApplication =>
  new PdfEditorApplication(
    new BrowserLocalPdfFileReader({ maxBytes: 50 * 1024 * 1024 }),
    new PdfJsEngine(),
    new SequentialIdGenerator(),
  );

export const App = (): React.ReactElement => {
  const pathname = useSyncExternalStore(subscribeToNavigation, getPathname, getServerPathname);
  const editor = useMemo(() => createEditor(), []);
  const beforeUnload = useMemo(() => new BrowserBeforeUnloadWarning(), []);
  const [snapshot, setSnapshot] = useState<EditorSnapshot>(() => editor.snapshot());

  useEffect(() => {
    beforeUnload.setEnabled(snapshot.state.isDirty);
  }, [beforeUnload, snapshot.state.isDirty]);

  useEffect(
    () => () => {
      beforeUnload.dispose();
    },
    [beforeUnload],
  );

  const openEditor = (): void => {
    navigate("/editor");
  };
  const openHome = (): void => {
    navigate("/");
  };
  const requestHome = (): void => {
    if (pathname === "/editor" && editor.snapshot().state.isDirty) {
      setSnapshot(editor.requestClose());
      return;
    }
    navigate("/");
  };

  switch (pathname) {
    case "/":
      return (
        <Shell onHomeRequest={requestHome}>
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
        <Shell onHomeRequest={requestHome}>
          <EditorPage
            editor={editor}
            snapshot={snapshot}
            onSnapshotChange={setSnapshot}
            onDocumentClosed={openHome}
          />
        </Shell>
      );
    default:
      return (
        <Shell onHomeRequest={requestHome}>
          <NotFoundPage />
        </Shell>
      );
  }
};
