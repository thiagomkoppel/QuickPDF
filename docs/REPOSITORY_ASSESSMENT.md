# Repository Assessment

Assessment date: 2026-07-28

## Current state

The repository is initialized as a Phase 0 foundation. It contains project documentation, a static Vite, React, and TypeScript client scaffold, a pure TypeScript document-session domain foundation, and the first working browser product feature: local PDF open and render.

The current UI supports selecting or dropping one PDF, validating basic file properties and signature bytes, opening the document through PDF.js, rendering only the current page to a canvas, navigating pages, changing zoom, fitting width, and closing the document to release active viewer references. Editing tools and export remain deferred.

All files referenced by `docs/DOCUMENT_INDEX.md` are present.

## Detected technology stack

- Package manager: npm with `package-lock.json`.
- Runtime expectation: Node.js 22 or newer.
- Application: Vite static SPA.
- UI: React.
- Language: TypeScript with strict compiler settings.
- Domain: pure TypeScript, independent from React, DOM APIs, browser adapters, PDF.js, and pdf-lib.
- Application: viewer use case boundary with stable state, navigation, zoom, render cancellation, and disposal behavior.
- Infrastructure: browser local file reader and PDF.js open/render adapter.
- Tests: Vitest, React Testing Library, jsdom, and Playwright.
- Quality: ESLint and Prettier.
- CI: GitHub Actions workflow for install, diagnostics, format check, typecheck, lint, coverage tests, production build, and Playwright e2e tests.

## Missing foundations

- Export adapter and download flow.
- Overlay editing use cases and presentation tools.
- Signature, date, checkmark, image, whiteout, and form-filling UI.
- Undo/redo history model.
- PDF fixture directory with broader small non-confidential test PDFs.
- Browser lifecycle unsaved-work warning for dirty edited documents.
- Content Security Policy hardening for deployment.
- Large-document and page-count safety policy beyond the current configurable file size limit.

## Risks or contradictions

- The repository now uses `pdfjs-dist@latest` resolved in the lockfile; long-term dependency pinning policy should be decided before MVP hardening.
- PDF.js contributes a large production chunk; future code splitting or worker strategy may be needed for performance.
- Current validation checks practical PDF signature bytes but does not prove a file is safe; PDFs remain untrusted input.
- Current close behavior releases application references and clears canvas pixels where practical, but cannot promise immediate memory erasure.
- Local Node used for this task was newer than the documented Node 22 baseline.

## Recommended first implementation milestone

Implement the next Phase 0 feature behind the existing boundaries: add a minimal text overlay element on the rendered page using application use cases and domain commands, without export yet unless that task explicitly includes it.

## Exact files expected to change in the next task

- `src/application/pdf-viewer.ts` or a new focused editor use case module.
- `src/domain/document-session.ts` only if a missing invariant is discovered.
- `src/presentation/pages/EditorPage.tsx` and `src/presentation/styles/global.css` for text tool UI.
- Focused tests in `src/application/`, `src/app/`, and possibly `e2e/`.
- `PROJECT_STATUS.md`.
- Relevant architecture or UI documentation if behavior changes.
