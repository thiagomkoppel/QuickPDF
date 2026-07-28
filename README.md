# QuickPDF

QuickPDF is a free, privacy-first browser application for completing common PDF tasks quickly.

Users will be able to open a local PDF, fill fields, add text, sign, mark checkboxes, make visual corrections, organize pages, and download the completed document. The document must never leave the browser and is discarded when the session ends.

## Product promise

> Fill, sign, fix, and download a PDF in minutes. No account, no upload, no watermark.

## Current status

QuickPDF is in Phase 0 foundation work. The repository now contains a Vite, React, and TypeScript static client scaffold with tests and quality gates. PDF loading, rendering, editing, signing, and exporting are intentionally not implemented yet.

## Core constraints

- Local-only document processing.
- No account or authentication.
- No cloud storage or backend document processing.
- No document analytics, logging, or telemetry.
- No watermark or export limit.
- All document data is discarded when the tab or browser session closes.
- The application must work on desktop, tablet, and mobile.
- The application must remain usable offline after its static assets have been loaded, where browser capabilities permit.

## Technology foundation

- Vite static SPA.
- React.
- TypeScript with strict compiler settings.
- npm with `package-lock.json`.
- Vitest, React Testing Library, and jsdom for unit/component tests.
- Playwright configured for later end-to-end tests.
- ESLint and Prettier for code quality.

Use Node.js 20.19 or newer. The CI workflow currently uses Node 20.

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

`npm run test:e2e` is configured for future Playwright tests, but no end-to-end product tests are included yet because no PDF workflow exists.

## Project structure

```text
src/
├── app/
├── domain/
├── application/
├── infrastructure/
│   ├── browser/
│   └── pdf/
├── presentation/
│   ├── components/
│   ├── pages/
│   └── styles/
├── shared/
└── test/
```

The domain layer must remain independent of React, DOM APIs, PDF libraries, and browser adapters. Presentation code renders state and routes user intent through application-facing boundaries. Infrastructure will hold browser and PDF adapter implementations when Phase 0 reaches those workstreams.

See [AGENTS.md](AGENTS.md) before making any change.
