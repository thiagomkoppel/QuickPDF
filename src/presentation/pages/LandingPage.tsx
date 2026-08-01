import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";

import type { EditorSnapshot, PdfEditorApplication } from "../../application/editor-application";

const GITHUB_URL = "//github.com/";

const OPENING_STAGES = [
  "Opening document...",
  "Reading pages...",
  "Preparing workspace...",
] as const;

interface LandingPageProps {
  readonly editor: PdfEditorApplication;
  readonly snapshot: EditorSnapshot;
  readonly onSnapshotChange: (snapshot: EditorSnapshot) => void;
  readonly onDocumentOpened: () => void;
}

export const LandingPage = ({
  editor,
  snapshot,
  onSnapshotChange,
  onDocumentOpened,
}: LandingPageProps): React.ReactElement => {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [openingStage, setOpeningStage] = useState(0);
  const [openingFileName, setOpeningFileName] = useState<string>();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const updateMotionPreference = (): void => {
      setPrefersReducedMotion(mediaQuery.matches);
    };
    mediaQuery.addEventListener("change", updateMotionPreference);
    return () => {
      mediaQuery.removeEventListener("change", updateMotionPreference);
    };
  }, []);

  useEffect(() => {
    if (!isOpening || prefersReducedMotion) {
      return undefined;
    }

    const readingTimer = window.setTimeout(() => {
      setOpeningStage(1);
    }, 650);
    const workspaceTimer = window.setTimeout(() => {
      setOpeningStage(2);
    }, 1300);
    return () => {
      window.clearTimeout(readingTimer);
      window.clearTimeout(workspaceTimer);
    };
  }, [isOpening, prefersReducedMotion]);

  const openFile = async (file: File | undefined): Promise<void> => {
    if (file === undefined || isOpening) {
      return;
    }

    dragDepthRef.current = 0;
    setIsDragActive(false);
    setOpeningFileName(file.name);
    setOpeningStage(0);
    setIsOpening(true);

    try {
      const nextSnapshot = await editor.openFile(file);
      onSnapshotChange(nextSnapshot);
      if (nextSnapshot.state.status === "ready") {
        onDocumentOpened();
      }
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
    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const openPicker = (): void => inputRef.current?.click();

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  };

  const isError = snapshot.state.error !== undefined && !isOpening;
  const openingCopy = OPENING_STAGES[openingStage];

  return (
    <section className="landing-page" aria-labelledby="landing-title">
      <div className="landing-hero">
        <p className="landing-eyebrow">Private PDF workspace</p>
        <h1 id="landing-title">Edit PDFs in seconds.</h1>
        <p className="landing-subtitle">Your files never leave your browser.</p>
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
          onClick={openPicker}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={handleDrop}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={isOpening ? -1 : 0}
        >
          <span aria-hidden="true" className="file-drop-icon">
            <span />
            <span />
            <span />
          </span>
          {isOpening ? (
            <span className="file-drop-opening" role="status">
              <strong>{openingCopy}</strong>
              <span>{openingFileName}</span>
              <small>Processing locally in your browser</small>
            </span>
          ) : (
            <span className="file-drop-copy">
              <strong>{isDragActive ? "Release to open your PDF" : "Drop your PDF here"}</strong>
              <span>
                {isDragActive
                  ? "Your file stays in this browser session."
                  : "or choose a file from your device"}
              </span>
              <small id="drop-zone-support">Your document never leaves this browser session.</small>
            </span>
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
        <ul aria-label="QuickPDF privacy promises" className="landing-badges">
          <li>Browser Only</li>
          <li>Private</li>
          <li>Free</li>
        </ul>
      </div>
      <footer className="landing-footer" id="privacy">
        <span>Privacy</span>
        <a href={GITHUB_URL} rel="noreferrer" target="_blank">
          GitHub
        </a>
        <span>Version 0.1</span>
      </footer>
    </section>
  );
};
