import { useEffect, useState } from "react";

import {
  collectQuickPdfPwaDiagnostics,
  type QuickPdfPwaDiagnostics,
} from "../../infrastructure/pwa/pwa-diagnostics";

interface PwaDiagnosticsPageProps {
  readonly bootstrapStatus: "compatible" | "indeterminate";
}

const unavailable = "Unavailable";

export const PwaDiagnosticsPage = ({
  bootstrapStatus,
}: PwaDiagnosticsPageProps): React.ReactElement => {
  const [diagnostics, setDiagnostics] = useState<QuickPdfPwaDiagnostics>();

  useEffect(() => {
    let disposed = false;
    void collectQuickPdfPwaDiagnostics().then((result) => {
      if (!disposed) setDiagnostics(result);
    });
    return () => {
      disposed = true;
    };
  }, []);

  const rows =
    diagnostics === undefined
      ? []
      : [
          ["Location", diagnostics.location],
          ["Bootstrap", bootstrapStatus],
          ["Standalone", diagnostics.standalone ? "Yes" : "No"],
          ["Online", diagnostics.online ? "Yes" : "No"],
          ["Service worker supported", diagnostics.serviceWorkerSupported ? "Yes" : "No"],
          ["Controller", diagnostics.controllerScriptUrl ?? unavailable],
          ["Registration scope", diagnostics.registrationScope ?? unavailable],
          ["Active worker", diagnostics.activeWorkerState ?? unavailable],
          ["Waiting worker", diagnostics.waitingWorkerState ?? unavailable],
          ["Installing worker", diagnostics.installingWorkerState ?? unavailable],
          ["Shell cache", diagnostics.cacheNames.join(", ") || unavailable],
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
          <dl>
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        <a href="/">Return to QuickPDF</a>
      </div>
    </section>
  );
};
