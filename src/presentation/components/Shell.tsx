import type { MouseEvent, ReactNode } from "react";

import quickPdfLogo from "../assets/brand/quickpdf-logo.svg";

const GITHUB_URL = "https:" + "//github.com/";

interface ShellProps {
  readonly children: ReactNode;
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

export const Shell = ({ children }: ShellProps): React.ReactElement => (
  <div className="app-shell">
    <a className="skip-link" href="#main-content">
      Skip to main content
    </a>
    <header className="site-header">
      <a className="brand-link" href="/" onClick={handleInternalNavigation("/")}>
        <img src={quickPdfLogo} alt="QuickPDF" />
      </a>
      <nav aria-label="Primary" className="primary-nav">
        <a href="#privacy">Privacy</a>
        <a href={GITHUB_URL} rel="noreferrer" target="_blank">
          GitHub
        </a>
      </nav>
    </header>
    <main id="main-content" className="main-content" tabIndex={-1}>
      {children}
    </main>
  </div>
);
