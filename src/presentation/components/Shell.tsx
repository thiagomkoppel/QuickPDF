import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import quickPdfMark from "../assets/brand/quickpdf-mark.svg";

import { PwaInstallBoundary, usePwaInstall } from "./use-pwa-install";

const GITHUB_URL = "https:" + "//github.com/thiagomkoppel/QuickPDF";

interface ShellProps {
  readonly children: ReactNode;
  readonly hideHeader?: boolean;
}

const navigate = (href: string): void => {
  window.history.pushState({}, "", href);
  window.dispatchEvent(new Event("quickpdf:navigation"));
};

const handleInternalNavigation =
  (href: string) =>
  (event: MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault();
    navigate(href);
  };

const ShellContent = ({ children, hideHeader = false }: ShellProps): React.ReactElement => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const install = usePwaInstall();
  const menuRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const installSheetActionRef = useRef<HTMLButtonElement>(null);
  const dismissInstructions = install.dismissInstructions;
  const canInstall =
    install.availability === "chromium-prompt" || install.availability === "ios-instructions";

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;
    const menuButton = menuButtonRef.current;
    const closeOnPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (
        target instanceof Node &&
        !menuRef.current?.contains(target) &&
        !menuButtonRef.current?.contains(target)
      ) {
        setIsMobileMenuOpen(false);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    menuRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
      menuButton?.focus();
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!install.isInstructionsOpen) return undefined;
    const menuButton = menuButtonRef.current;
    const closeOnEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismissInstructions();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    installSheetActionRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      menuButton?.focus();
    };
  }, [dismissInstructions, install.isInstructionsOpen]);

  const trapMobileMenuFocus = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button, a")];
    const first = controls[0];
    const last = controls.at(-1);
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const requestInstall = (): void => {
    setIsMobileMenuOpen(false);
    void install.requestInstall();
  };

  return (
    <div
      className={`app-shell${install.isStandalone ? " is-standalone" : ""}`}
      data-standalone={install.isStandalone}
    >
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      {hideHeader ? null : (
        <header className="site-header">
          <a
            className="brand-link"
            href="/"
            aria-label="QuickPDF"
            onClick={handleInternalNavigation("/")}
          >
            <img src={quickPdfMark} alt="QuickPDF" />
            <span aria-hidden="true">QuickPDF</span>
          </a>
          <button
            ref={menuButtonRef}
            type="button"
            className="mobile-site-menu-button"
            aria-label="Open site menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-site-menu"
            onClick={() => {
              setIsMobileMenuOpen((open) => !open);
            }}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
          <nav
            ref={menuRef}
            id="mobile-site-menu"
            aria-label="Primary"
            className={`primary-nav${isMobileMenuOpen ? " is-mobile-menu-open" : ""}`}
            onKeyDown={trapMobileMenuFocus}
          >
            {canInstall ? (
              <button className="primary-nav__install" type="button" onClick={requestInstall}>
                Install QuickPDF
              </button>
            ) : null}
            <a
              className="primary-nav__privacy"
              href="/privacy"
              onClick={(event) => {
                handleInternalNavigation("/privacy")(event);
                setIsMobileMenuOpen(false);
              }}
            >
              Privacy
            </a>
            <a
              className="primary-nav__github"
              href={GITHUB_URL}
              rel="noreferrer"
              target="_blank"
              onClick={() => {
                setIsMobileMenuOpen(false);
              }}
            >
              GitHub
            </a>
          </nav>
        </header>
      )}
      {install.isInstructionsOpen ? (
        <div
          className="ios-install-sheet-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) install.dismissInstructions();
          }}
        >
          <section
            aria-labelledby="ios-install-title"
            aria-modal="true"
            className="ios-install-sheet"
            role="dialog"
          >
            <div aria-hidden="true" className="ios-install-sheet__handle" />
            <h2 id="ios-install-title">Install QuickPDF</h2>
            <ol>
              <li>
                Tap the{" "}
                <span aria-hidden="true" className="ios-install-sheet__share-icon">
                  ↑
                </span>{" "}
                Share button in Safari.
              </li>
              <li>Choose “Add to Home Screen.”</li>
              <li>Tap “Add.”</li>
            </ol>
            <button ref={installSheetActionRef} type="button" onClick={install.dismissInstructions}>
              Got it
            </button>
          </section>
        </div>
      ) : null}
      <main id="main-content" className="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
};

export const Shell = (props: ShellProps): React.ReactElement => (
  <PwaInstallBoundary>
    <ShellContent {...props} />
  </PwaInstallBoundary>
);
