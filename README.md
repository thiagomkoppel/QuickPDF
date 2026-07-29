# QuickPDF

QuickPDF is a free, privacy-first browser application for completing common PDF tasks quickly.

Users can now open a local PDF, render it in the browser, and create temporary text and whiteout overlay edits. Download/export, signatures, form filling, page organization, and undo/redo remain deferred.

## Product promise

> Fill, sign, fix, and download a PDF in minutes. No account, no upload, no watermark.

## Current status

QuickPDF is in Phase 0 foundation work. The current proof of concept is a static Vite, React, and TypeScript client that opens and renders local PDFs with PDF.js and supports temporary in-memory text and whiteout overlays.

Whiteout only covers content visually. It does not securely remove underlying PDF data.

## Core constraints

- Local-only document processing.
- No account or authentication.
- No cloud storage or backend document processing.
- No document analytics, logging, or telemetry.
- No watermark or export limit.
- All document and edit state is discarded when the document session closes.
- Dirty documents warn before discard.
- The application must work on desktop, tablet, and mobile.

## Technology foundation

- Vite static SPA.
- React.
- TypeScript with strict compiler settings.
- PDF.js behind an infrastructure adapter.
- Browser File APIs behind infrastructure adapters.
- npm with `package-lock.json`.
- Vitest, React Testing Library, jsdom, and Playwright.
- ESLint and Prettier.

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

To try the editor locally:

```sh
npm run dev
```

Then open the printed local Vite URL, usually `http://127.0.0.1:5173/`, choose or drop a PDF, and use the Text or Whiteout tools.

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

The domain layer remains independent of React, DOM APIs, PDF libraries, and browser adapters. Presentation code renders snapshots and routes user intent through application-facing boundaries.

See [AGENTS.md](AGENTS.md) before making any change.
