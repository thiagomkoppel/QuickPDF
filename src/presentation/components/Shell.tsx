import type { MouseEvent, ReactNode } from "react";

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
        QuickPDF home
      </a>
      <nav aria-label="Primary" className="primary-nav">
        <a href="/" onClick={handleInternalNavigation("/")}>
          Open local PDF
        </a>
      </nav>
    </header>
    <main id="main-content" className="main-content" tabIndex={-1}>
      {children}
    </main>
  </div>
);
