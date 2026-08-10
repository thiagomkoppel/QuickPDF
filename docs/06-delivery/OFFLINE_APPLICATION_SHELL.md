# Offline Application Shell

NestlyPDF 06.3 adds a production-only service worker that precaches versioned NestlyPDF shell assets after an online visit. It caches the SPA shell, generated JavaScript/CSS, PDF.js worker, Patrick Hand font, manifest, and NestlyPDF icons. It does not cache user PDFs, Blob/Data URLs, exports, image uploads, signatures, clipboard, or session state.

Cloudflare static assets use the single-page-application fallback for unmatched browser navigation routes, so direct visits to client-side routes serve `/index.html` after exact asset matching.

Navigation is network-first with an app-shell fallback; hashed shell assets are cache-first. Cache names use the `quickpdf-shell` prefix and activation removes only prior NestlyPDF shell caches. A waiting update activates only after a `SKIP_WAITING` message; no automatic editor reload is performed.

The active document remains memory-only. Refreshing or closing the app can discard it even when the shell is offline.
