# Version 1.0 Release Plan

## Goal

Prepare QuickPDF for its first public release.

## Included

- Browser-local editing
- Desktop editor
- Tablet editor
- Phone Quick Edit
- Text, date, image, signature, initials, checkmark, cross, and whiteout overlays
- Undo/Redo
- Page navigation and thumbnails
- Fit Page and Fit Width
- Layer ordering
- Multiline export
- Patrick Hand font
- Privacy Policy
- Progressive Web App support

## Release checklist

### Product

- Confirm public feature list.
- Confirm known limitations.
- Confirm Whiteout warning.
- Confirm session-loss warning.
- Confirm supported browsers.

### Delivery

- Production build
- Static-hosting route fallback
- Manifest and icons
- Service worker
- Version metadata
- Release notes
- Deployment instructions

### Quality

- Full tests
- Desktop, tablet, and mobile E2E
- PDF export regression suite
- Browser compatibility review
- Accessibility review
- Bundle-size review

## Release blockers

- External PDF upload
- Broken export
- Lost annotations
- Unusable mobile workflow
- Horizontal overflow
- Failing tests
- Privacy policy inconsistent with implementation

## Runtime build identity

`package.json` is the sole semantic-version source. Before a release candidate, set it to the intended pre-release value (for example `1.0.0-rc.1`); set it to `1.0.0` for the final release, then use normal semantic-version increments for follow-up releases.

`npm run build` injects immutable runtime metadata into the Vite application and generated service worker: version, short Git SHA, Git branch, and build mode. The build resolver reads Git when available and accepts `QUICKPDF_BUILD_SHA`, `QUICKPDF_BUILD_BRANCH`, `GIT_SHA`, `GIT_BRANCH`, `CF_PAGES_COMMIT_SHA`, and `CF_PAGES_BRANCH` from the build environment. When none are available, the build continues with `unknown` metadata.

Users can see a compact `v<version> · <sha>` label in the landing footer. `/pwa-diagnostics` exposes the application version, SHA, branch, and mode plus active, waiting, and installing worker build metadata when those workers respond. This data contains no document, filename, session, or user information.
