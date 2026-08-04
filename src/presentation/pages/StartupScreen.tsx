import quickPdfMark from "../assets/brand/quickpdf-mark.svg";

export type StartupStage =
  "initializing" | "loading-renderer" | "checking-worker" | "testing-render" | "finalizing";

const stageCopy: Record<StartupStage, string> = {
  initializing: "Checking PDF renderer compatibility...",
  "loading-renderer": "Loading PDF renderer...",
  "checking-worker": "Checking PDF worker...",
  "testing-render": "Testing PDF rendering...",
  finalizing: "Finalizing startup...",
};

interface StartupScreenProps {
  readonly stage: StartupStage;
}

export const StartupScreen = ({ stage }: StartupScreenProps): React.ReactElement => (
  <main aria-labelledby="startup-title" className="startup-screen">
    <section aria-live="polite" className="startup-screen__content" role="status">
      <div className="startup-screen__brand" aria-label="QuickPDF">
        <img src={quickPdfMark} alt="" />
        <span>
          Quick<span>PDF</span>
        </span>
      </div>
      <h1 id="startup-title">Preparing QuickPDF</h1>
      <p>{stageCopy[stage]}</p>
      <div aria-hidden="true" className="startup-screen__portal">
        <i />
        <i />
        <i />
      </div>
      <div className="startup-screen__privacy">
        <span aria-hidden="true">&#10003;</span>
        <div>
          <strong>Your files stay in your browser.</strong>
          <small>Private. Secure. Always local.</small>
        </div>
      </div>
    </section>
  </main>
);
