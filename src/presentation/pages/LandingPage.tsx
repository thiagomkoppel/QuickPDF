import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";

import type { EditorSnapshot, PdfEditorApplication } from "../../application/editor-application";
import {
  preflightPdfJsCompatibility,
  type PdfJsCompatibilityResult,
} from "../../infrastructure/browser/browser-compatibility";

const GITHUB_URL = "https:" + "//github.com/thiagomkoppel/QuickPDF";
const CHROME_UPDATE_URL = "https:" + "//www.google.com/chrome/update/";
const MINIMUM_OPENING_DURATION_MS = 5_000;
const OPENING_STAGES = [
  "Reading PDF...",
  "Preparing pages...",
  "Building workspace...",
  "Opening editor...",
] as const;

type CompatibilityPreflight =
  | { readonly status: "checking" }
  | { readonly status: "complete"; readonly result: PdfJsCompatibilityResult };
interface LandingPageProps {
  readonly editor: PdfEditorApplication;
  readonly snapshot: EditorSnapshot;
  readonly onSnapshotChange: (snapshot: EditorSnapshot) => void;
  readonly onDocumentOpened: () => void;
  readonly compatibilityCheck?: () => Promise<PdfJsCompatibilityResult>;
  readonly initialCompatibilityResult?: PdfJsCompatibilityResult;
}

const sleep = (duration: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, duration));

