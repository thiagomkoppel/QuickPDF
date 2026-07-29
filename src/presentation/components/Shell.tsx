import type { MouseEvent, ReactNode } from "react";

interface ShellProps {
  readonly children: ReactNode;
  readonly onHomeRequest: () => void;
}

export const Shell = ({ children, onHomeRequest }: ShellProps): React.ReactElement => {
  const handleHome = (event: MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault();
    onHomeRequest();
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="site-header">
        <a className="brand-link" href="/" onClick={handleHome}>
          QuickPDF home
        </a>
        <nav aria-label="Primary" className="primary-nav">
          <a href="/" onClick={handleHome}>
            Open local PDF
          </a>
        </nav>
      </header>
      <main id="main-content" className="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
};
