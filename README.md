# QuickPDF

QuickPDF is a free, privacy-first browser application for completing common PDF tasks quickly.

Users can now open a local PDF, render the current page with PDF.js, place temporary text and whiteout overlays aligned to that page, and download a new edited PDF generated entirely in the browser. Signatures, forms, page organization, undo/redo, and advanced editing remain deferred.

## Product promise

> Fill, sign, fix, and download a PDF in minutes. No account, no upload, no watermark.

## Current status

QuickPDF is in Phase 0 proof-of-concept work. The current static Vite, React, and TypeScript client supports a first useful local workflow:

1. choose a local PDF;
2. render the current PDF page locally with PDF.js;
3. create text and whiteout overlays aligned over the rendered page;
4. export a new PDF with those overlays embedded;
5. keep editing after download.

Whiteout only covers content visually. It does not securely remove underlying PDF data.

## Core constraints

- Local-only document processing.
- No account or authentication.
- No cloud storage or backend document processing.
- No document analytics, logging, or telemetry.
- No watermark or export limit.
- The original PDF is preserved; edits are overlay operations until export.
- All document and edit state is discarded when the session ends.

## Technology foundation

- Vite static SPA.
- React.
- TypeScript with strict compiler settings.
- PDF rendering through `pdfjs-dist` behind an infrastructure adapter.
- PDF export through `pdf-lib` behind an infrastructure adapter.
- Browser File, Blob, object URL, and download APIs behind adapters.
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

Then open the printed local Vite URL, usually `http://127.0.0.1:5173/`, choose or drop a PDF, add Text or Whiteout overlays, and use Download to save `*-edited.pdf`.

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
