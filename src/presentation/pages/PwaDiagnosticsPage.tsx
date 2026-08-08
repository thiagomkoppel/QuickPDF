import { useEffect, useState } from "react";

import {
  collectQuickPdfPwaDiagnostics,
  type QuickPdfPwaDiagnostics,
} from "../../infrastructure/pwa/pwa-diagnostics";

interface PwaDiagnosticsPageProps {
  readonly bootstrapStatus: "compatible" | "indeterminate";
}

const unavailable = "Unavailable";

type DiagnosticRow = readonly [label: string, value: string];

const toRows = (
  diagnostics: QuickPdfPwaDiagnostics,
  bootstrapStatus: PwaDiagnosticsPageProps["bootstrapStatus"],
): readonly DiagnosticRow[] => [
  ["Location", diagnostics.location],
  ["Bootstrap", bootstrapStatus],
  ["Standalone", diagnostics.standalone ? "Yes" : "No"],
  ["Navigator standalone", diagnostics.navigatorStandalone ? "Yes" : "No"],
  ["Display-mode standalone", diagnostics.displayModeStandalone ? "Yes" : "No"],
  ["Online", diagnostics.online ? "Yes" : "No"],
  ["Service worker supported", diagnostics.serviceWorkerSupported ? "Yes" : "No"],
  ["Controller", diagnostics.controllerScriptUrl ?? unavailable],
  ["Registration scope", diagnostics.registrationScope ?? unavailable],
  ["Active worker", diagnostics.activeWorkerState ?? unavailable],
  ["Waiting worker", diagnostics.waitingWorkerState ?? unavailable],
  ["Installing worker", diagnostics.installingWorkerState ?? unavailable],
  ["Shell caches", diagnostics.cacheNames.join(", ") || unavailable],
  ["Current shell cache", diagnostics.shellCacheName ?? unavailable],
  ["Cached navigation key", diagnostics.cachedNavigationResponse?.cacheKey ?? unavailable],
  ["Cached navigation URL", diagnostics.cachedNavigationResponse?.responseUrl ?? unavailable],
  [
    "Cached navigation status",
    diagnostics.cachedNavigationResponse?.status.toString() ?? unavailable,
  ],
  ["Cached navigation type", diagnostics.cachedNavigationResponse?.type ?? unavailable],
  [
    "Cached navigation redirected",
    diagnostics.cachedNavigationResponse === undefined
      ? unavailable
      : diagnostics.cachedNavigationResponse.redirected
        ? "Yes"
        : "No",
  ],
  [
    "Cached navigation content type",
    diagnostics.cachedNavigationResponse?.contentType ?? unavailable,
  ],
  ["Cached index", diagnostics.shellHasIndex ? "Yes" : "No"],
  ["Cached main script", diagnostics.shellHasMainScript ? "Yes" : "No"],
  ["Cached stylesheet", diagnostics.shellHasMainStylesheet ? "Yes" : "No"],
  ["Cached PDF.js worker", diagnostics.shellHasPdfWorker ? "Yes" : "No"],
  ["Cached Patrick Hand", diagnostics.shellHasPatrickHand ? "Yes" : "No"],
  ["Cached manifest", diagnostics.shellHasManifest ? "Yes" : "No"],
  ["Manifest id", diagnostics.manifest?.id ?? unavailable],
  ["Manifest start URL", diagnostics.manifest?.start_url ?? unavailable],
  ["Manifest scope", diagnostics.manifest?.scope ?? unavailable],
];

export const PwaDiagnosticsPage = ({
  bootstrapStatus,
}: PwaDiagnosticsPageProps): React.ReactElement => {
  const [diagnostics, setDiagnostics] = useState<QuickPdfPwaDiagnostics>();
  const [isTextVisible, setIsTextVisible] = useState(false);

  useEffect(() => {
    let disposed = false;
    void collectQuickPdfPwaDiagnostics().then((result) => {
      if (!disposed) setDiagnostics(result);
    });
    return () => {
      disposed = true;
    };
  }, []);

  const rows = diagnostics === undefined ? [] : toRows(diagnostics, bootstrapStatus);
  const diagnosticsText = rows.map(([label, value]) => `${label}: ${value}`).join("\n");

  return (
    <section aria-labelledby="pwa-diagnostics-title" className="pwa-diagnostics-page">
      <div className="pwa-diagnostics-page__content">
        <h1 id="pwa-diagnostics-title">QuickPDF diagnostics</h1>
        <p>Temporary installation diagnostics. No document or user data is shown.</p>
        {diagnostics === undefined ? (
          <p aria-live="polite" role="status">
            Reading application shell status...
          </p>
        ) : (
          <>
            <dl>
              {rows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              onClick={() => {
                setIsTextVisible((visible) => !visible);
              }}
            >
              {isTextVisible ? "Hide diagnostics text" : "Show diagnostics text"}
            </button>
            {isTextVisible ? <pre aria-label="Diagnostics text">{diagnosticsText}</pre> : null}
          </>
        )}
        <a
          className="pwa-diagnostics-page__back"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            window.history.pushState({}, "", "/");
            window.dispatchEvent(new Event("quickpdf:navigation"));
          }}
        >
          Back to QuickPDF
        </a>
      </div>
    </section>
  );
};
