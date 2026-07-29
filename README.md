# QuickPDF

QuickPDF is a free, privacy-first browser application for completing common PDF tasks quickly.

Users will be able to open a local PDF, fill fields, add text, sign, mark checkboxes, make visual corrections, organize pages, and download the completed document. The document must never leave the browser and is discarded when the session ends.

## Product promise

> Fill, sign, fix, and download a PDF in minutes. No account, no upload, no watermark.

## Current status

QuickPDF is in Phase 0 foundation work. The repository contains a Vite, React, and TypeScript static client scaffold with tests and quality gates.

The first real product capability is implemented: a browser-only local PDF viewer. Users can select or drag-and-drop one local PDF, have it validated from bytes, open it with PDF.js, render the current page to a canvas, navigate pages, zoom, fit width, and close the document so active viewer references are released.

Editing, signing, form filling, page organization, and export are intentionally deferred.

## Core constraints

- Local-only document processing.
- No account or authentication.
- No cloud storage or backend document processing.
- No document analytics, logging, or telemetry.
- No watermark or export limit.
- All document data is discarded when the tab, browser session, or active document session closes.
- The application must work on desktop, tablet, and mobile.
- The application must remain usable offline after its static assets have been loaded, where browser capabilities permit.

## Technology foundation

- Vite static SPA.
- React.
- TypeScript with strict compiler settings.
- PDF.js through an infrastructure adapter for local parsing and canvas rendering.
- npm with `package-lock.json`.
- Vitest, React Testing Library, and jsdom for unit/component tests.
- Playwright for browser end-to-end tests.
- ESLint and Prettier for code quality.

Use Node.js 22 or newer. The CI workflow uses Node 22.

## Commands

```sh
npm install
npm run dev
npm run format:check
npm run typecheck
npm run lint
npm test
npm run test:ci
npm run test:e2e
npm run build
```

To try the viewer locally:

```sh
npm run dev
```

Then open the printed local Vite URL, usually `http://127.0.0.1:5173/`, and choose or drop a PDF from your device.

## Project structure

```text
src/
|-- app/
|-- domain/
|-- application/
|-- infrastructure/
|   |-- browser/
|   `-- pdf/
|-- presentation/
|   |-- components/
|   |-- pages/
|   `-- styles/
|-- shared/
`-- test/
```

The domain layer must remain independent of React, DOM APIs, PDF libraries, and browser adapters. Presentation code renders state and routes user intent through application-facing boundaries. Infrastructure holds browser file and PDF.js adapter implementations.

See [AGENTS.md](AGENTS.md) before making any change.
