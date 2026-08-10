export const QUICKPDF_SHELL_CACHE_PREFIX = "quickpdf-shell";

const isApprovedAssetPath = (pathname: string): boolean =>
  pathname === "/" ||
  pathname === "/index.html" ||
  pathname === "/manifest.webmanifest" ||
  pathname.startsWith("/assets/") ||
  /\/(?:favicon\.ico|favicon-(?:16|32)\.png|apple-touch-icon\.png|quickpdf-(?:192|512|maskable-512)\.png)$/.test(
    pathname,
  );

/** Limits Cache Storage to NestlyPDF's versioned application shell. */
export const shouldCacheRequest = (request: Request, response: Response): boolean => {
  const url = new URL(request.url);
  if (url.protocol === "blob:" || url.protocol === "data:") return false;
  if (url.origin !== window.location.origin) return false;
  if (
    request.method !== "GET" ||
    (request.destination === "document" && url.pathname.endsWith(".pdf"))
  ) {
    return false;
  }
  if (response.type === "opaque" || !response.ok) return false;
  if (response.headers.get("content-type")?.toLowerCase().includes("application/pdf")) return false;
  if (url.pathname.endsWith(".pdf")) return false;
  return isApprovedAssetPath(url.pathname);
};
