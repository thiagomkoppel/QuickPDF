import { detectStandaloneMode } from "../browser/standalone-mode";
import type { QuickPdfBuildInfo } from "./build-info";

interface ManifestConfiguration {
  readonly id?: string;
  readonly start_url?: string;
  readonly scope?: string;
  readonly display?: string;
}

interface CachedNavigationResponse {
  readonly cacheKey: string;
  readonly responseUrl: string;
  readonly status: number;
  readonly type: ResponseType;
  readonly redirected: boolean;
  readonly contentType?: string;
}

interface NavigatorWithStandalone extends Navigator {
  readonly standalone?: boolean;
}

export interface QuickPdfPwaDiagnostics {
  readonly location: string;
  readonly online: boolean;
  readonly standalone: boolean;
  readonly navigatorStandalone: boolean;
  readonly displayModeStandalone: boolean;
  readonly serviceWorkerSupported: boolean;
  readonly controllerScriptUrl?: string;
  readonly registrationScope?: string;
  readonly activeWorkerState?: string;
  readonly activeWorkerBuild?: QuickPdfBuildInfo;
  readonly waitingWorkerState?: string;
  readonly waitingWorkerBuild?: QuickPdfBuildInfo;
  readonly installingWorkerState?: string;
  readonly installingWorkerBuild?: QuickPdfBuildInfo;
  readonly cacheNames: readonly string[];
  readonly shellCacheName?: string;
  readonly shellHasIndex: boolean;
  readonly shellHasMainScript: boolean;
  readonly shellHasMainStylesheet: boolean;
  readonly shellHasPdfWorker: boolean;
  readonly shellHasPatrickHand: boolean;
  readonly shellHasManifest: boolean;
  readonly cachedNavigationResponse?: CachedNavigationResponse;
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

const isQuickPdfBuildInfo = (value: unknown): value is QuickPdfBuildInfo => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.version === "string" &&
    typeof record.sha === "string" &&
    typeof record.branch === "string" &&
    (record.mode === "development" || record.mode === "production")
  );
};

const readWorkerBuild = async (
  worker: ServiceWorker | null | undefined,
): Promise<QuickPdfBuildInfo | undefined> => {
  if (worker === null || worker === undefined || typeof MessageChannel === "undefined") {
    return undefined;
  }
  try {
    return await new Promise((resolve) => {
      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => {
        channel.port1.close();
        resolve(undefined);
      }, 250);
      channel.port1.onmessage = (event: MessageEvent<unknown>): void => {
        window.clearTimeout(timeout);
        channel.port1.close();
        resolve(isQuickPdfBuildInfo(event.data) ? event.data : undefined);
      };
      worker.postMessage({ type: "QUICKPDF_BUILD_METADATA" }, [channel.port2]);
    });
  } catch {
    return undefined;
  }
};

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

const readCachedNavigationResponse = async (
  cache: Cache | undefined,
): Promise<CachedNavigationResponse | undefined> => {
  if (cache === undefined) return undefined;
  try {
    const response = await cache.match("/");
    if (response === undefined) return undefined;
    const contentType = response.headers.get("content-type");
    return {
      cacheKey: "/",
      responseUrl: response.url || "Synthetic local response",
      status: response.status,
      type: response.type,
      redirected: response.redirected,
      ...(contentType === null ? {} : { contentType }),
    };
  } catch {
    return undefined;
  }
};

/** Reads only shell and runtime metadata for an opt-in physical-device diagnosis. */
export const collectQuickPdfPwaDiagnostics = async (): Promise<QuickPdfPwaDiagnostics> => {
  const displayModeStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const navigatorStandalone = (navigator as NavigatorWithStandalone).standalone === true;
  const serviceWorkerSupported = "serviceWorker" in navigator;
  const controller = serviceWorkerSupported ? navigator.serviceWorker.controller : null;
  const registration = serviceWorkerSupported
    ? await navigator.serviceWorker.getRegistration("/").catch(() => undefined)
    : undefined;
  const cacheNames = typeof caches === "undefined" ? [] : await caches.keys().catch(() => []);
  const shellCacheNames = cacheNames.filter((name) => name.startsWith("quickpdf-shell-"));
  const shellCacheName = shellCacheNames.length === 1 ? shellCacheNames[0] : undefined;
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
  const [activeWorkerBuild, waitingWorkerBuild, installingWorkerBuild] = await Promise.all([
    readWorkerBuild(registration?.active),
    readWorkerBuild(registration?.waiting),
    readWorkerBuild(registration?.installing),
  ]);
  const manifest = await readCachedManifest(shellCache);
  const cachedNavigationResponse = await readCachedNavigationResponse(shellCache);

  return {
    location: window.location.href,
    online: navigator.onLine,
    standalone: detectStandaloneMode({
      displayModeMatches: displayModeStandalone,
      navigatorStandalone,
    }),
    navigatorStandalone,
    displayModeStandalone,
    serviceWorkerSupported,
    ...(controller === null ? {} : { controllerScriptUrl: controller.scriptURL }),
    ...(registration === undefined ? {} : { registrationScope: registration.scope }),
    ...(activeWorkerState === undefined ? {} : { activeWorkerState }),
    ...(activeWorkerBuild === undefined ? {} : { activeWorkerBuild }),
    ...(waitingWorkerState === undefined ? {} : { waitingWorkerState }),
    ...(waitingWorkerBuild === undefined ? {} : { waitingWorkerBuild }),
    ...(installingWorkerState === undefined ? {} : { installingWorkerState }),
    ...(installingWorkerBuild === undefined ? {} : { installingWorkerBuild }),
    cacheNames,
    ...(shellCacheName === undefined ? {} : { shellCacheName }),
    shellHasIndex: includesPath("/index.html") || cachedPaths.includes("/"),
    shellHasMainScript: includesPath("/assets/index-") && includesPath(".js"),
    shellHasMainStylesheet: includesPath("/assets/index-") && includesPath(".css"),
    shellHasPdfWorker: includesPath("pdf.worker"),
    shellHasPatrickHand: includesPath("PatrickHand"),
    shellHasManifest: includesPath("/manifest.webmanifest"),
    ...(cachedNavigationResponse === undefined ? {} : { cachedNavigationResponse }),
    ...(manifest === undefined ? {} : { manifest }),
  };
};
