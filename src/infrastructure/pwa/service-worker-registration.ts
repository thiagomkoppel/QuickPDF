export interface ServiceWorkerRegistrationResult {
  readonly supported: boolean;
  readonly registered: boolean;
  readonly updateAvailable: boolean;
}

/** Production-only progressive enhancement. Failure never affects PDF compatibility. */
export const registerQuickPdfServiceWorker = async (): Promise<ServiceWorkerRegistrationResult> => {
  if (!("serviceWorker" in navigator))
    return { supported: false, registered: false, updateAvailable: false };
  try {
    const registration = await navigator.serviceWorker.register("/service-worker.js", {
      scope: "/",
    });
    const hasWaitingWorker = (): boolean => registration.waiting !== null;
    return { supported: true, registered: true, updateAvailable: hasWaitingWorker() };
  } catch {
    return { supported: true, registered: false, updateAvailable: false };
  }
};
