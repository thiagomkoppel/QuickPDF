import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Shell } from "./Shell";

const originalUserAgent = window.navigator.userAgent;

const setUserAgent = (userAgent: string): void => {
  Object.defineProperty(window.navigator, "userAgent", { configurable: true, value: userAgent });
};

const setMatchMedia = (matchesStandalone = false): void => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string): MediaQueryList => ({
      matches: matchesStandalone && query === "(display-mode: standalone)",
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
};

afterEach(() => {
  setUserAgent(originalUserAgent);
  setMatchMedia();
});

describe("Shell PWA presentation", () => {
  it("opens iOS installation instructions only after the explicit install action", async () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
    );
    const user = userEvent.setup();
    render(
      <Shell>
        <div>Landing content</div>
      </Shell>,
    );

    expect(screen.queryByRole("dialog", { name: "Install QuickPDF" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open site menu" }));
    await user.click(screen.getByRole("button", { name: "Install QuickPDF" }));

    expect(screen.getByRole("dialog", { name: "Install QuickPDF" })).toBeInTheDocument();
    expect(screen.getByText("Tap the Share button in Safari.")).toBeInTheDocument();
    expect(screen.getByText("Choose “Add to Home Screen.”")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("dialog", { name: "Install QuickPDF" })).not.toBeInTheDocument();
  });

  it("uses the saved Chromium prompt and hides installation after acceptance", async () => {
    const prompt = vi.fn(() => Promise.resolve());
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ readonly outcome: "accepted" }>;
    };
    Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
    const user = userEvent.setup();
    render(
      <Shell>
        <div>Landing content</div>
      </Shell>,
    );

    fireEvent(window, event);
    await user.click(await screen.findByRole("button", { name: "Install QuickPDF" }));

    expect(prompt).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Install QuickPDF" })).not.toBeInTheDocument();
    });
    expect(screen.getByText("Landing content")).toBeInTheDocument();
  });

  it("hides the install action when the browser reports installation", async () => {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ readonly outcome: "dismissed" }>;
    };
    Object.assign(event, {
      prompt: vi.fn(() => Promise.resolve()),
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    render(
      <Shell>
        <div>Landing content</div>
      </Shell>,
    );

    fireEvent(window, event);
    expect(await screen.findByRole("button", { name: "Install QuickPDF" })).toBeInTheDocument();
    fireEvent(window, new Event("appinstalled"));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Install QuickPDF" })).not.toBeInTheDocument();
    });
  });
  it("does not expose an install action when native installation is unavailable", () => {
    render(
      <Shell>
        <div>Landing content</div>
      </Shell>,
    );

    expect(screen.queryByRole("button", { name: "Install QuickPDF" })).not.toBeInTheDocument();
  });

  it("suppresses all installation controls in standalone mode", () => {
    setMatchMedia(true);
    render(
      <Shell>
        <div>Landing content</div>
      </Shell>,
    );

    expect(screen.getByRole("link", { name: "QuickPDF" })).toBeInTheDocument();
    expect(document.querySelector(".app-shell")).toHaveAttribute("data-standalone", "true");
    expect(screen.queryByRole("button", { name: "Install QuickPDF" })).not.toBeInTheDocument();
  });

  it("opens the temporary PWA diagnostics route from the existing menu", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/");
    render(
      <Shell>
        <div>Landing content</div>
      </Shell>,
    );

    await user.click(screen.getByRole("button", { name: "Open site menu" }));
    await user.click(screen.getByRole("button", { name: "PWA Diagnostics" }));

    expect(window.location.search).toBe("?pwa-debug=1");
  });
});
