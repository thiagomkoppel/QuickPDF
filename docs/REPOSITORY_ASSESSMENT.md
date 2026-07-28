# Repository Assessment

Assessment date: 2026-07-28

## Current state

The repository is initialized as a Phase 0 foundation. It contains project documentation, a static Vite, React, and TypeScript client scaffold, and a pure TypeScript document-session domain foundation. The scaffold includes a minimal accessible shell with `/`, `/editor`, and not-found routes, but no PDF loading, rendering, editing UI, signing, or export functionality.

All files referenced by `docs/DOCUMENT_INDEX.md` are present.

## Detected technology stack

- Package manager: npm with `package-lock.json`.
- Runtime expectation: Node.js 20.19 or newer.
- Application: Vite static SPA.
- UI: React.
- Language: TypeScript with strict compiler settings.
- Domain: pure TypeScript, independent from React, DOM APIs, browser adapters, PDF.js, and pdf-lib.
- Tests: Vitest, React Testing Library, jsdom, and Playwright configuration for later end-to-end tests.
- Quality: ESLint and Prettier.
- CI: GitHub Actions workflow for install, format check, typecheck, lint, tests, and production build.

## Missing foundations

- PDF fixture directory with small non-confidential test PDFs.
- Application use cases around the domain model.
- PDF, browser file, download, lifecycle, time, and ID ports.
- PDF.js rendering adapter and export adapter.
- Browser lifecycle and cleanup adapters.
- Real privacy/network-isolation browser tests for document workflows.
- End-to-end tests for proof-of-concept PDF flows.
- Undo/redo history model.

## Risks or contradictions

- Canvas/SVG overlay implementation remains unresolved.
- The export library remains unresolved until Phase 0 proof-of-concept validation.
- Static privacy checks guard against obvious persistence, analytics, service worker, and remote asset usage, and domain disposal clears abstract references, but document network-isolation cannot be proven until document handling exists.
- Playwright is configured, but no end-to-end tests are included yet because PDF workflows are intentionally unimplemented.

## Recommended first implementation milestone

Begin the Phase 0 application boundary with TDD:

- introduce application-facing use cases for creating and disposing an in-memory `DocumentSession` from already-known page metadata;
- define time and ID generation ports only where needed;
- keep file bytes, PDF parsing, browser file APIs, PDF.js, and pdf-lib out of scope until their adapter tasks.

## Exact files expected to change in the next task

- `src/application/` use case files.
- `src/domain/` only if the application boundary reveals a missing invariant.
- focused application/domain tests.
- `PROJECT_STATUS.md`.
- Relevant architecture or domain documentation if public behavior changes.
