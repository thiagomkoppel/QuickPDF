import { useMemo, useState, useSyncExternalStore } from "react";

import { PdfViewerApplication, type PdfViewerSnapshot } from "../application/pdf-viewer";
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

const createViewerApplication = (): PdfViewerApplication =>
  new PdfViewerApplication(
    new BrowserLocalPdfFileReader({ maxBytes: 50 * 1024 * 1024 }),
    new PdfJsEngine(),
  );

const renderRoute = (
  pathname: string,
  viewer: PdfViewerApplication,
  snapshot: PdfViewerSnapshot,
  setSnapshot: (snapshot: PdfViewerSnapshot) => void,
): React.ReactNode => {
  switch (pathname) {
    case "/":
      return (
        <LandingPage
          viewer={viewer}
          snapshot={snapshot}
          onSnapshotChange={setSnapshot}
          onDocumentOpened={() => {
            navigate("/editor");
          }}
        />
      );
    case "/editor":
      return (
        <EditorPage
          viewer={viewer}
          snapshot={snapshot}
          onSnapshotChange={setSnapshot}
          onDocumentClosed={() => {
            navigate("/");
          }}
        />
      );
    default:
      return <NotFoundPage />;
  }
};

export const App = (): React.ReactElement => {
  const pathname = useSyncExternalStore(subscribeToNavigation, getPathname, getServerPathname);
  const viewer = useMemo(() => createViewerApplication(), []);
  const [snapshot, setSnapshot] = useState(() => viewer.snapshot());

  return <Shell>{renderRoute(pathname, viewer, snapshot, setSnapshot)}</Shell>;
};
