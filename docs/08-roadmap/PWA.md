# Progressive Web App

## Part 1: Installability foundation

QuickPDF can be installed as a standalone browser application on supported Android, iOS/iPadOS, and Chromium desktop browsers. This part provides the manifest, mark-only icons, standalone presentation detection, safe-area layout, and platform-appropriate install guidance.

## Included

- Web app manifest with standalone display, root start URL, root scope, theme/background color, and orientation support.
- Local PNG, maskable, Apple touch, and favicon assets generated from the QuickPDF document/Q mark.
- HTML manifest, theme-color, Apple standalone, touch-icon, and favicon metadata.
- Presentation-only standalone detection via `display-mode: standalone` and iOS `navigator.standalone`.
- Safe-area-aware application shell using `100dvh` and top/bottom safe-area insets.
- An explicit iOS Safari installation action that opens a dismissible Add to Home Screen instruction sheet.
- A deferred Chromium install action through `beforeinstallprompt`, hidden after `appinstalled` or an accepted prompt, and surfaced through a non-intrusive landing onboarding card before installation; its install action appears only when installation is genuinely available.

## Explicitly not included

Part 1 does not register a service worker and does not implement offline support, application-shell caching, background sync, update notifications, autosave, IndexedDB, localStorage, document restoration, or any document cache.

QuickPDF continues to keep active PDFs, overlays, signatures, images, clipboard content, history, and editor state only in browser memory for the active session. Installing the application does not alter this privacy model.

## Routing

The manifest starts at `/` with scope `/`. The existing SPA route behavior remains unchanged:

- `/` opens the landing page.
- `/privacy` remains refreshable through the static host fallback configuration.
- `/editor` without an active in-memory document redirects to the landing page.

## Future parts

Later PWA work must receive a separate privacy review before adding any service worker, cache, offline capability, or update behavior. User document bytes must never enter a service-worker cache.

## Part 2: Offline application shell

Production builds now precache only QuickPDF-owned shell assets. User document bytes and editor sessions remain excluded from Cache Storage and remain memory-only.
