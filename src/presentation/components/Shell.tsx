import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import quickPdfMark from "../assets/brand/quickpdf-mark.svg";

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

export const Shell = ({ children, hideHeader = false }: ShellProps): React.ReactElement => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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
    menuRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
      menuButton?.focus();
    };
  }, [isMobileMenuOpen]);

  const trapMobileMenuFocus = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== "Tab") return;
    const links = [...event.currentTarget.querySelectorAll<HTMLAnchorElement>("a")];
    const first = links[0];
    const last = links.at(-1);
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="app-shell">
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
            <a
              href="/privacy"
              onClick={(event) => {
                handleInternalNavigation("/privacy")(event);
                setIsMobileMenuOpen(false);
              }}
            >
              Privacy
            </a>
            <a
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
      <main id="main-content" className="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
};
