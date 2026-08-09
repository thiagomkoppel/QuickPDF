import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PwaDiagnosticsPage } from "./PwaDiagnosticsPage";

const { collectQuickPdfPwaDiagnostics } = vi.hoisted(() => ({
  collectQuickPdfPwaDiagnostics: vi.fn(),
}));

vi.mock("../../infrastructure/pwa/pwa-diagnostics", () => ({
  collectQuickPdfPwaDiagnostics,
}));

beforeEach(() => {
  collectQuickPdfPwaDiagnostics.mockResolvedValue({
    location: "https://quickpdf.example/",
    online: true,
    standalone: true,
    navigatorStandalone: true,
    displayModeStandalone: false,
    serviceWorkerSupported: true,
    controllerScriptUrl: "https://quickpdf.example/service-worker.js",
    registrationScope: "https://quickpdf.example/",
    activeWorkerState: "activated: https://quickpdf.example/service-worker.js",
    activeWorkerBuild: { version: "0.0.0", sha: "abc1234", branch: "main", mode: "production" },
    cacheNames: ["quickpdf-shell-1234"],
    shellCacheName: "quickpdf-shell-1234",
    shellHasIndex: true,
    shellHasMainScript: true,
    shellHasMainStylesheet: true,
    shellHasPdfWorker: true,
    shellHasPatrickHand: true,
    shellHasManifest: true,
    cachedNavigationResponse: {
      cacheKey: "/",
      responseUrl: "Synthetic local response",
      status: 200,
      type: "default",
      redirected: false,
      contentType: "text/html; charset=utf-8",
    },
    manifest: { id: "/", start_url: "/", scope: "/" },
  });
});

describe("PWA diagnostics page", () => {
  it("shows installed-mode and shell-cache details without document data", async () => {
    const user = userEvent.setup();
    render(<PwaDiagnosticsPage bootstrapStatus="compatible" />);

    expect(await screen.findByText("Navigator standalone")).toBeInTheDocument();
    expect(screen.getByText("Display-mode standalone")).toBeInTheDocument();
    expect(screen.getByText("Current shell cache")).toBeInTheDocument();
    expect(screen.getAllByText("quickpdf-shell-1234")).toHaveLength(2);
    expect(screen.getByText("Cached main script")).toBeInTheDocument();
    expect(screen.getByText("Cached navigation redirected")).toBeInTheDocument();
    expect(screen.getByText("App version")).toBeInTheDocument();
    expect(screen.getByText("Build SHA")).toBeInTheDocument();
    expect(screen.getByText("Build branch")).toBeInTheDocument();
    expect(screen.getByText("Build mode")).toBeInTheDocument();
    expect(screen.getByText("0.0.0 / abc1234")).toBeInTheDocument();
    expect(screen.queryByText(/contract\.pdf/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show diagnostics text" }));
    expect(screen.getByText(/Navigator standalone: Yes/)).toBeInTheDocument();
    expect(screen.getByText(/Current shell cache: quickpdf-shell-1234/)).toBeInTheDocument();
    expect(screen.getByText(/Cached navigation redirected: No/)).toBeInTheDocument();
  });
});
