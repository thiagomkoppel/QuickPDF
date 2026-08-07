import { afterEach, describe, expect, it, vi } from "vitest";

import { activateQuickPdfUpdate, watchForQuickPdfUpdate } from "./service-worker-update";

const listeners = new Map<string, EventListener[]>();
const addListener = (name: string, listener: EventListener): void => {
  listeners.set(name, [...(listeners.get(name) ?? []), listener]);
};
const dispatch = (name: string): void => {
  for (const listener of listeners.get(name) ?? []) listener(new Event(name));
};

afterEach(() => {
  listeners.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("service worker update lifecycle", () => {
  it("publishes a waiting worker already present at registration", async () => {
    const postMessage = vi.fn();
    const waiting = { postMessage } as unknown as ServiceWorker;
    const registration = {
      waiting,
      installing: null,
      addEventListener: vi.fn(),
    } as unknown as ServiceWorkerRegistration;
    vi.stubGlobal("navigator", {
      serviceWorker: {
        getRegistration: vi.fn(() => Promise.resolve(registration)),
        addEventListener: addListener,
      },
    });
    const onState = vi.fn();
    watchForQuickPdfUpdate(onState);
    await Promise.resolve();
    expect(onState).toHaveBeenCalledWith(expect.objectContaining({ status: "available", waiting }));
  });
  it("posts skip waiting and reloads once after controllerchange", () => {
    const postMessage = vi.fn();
    const waiting = { postMessage } as unknown as ServiceWorker;
    vi.stubGlobal("navigator", { serviceWorker: { addEventListener: addListener } });
    const reload = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { reload } });
    activateQuickPdfUpdate({
      status: "available",
      registration: {} as ServiceWorkerRegistration,
      waiting,
    });
    expect(postMessage).toHaveBeenCalledOnce();
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    dispatch("controllerchange");
    dispatch("controllerchange");
    expect(reload).toHaveBeenCalledOnce();
  });
});
