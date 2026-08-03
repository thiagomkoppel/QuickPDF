# Progressive Web App

## Goal

Make QuickPDF installable on phones, tablets, and desktop browsers while preserving the browser-local privacy model.

## Scope

- Web app manifest
- QuickPDF app icons
- Apple touch icon
- Standalone display mode
- Safe-area support
- Android/Chromium install prompt
- iOS/iPadOS Add to Home Screen guidance
- Offline application shell
- Safe update notification

## Cache policy

Cache only static application assets:

- HTML
- JavaScript
- CSS
- icons
- bundled fonts
- brand assets

Never cache:

- opened PDFs
- signatures
- initials
- uploaded images
- exported PDFs
- editor session contents

## Acceptance criteria

- Installable on supported browsers.
- Standalone launch works.
- Application shell can open offline after installation.
- No user documents enter service-worker caches.
- Existing routes and editor behavior remain intact.
- Production build emits manifest, icons, and service worker.

## Deferred

- Background sync
- Push notifications
- Cloud storage
- Automatic session recovery
