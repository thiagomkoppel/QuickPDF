import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import {
  PdfEditorApplication,
  SequentialIdGenerator,
  type EditorSnapshot,
} from "../application/editor-application";
import { BrowserDownloadAdapter } from "../infrastructure/browser/browser-download-adapter";
import { BrowserLocalPdfFileReader } from "../infrastructure/browser/local-pdf-file-reader";
import {
  preflightPdfJsCompatibility,
  type PdfJsCompatibilityResult,
} from "../infrastructure/browser/browser-compatibility";
import { PdfJsPageRenderer } from "../infrastructure/pdf/pdfjs-page-renderer";
import { PdfLibExportGateway } from "../infrastructure/pdf/pdf-lib-export-gateway";
import { PdfRasterCompressionGateway } from "../infrastructure/pdf/pdf-raster-compression-gateway";
import { Shell } from "../presentation/components/Shell";
import { PwaInstallProvider } from "../presentation/components/use-pwa-install";
import { EditorPage } from "../presentation/pages/EditorPage";
import { LandingPage } from "../presentation/pages/LandingPage";
import { NotFoundPage } from "../presentation/pages/NotFoundPage";
import { PrivacyPolicyPage } from "../presentation/pages/PrivacyPolicyPage";
import { StartupScreen, type StartupStage } from "../presentation/pages/StartupScreen";

declare global {
  interface Window {
    __quickpdfCompatibilityResult__?: PdfJsCompatibilityResult;
  }
}

const STARTUP_MINIMUM_DURATION_MS = 5_000;
const CHROME_UPDATE_URL = "https:" + "//www.google.com/chrome/update/";

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

const navigate = (href: string, replace = false): void => {
  if (replace) {
    window.history.replaceState({}, "", href);
  } else {
    window.history.pushState({}, "", href);
  }
  window.dispatchEvent(new Event("quickpdf:navigation"));
};

const RedirectToLanding = (): null => {
  useLayoutEffect(() => {
    navigate("/", true);
  }, []);

  return null;
};

export type PdfJsCompatibilityProbe = () => Promise<PdfJsCompatibilityResult>;

type PdfJsCompatibleResult = Extract<PdfJsCompatibilityResult, { readonly status: "compatible" }>;
type PdfJsIncompatibleResult = Extract<
  PdfJsCompatibilityResult,
  { readonly status: "incompatible" }
>;
type PdfJsIndeterminateResult = Extract<
  PdfJsCompatibilityResult,
  { readonly status: "indeterminate" }
>;

export type AppBootstrapState =
  | { readonly status: "checking"; readonly stage: StartupStage }
  | { readonly status: "compatible"; readonly result: PdfJsCompatibleResult }
  | { readonly status: "incompatible"; readonly result: PdfJsIncompatibleResult }
  | { readonly status: "indeterminate"; readonly result?: PdfJsIndeterminateResult };

interface AppProps {
  readonly compatibilityProbe?: PdfJsCompatibilityProbe;
  readonly initialCompatibilityResult?: PdfJsCompatibilityResult;
  /** Explicit test seam; production uses the required five-second minimum. */
  readonly startupMinimumDurationMs?: number;
}

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
      undefined,
      new PdfRasterCompressionGateway(),
    ),
  };
};

const indeterminateCompatibility = (): Extract<
  PdfJsCompatibilityResult,
  { readonly status: "indeterminate" }
> => ({
  status: "indeterminate",
  diagnostics: {
    missingRequiredApis: [],
    canvasAvailable: false,
    moduleLoaded: false,
    workerInitialized: false,
    renderProbeCompleted: false,
  },
});

const toBootstrapState = (result: PdfJsCompatibilityResult): AppBootstrapState => {
  switch (result.status) {
    case "compatible":
      return { status: "compatible", result };
    case "incompatible":
      return { status: "incompatible", result };
    case "indeterminate":
      return { status: "indeterminate" };
  }
};

