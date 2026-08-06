export type PwaUpdateState =
  | { readonly status: "idle" }
  | {
      readonly status: "available";
      readonly registration: ServiceWorkerRegistration;
      readonly waiting: ServiceWorker;
    }
  | { readonly status: "activating" };

export const watchForQuickPdfUpdate = (
  onStateChange: (state: PwaUpdateState) => void,
): (() => void) => {
  if (!("serviceWorker" in navigator)) return () => undefined;
  let registration: ServiceWorkerRegistration | undefined;
  const inspect = (): void => {
    const waiting = registration?.waiting;
    if (registration !== undefined && waiting !== null && waiting !== undefined) {
      onStateChange({ status: "available", registration, waiting });
    }
  };
  void navigator.serviceWorker.getRegistration("/").then((found) => {
    registration = found;
    inspect();
    found?.addEventListener("updatefound", () => {
      const installing = found.installing;
      installing?.addEventListener("statechange", inspect);
    });
  });
  return () => undefined;
};

export const activateQuickPdfUpdate = (
  state: Extract<PwaUpdateState, { readonly status: "available" }>,
): void => {
  let reloaded = false;
  const reload = (): void => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener("controllerchange", reload, { once: true });
  state.waiting.postMessage({ type: "SKIP_WAITING" });
};
