import { useCallback, useEffect, useMemo, useState } from "react";

import { currentInstallPlatform, isIosSafari } from "../../infrastructure/browser/standalone-mode";

export type InstallAvailability =
  "chromium-prompt" | "ios-instructions" | "unavailable" | "installed";

interface DeferredInstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ readonly outcome: "accepted" | "dismissed" }>;
}

export interface PwaInstallController {
  readonly availability: InstallAvailability;
  readonly isInstructionsOpen: boolean;
  readonly isStandalone: boolean;
  readonly lastInstallOutcome?: "accepted" | "dismissed";
  requestInstall: () => Promise<void>;
  dismissInstructions: () => void;
}

export const usePwaInstallController = (): PwaInstallController => {
  const [isStandalone, setIsStandalone] = useState(() => currentInstallPlatform().standalone);
  const [isInstalledThisSession, setIsInstalledThisSession] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<DeferredInstallPrompt>();
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [lastInstallOutcome, setLastInstallOutcome] = useState<"accepted" | "dismissed">();
  const installPlatform = currentInstallPlatform();

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const updateStandalone = (): void => {
      const standalone = currentInstallPlatform().standalone;
      setIsStandalone(standalone);
      if (standalone) setIsInstalledThisSession(true);
    };
    const captureInstallPrompt = (event: Event): void => {
      if (isInstalledThisSession) return;
      const promptEvent = event as DeferredInstallPrompt;
      event.preventDefault();
      setDeferredInstallPrompt(promptEvent);
    };
    const completeInstall = (): void => {
      setIsInstalledThisSession(true);
      setDeferredInstallPrompt(undefined);
      setIsInstructionsOpen(false);
    };

    displayMode.addEventListener("change", updateStandalone);
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", completeInstall);
    return () => {
      displayMode.removeEventListener("change", updateStandalone);
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", completeInstall);
    };
  }, [isInstalledThisSession]);

  const availability = useMemo<InstallAvailability>(() => {
    if (isStandalone || isInstalledThisSession) return "installed";
    if (deferredInstallPrompt !== undefined) return "chromium-prompt";
    return isIosSafari(installPlatform) ? "ios-instructions" : "unavailable";
  }, [deferredInstallPrompt, installPlatform, isInstalledThisSession, isStandalone]);

  const requestInstall = useCallback(async (): Promise<void> => {
    if (availability === "ios-instructions") {
      setIsInstructionsOpen(true);
      return;
    }
    if (availability !== "chromium-prompt" || deferredInstallPrompt === undefined) return;

    await deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    setLastInstallOutcome(choice.outcome);
    if (choice.outcome === "accepted") {
      setIsInstalledThisSession(true);
      setDeferredInstallPrompt(undefined);
    }
  }, [availability, deferredInstallPrompt]);

  return {
    availability,
    isInstructionsOpen,
    isStandalone,
    ...(lastInstallOutcome === undefined ? {} : { lastInstallOutcome }),
    requestInstall,
    dismissInstructions: () => {
      setIsInstructionsOpen(false);
    },
  };
};