const BrowserCompatibilityPage = ({
  compatibility,
}: {
  readonly compatibility: Extract<PdfJsCompatibilityResult, { readonly status: "incompatible" }>;
}): React.ReactElement => (
  <Shell>
    <section className="landing-page" aria-labelledby="browser-compatibility-title">
      <div className="landing-hero">
        <section className="browser-compatibility-panel" role="alert">
          <h1 id="browser-compatibility-title">Browser not supported</h1>
          <p>This browser cannot reliably display PDFs in QuickPDF.</p>
          <p>Check your browser support or open QuickPDF on another device.</p>
          {compatibility.diagnostics.missingRequiredApis.length > 0 ? (
            <p>
              Missing required browser capability:{" "}
              {compatibility.diagnostics.missingRequiredApis.join(", ")}
            </p>
          ) : null}
          <div className="browser-compatibility-actions">
            <a href={CHROME_UPDATE_URL} rel="noreferrer" target="_blank">
              Check for browser updates
            </a>
          </div>
        </section>
      </div>
    </section>
  </Shell>
);

const AppContent = ({
  compatibilityProbe = preflightPdfJsCompatibility,
  initialCompatibilityResult,
  startupMinimumDurationMs = STARTUP_MINIMUM_DURATION_MS,
}: AppProps): React.ReactElement => {
  const pathname = useSyncExternalStore(subscribeToNavigation, getPathname, getServerPathname);
  const { editor, pdfRenderer } = useMemo(() => createEditorServices(), []);
  const [snapshot, setSnapshot] = useState<EditorSnapshot>(() => editor.snapshot());
  const resolvedInitialCompatibilityResult =
    initialCompatibilityResult ?? window.__quickpdfCompatibilityResult__;
  const compatibilityProbeRef = useRef(compatibilityProbe);
  const resolvedInitialResultRef = useRef(resolvedInitialCompatibilityResult);
  const [bootstrap, setBootstrap] = useState<AppBootstrapState>(() =>
    resolvedInitialCompatibilityResult !== undefined && startupMinimumDurationMs === 0
      ? toBootstrapState(resolvedInitialCompatibilityResult)
      : { status: "checking", stage: "initializing" },
  );

  useEffect(() => {
    document.getElementById("quickpdf-boot-fallback")?.remove();
  }, []);

  useEffect(
    () => () => {
      editor.closeDocument();
    },
    [editor],
  );

  useEffect(() => {
    if (bootstrap.status !== "checking") return undefined;
    let disposed = false;
    const duration = Math.max(0, startupMinimumDurationMs);
    const stages: readonly StartupStage[] = [
      "loading-renderer",
      "checking-worker",
      "testing-render",
      "finalizing",
    ];
    const stageTimers = stages.map((stage, index) =>
      window.setTimeout(
        () => {
          if (!disposed) setBootstrap({ status: "checking", stage });
        },
        Math.round(duration * ((index + 1) / (stages.length + 1))),
      ),
    );
    const probe =
      resolvedInitialResultRef.current === undefined
        ? compatibilityProbeRef.current()
        : Promise.resolve(resolvedInitialResultRef.current);
    const minimumDuration = new Promise<void>((resolve) => {
      window.setTimeout(resolve, duration);
    });

    void Promise.all([probe.catch(indeterminateCompatibility), minimumDuration]).then(
      ([compatibility]) => {
        if (!disposed) setBootstrap(toBootstrapState(compatibility));
      },
    );

    return () => {
      disposed = true;
      stageTimers.forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, [bootstrap.status, startupMinimumDurationMs]);

  const openEditor = (): void => {
    navigate("/editor");
  };

  if (bootstrap.status === "checking") {
    return <StartupScreen stage={bootstrap.stage} />;
  }

  if (bootstrap.status === "incompatible") {
    return <BrowserCompatibilityPage compatibility={bootstrap.result} />;
  }

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
    case "/privacy":
      return (
        <Shell hideHeader>
          <PrivacyPolicyPage />
        </Shell>
      );
    case "/editor":
      if (snapshot.state.status === "empty") {
        return <RedirectToLanding />;
      }
      return (
        <Shell hideHeader>
          <EditorPage
            editor={editor}
            snapshot={snapshot}
            onSnapshotChange={setSnapshot}
            pdfRenderer={pdfRenderer}
            onOpenRequest={() => {
              navigate("/");
            }}
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

export const App = (props: AppProps): React.ReactElement => (
  <PwaInstallProvider>
    <AppContent {...props} />
  </PwaInstallProvider>
);