export const LandingPage = ({
  editor,
  snapshot,
  onSnapshotChange,
  onDocumentOpened,
  compatibilityCheck = preflightPdfJsCompatibility,
  initialCompatibilityResult,
}: LandingPageProps): React.ReactElement => {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const compatibilityCheckRef = useRef(compatibilityCheck);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [compatibilityPreflight, setCompatibilityPreflight] = useState<CompatibilityPreflight>(
    () =>
      initialCompatibilityResult === undefined
        ? { status: "checking" }
        : { status: "complete", result: initialCompatibilityResult },
  );
  const [openingStage, setOpeningStage] = useState(0);
  const [openingFileName, setOpeningFileName] = useState<string>();
  const [isPhoneLayout, setIsPhoneLayout] = useState(
    () => window.matchMedia("(max-width: 767px)").matches,
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    let disposed = false;
    void compatibilityCheckRef
      .current()
      .then((result) => {
        if (!disposed) setCompatibilityPreflight({ status: "complete", result });
      })
      .catch(() => {
        if (!disposed) {
          setCompatibilityPreflight({
            status: "complete",
            result: {
              status: "indeterminate",
              diagnostics: {
                missingRequiredApis: [],
                canvasAvailable: false,
                moduleLoaded: false,
                workerInitialized: false,
                renderProbeCompleted: false,
              },
            },
          });
        }
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const update = (): void => {
      setIsPhoneLayout(mediaQuery.matches);
    };
    mediaQuery.addEventListener("change", update);
    return () => {
      mediaQuery.removeEventListener("change", update);
    };
  }, []);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (): void => {
      setPrefersReducedMotion(mediaQuery.matches);
    };
    mediaQuery.addEventListener("change", update);
    return () => {
      mediaQuery.removeEventListener("change", update);
    };
  }, []);
  useEffect(() => {
    if (!isOpening || prefersReducedMotion) return undefined;
    const timers = [1_250, 2_500, 3_750].map((delay, index) =>
      window.setTimeout(() => {
        setOpeningStage(index + 1);
      }, delay),
    );
    return () => {
      timers.forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, [isOpening, prefersReducedMotion]);

  const openFile = async (file: File | undefined): Promise<void> => {
    if (
      compatibilityPreflight.status !== "complete" ||
      compatibilityPreflight.result.status === "incompatible" ||
      file === undefined ||
      isOpening
    )
      return;
    dragDepthRef.current = 0;
    setIsDragActive(false);
    setOpeningFileName(file.name);
    setOpeningStage(0);
    setIsOpening(true);
    const startedAt = performance.now();
    try {
      const nextSnapshot = await editor.openFile(file);
      onSnapshotChange(nextSnapshot);
      if (nextSnapshot.state.status !== "ready") return;
      const remaining = Math.max(0, MINIMUM_OPENING_DURATION_MS - (performance.now() - startedAt));
      if (remaining > 0) await sleep(remaining);
      setOpeningStage(3);
      onDocumentOpened();
    } finally {
      setIsOpening(false);
    }
  };
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    void openFile(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length !== 1) {
      dragDepthRef.current = 0;
      setIsDragActive(false);
      return;
    }
    void openFile(files[0]);
  };
  const handleDragEnter = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    if (!isOpening && event.dataTransfer.types.includes("Files")) {
      dragDepthRef.current += 1;
      setIsDragActive(true);
    }
  };
  const handleDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragActive(false);
  };
  const navigateToPrivacy = (event: MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault();
    window.history.pushState({}, "", "/privacy");
    window.dispatchEvent(new Event("quickpdf:navigation"));
  };
  const openPicker = (): void => {
    inputRef.current?.click();
  };
  const handlePickerAction = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    openPicker();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  };

  const incompatiblePreflight =
    compatibilityPreflight.status === "complete" &&
    compatibilityPreflight.result.status === "incompatible"
      ? compatibilityPreflight.result
      : undefined;

  const isError = snapshot.state.error !== undefined && !isOpening;
  const visibleOpeningStage = prefersReducedMotion ? 3 : openingStage;
  const openingProgress = `${String((visibleOpeningStage + 1) * 25)}%`;

  return (
    <section className="landing-page" aria-labelledby="landing-title">
      <div className="landing-hero">
        <div aria-hidden="true" className="landing-hero-icon">
          <span />
          <span />
          <span />
        </div>
        <p className="landing-eyebrow">
          <span className="landing-eyebrow-desktop">Private PDF workspace</span>
          <span className="landing-eyebrow-mobile">Private &amp; Secure</span>
        </p>
        <h1 id="landing-title">
          <span className="landing-title-desktop">Edit PDFs in seconds.</span>
          <span className="landing-title-mobile">
            Edit PDFs
            <br />
            quickly.
          </span>
        </h1>
        <p className="landing-subtitle">
          <span className="landing-subtitle-desktop">Your files never leave your browser.</span>
          <span className="landing-subtitle-mobile">Private, browser-only editing.</span>
        </p>
        {compatibilityPreflight.status === "checking" ? (
          <div aria-live="polite" className="landing-compatibility-checking" role="status">
            Checking browser support...
          </div>
        ) : incompatiblePreflight !== undefined ? (
          <section
            aria-labelledby="browser-compatibility-title"
            className="browser-compatibility-panel"
            role="alert"
          >
            <h2 id="browser-compatibility-title">Browser not supported</h2>
            <p>This browser cannot reliably display PDFs in QuickPDF.</p>
            <p>
              Check your browser support or open QuickPDF on another device. open QuickPDF on
              another device.
            </p>
            {incompatiblePreflight.diagnostics.missingRequiredApis.length > 0 ? (
              <p>
                Missing required browser capability:{" "}
                {incompatiblePreflight.diagnostics.missingRequiredApis.join(", ")}
              </p>
            ) : null}
            <div className="browser-compatibility-actions">
              <a href={CHROME_UPDATE_URL} rel="noreferrer" target="_blank">
                Check for browser updates
              </a>
            </div>
          </section>
        ) : (
          <>
            {" "}
            <input
              ref={inputRef}
              aria-label="Choose a PDF file"
              className="visually-hidden"
              disabled={isOpening}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleChange}
            />
            <div
              aria-busy={isOpening}
              aria-describedby="drop-zone-support"
              aria-label="Open a PDF file"
              className={`file-drop${isDragActive ? " is-drag-active" : ""}${isOpening ? " is-opening" : ""}${isError ? " has-error" : ""}`}
              onClick={isOpening ? undefined : openPicker}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={handleDrop}
              onKeyDown={isPhoneLayout ? undefined : handleKeyDown}
              role={isPhoneLayout ? undefined : "button"}
              tabIndex={isPhoneLayout || isOpening ? -1 : 0}
            >
              {isOpening ? (
                <span className="file-drop-opening" role="status">
                  <span aria-hidden="true" className="landing-loader" />
                  <strong>{OPENING_STAGES[visibleOpeningStage]}</strong>
                  <span>{openingFileName}</span>
                  <span
                    aria-label={`Opening progress ${openingProgress}`}
                    className="opening-progress"
                  >
                    <i style={{ width: openingProgress }} />
                  </span>
                  <small>Processing locally in your browser</small>
                </span>
              ) : (
                <>
                  <span aria-hidden="true" className="file-drop-upload-icon">
                    <span className="file-drop-upload-arrow">?</span>
                    <span className="file-drop-upload-pdf">PDF</span>
                  </span>
                  <span className="file-drop-copy">
                    <strong className="file-drop-desktop-copy">
                      {isDragActive ? "Release to open your PDF" : "Drop your PDF here"}
                    </strong>
                    <strong className="file-drop-mobile-copy">
                      {isDragActive ? "Release to open your PDF" : "Open a PDF"}
                    </strong>
                    <span className="file-drop-desktop-copy">
                      {isDragActive
                        ? "Your file stays in this browser session."
                        : "or choose a file from your device"}
                    </span>
                    <span className="file-drop-mobile-copy">
                      Choose a file from your device to start editing.
                    </span>
                    <small id="drop-zone-support" className="file-drop-desktop-copy">
                      Your document never leaves this browser session.
                    </small>
                  </span>
                  <span aria-hidden="true" className="file-drop-button">
                    Choose File
                  </span>
                  <div className="file-drop-mobile-actions">
                    <button type="button" onClick={handlePickerAction}>
                      Choose PDF
                    </button>
                    <span>or</span>
                    <button type="button" className="file-drop-browse" onClick={handlePickerAction}>
                      Browse files
                    </button>
                    <small>
                      Your file stays on this device.
                      <br />
                      We never upload or store your documents.
                    </small>
                  </div>
                </>
              )}
            </div>
            {isError ? (
              <div className="landing-error" role="alert">
                <strong>We could not open that PDF.</strong>
                <span>{snapshot.state.error.message}</span>
                <button type="button" onClick={openPicker}>
                  Try another PDF
                </button>
              </div>
            ) : null}
          </>
        )}
        <ul aria-label="QuickPDF privacy promises" className="landing-badges">
          <li>
            <b>?</b>
            <span>
              <strong>100% Private</strong>
              <small className="landing-badge-desktop">Stays in your browser</small>
              <small className="landing-badge-mobile">Your files never leave your browser</small>
            </span>
          </li>
          <li>
            <b>?</b>
            <span>
              <strong className="landing-badge-desktop">Fast &amp; Simple</strong>
              <strong className="landing-badge-mobile">No Uploads</strong>
              <small className="landing-badge-desktop">Edit in seconds</small>
              <small className="landing-badge-mobile">Everything stays on device</small>
            </span>
          </li>
          <li>
            <b>?</b>
            <span>
              <strong className="landing-badge-desktop">Your Control</strong>
              <strong className="landing-badge-mobile">100% Free</strong>
              <small className="landing-badge-desktop">No accounts, no tracking</small>
              <small className="landing-badge-mobile">
                No sign up
                <br />
                No limits
              </small>
            </span>
          </li>
        </ul>
      </div>
      <footer className="landing-footer" id="privacy">
        <span>
          <strong className="landing-footer-desktop">QuickPDF � Browser-Based PDF Editor</strong>
          <strong className="landing-footer-mobile">?&nbsp; Made with privacy in mind</strong>
        </span>
        <span>
          <a href="/privacy" onClick={navigateToPrivacy}>
            Privacy Policy
          </a>
          <a href={GITHUB_URL} rel="noreferrer" target="_blank">
            GitHub
          </a>
        </span>
      </footer>
    </section>
  );
};
