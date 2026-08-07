import { isStandaloneMode } from "../browser/standalone-mode";

interface ManifestConfiguration {
  readonly id?: string;
  readonly start_url?: string;
  readonly scope?: string;
  readonly display?: string;
}

export interface QuickPdfPwaDiagnostics {
  readonly location: string;
  readonly online: boolean;
  readonly standalone: boolean;
  readonly serviceWorkerSupported: boolean;
  readonly controllerScriptUrl?: string;
  readonly registrationScope?: string;
  readonly activeWorkerState?: string;
  readonly waitingWorkerState?: string;
  readonly installingWorkerState?: string;
  readonly cacheNames: readonly string[];
  readonly shellHasIndex: boolean;
  readonly shellHasMainScript: boolean;
  readonly shellHasMainStylesheet: boolean;
  readonly shellHasPdfWorker: boolean;
  readonly shellHasPatrickHand: boolean;
  readonly shellHasManifest: boolean;
  readonly manifest?: ManifestConfiguration;
}

const safeManifest = (value: unknown): ManifestConfiguration | undefined => {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const configuration: { id?: string; start_url?: string; scope?: string; display?: string } = {};
  for (const key of ["id", "start_url", "scope", "display"] as const) {
    const valueAtKey = record[key];
    if (typeof valueAtKey === "string") configuration[key] = valueAtKey;
  }
  return configuration;
};

const workerState = (worker: ServiceWorker | null | undefined): string | undefined =>
  worker === null || worker === undefined ? undefined : `${worker.state}: ${worker.scriptURL}`;

const readCachedManifest = async (
  cache: Cache | undefined,
): Promise<ManifestConfiguration | undefined> => {
  if (cache === undefined) return undefined;
  try {
    const response = await cache.match("/manifest.webmanifest");
    return response === undefined ? undefined : safeManifest((await response.json()) as unknown);
  } catch {
    return undefined;
  }
};

/** Reads only shell and runtime metadata for an opt-in physical-device diagnosis. */
export const collectQuickPdfPwaDiagnostics = async (): Promise<QuickPdfPwaDiagnostics> => {
  const serviceWorkerSupported = "serviceWorker" in navigator;
  const controller = serviceWorkerSupported ? navigator.serviceWorker.controller : null;
  const registration = serviceWorkerSupported
    ? await navigator.serviceWorker.getRegistration("/").catch(() => undefined)
    : undefined;
  const cacheNames = typeof caches === "undefined" ? [] : await caches.keys().catch(() => []);
  const shellCacheName = cacheNames.find((name) => name.startsWith("quickpdf-shell-"));
  const shellCache =
    shellCacheName === undefined || typeof caches === "undefined"
      ? undefined
      : await caches.open(shellCacheName).catch(() => undefined);
  const cachedPaths =
    shellCache === undefined
      ? []
      : await shellCache
          .keys()
          .then((requests) => requests.map((request) => new URL(request.url).pathname))
          .catch(() => []);
  const includesPath = (value: string): boolean => cachedPaths.some((path) => path.includes(value));
  const activeWorkerState = workerState(registration?.active);
  const waitingWorkerState = workerState(registration?.waiting);
  const installingWorkerState = workerState(registration?.installing);
  const manifest = await readCachedManifest(shellCache);

  return {
    location: window.location.href,
    online: navigator.onLine,
    standalone: isStandaloneMode(),
    serviceWorkerSupported,
    ...(controller === null ? {} : { controllerScriptUrl: controller.scriptURL }),
    ...(registration === undefined ? {} : { registrationScope: registration.scope }),
    ...(activeWorkerState === undefined ? {} : { activeWorkerState }),
    ...(waitingWorkerState === undefined ? {} : { waitingWorkerState }),
    ...(installingWorkerState === undefined ? {} : { installingWorkerState }),
    cacheNames,
    shellHasIndex: includesPath("/index.html") || cachedPaths.includes("/"),
    shellHasMainScript: includesPath("/assets/index-") && includesPath(".js"),
    shellHasMainStylesheet: includesPath("/assets/index-") && includesPath(".css"),
    shellHasPdfWorker: includesPath("pdf.worker"),
    shellHasPatrickHand: includesPath("PatrickHand"),
    shellHasManifest: includesPath("/manifest.webmanifest"),
    ...(manifest === undefined ? {} : { manifest }),
  };
};
