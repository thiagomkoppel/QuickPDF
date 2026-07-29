# Repository Assessment

Assessment date: 2026-07-29

## Current state

The repository is initialized as a Phase 0 proof of concept. It contains project documentation, a static Vite, React, and TypeScript client scaffold, a pure TypeScript document-session domain foundation, local PDF opening/rendering, and temporary overlay editing for text and whiteout.

The current UI supports selecting or dropping one PDF, validating basic file properties and signature bytes, opening the document through PDF.js, rendering the current page to a canvas, adding text and whiteout DOM overlays, selecting, moving, resizing, duplicating, deleting, editing text, bounded toolbar zoom, modified-wheel zoom, dirty-state indication, and discard confirmation.

All files referenced by `docs/DOCUMENT_INDEX.md` are present.

## Detected technology stack

- Package manager: npm with `package-lock.json`.
- Runtime expectation: Node.js 22 or newer.
- Application: Vite static SPA.
- UI: React.
- Language: TypeScript with strict compiler settings.
- Domain: pure TypeScript, independent from React, DOM APIs, browser adapters, PDF.js, and pdf-lib.
- Application: editor service with document lifecycle, explicit text/whiteout use cases, page-coordinate overlays, dirty state, replacement/close discard flow, and wheel zoom.
- Infrastructure: browser local file reader, beforeunload warning adapter, and PDF.js open/render adapter.
- Tests: Vitest, React Testing Library, jsdom, and Playwright.
- Quality: ESLint and Prettier.
- CI: GitHub Actions workflow should run install, diagnostics, format check, typecheck, lint, tests, production build, and e2e tests on Node 22.

## Missing foundations

- PDF export adapter and download flow.
- Signature, initials, checkmark, image, date, and form-filling tools.
- Undo/redo command history.
- Page organization tools.
- Full PDF fixture set beyond generated synthetic e2e PDFs.
- Content Security Policy hardening for deployment.
- Larger-device and large-document performance policies.

## Risks or contradictions

- Text and whiteout edits are temporary and cannot be downloaded yet.
- Whiteout is visual cover only and must not be described as secure redaction.
- PDF.js adds a large production chunk; later code splitting may be useful.
- Browser memory cleanup cannot be guaranteed immediately; the app releases references and disposes sessions.
- The current implementation includes basic mouse/touch transforms but not a full accessibility audit for all pointer actions.

## Recommended first implementation milestone

Implement export planning for current text and whiteout overlays, still preserving the original PDF and keeping pdf-lib or any export library behind an infrastructure adapter.

## Exact files expected to change in the next task

- `src/application/editor-application.ts` or a new export planning use case.
- `src/infrastructure/pdf/` for export adapter implementation.
- `src/presentation/pages/EditorPage.tsx` for enabling Download only when export exists.
- Unit, component, and Playwright tests for export.
- `PROJECT_STATUS.md`.
- `docs/01-architecture/PDF_ENGINE_ARCHITECTURE.md` and export-related docs.
