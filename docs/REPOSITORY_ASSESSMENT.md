# Repository Assessment

Assessment date: 2026-07-28

## Current state

The repository is initialized as a Phase 0 foundation. It contains project documentation, a static Vite, React, and TypeScript client scaffold, a pure TypeScript document-session domain foundation, and a pure TypeScript application boundary around that domain. The scaffold includes a minimal accessible shell with `/`, `/editor`, and not-found routes, but no PDF loading, rendering, editing UI, signing, or export functionality.

All files referenced by `docs/DOCUMENT_INDEX.md` are present.

## Detected technology stack

- Package manager: npm with `package-lock.json`.
- Runtime expectation: Node.js 22 or newer. GitHub Actions uses `node-version: 22`.
- Application: Vite static SPA.
- UI: React.
- Language: TypeScript with strict compiler settings.
- Domain: pure TypeScript, independent from React, DOM APIs, browser adapters, PDF.js, and pdf-lib.
- Application layer: pure TypeScript services and DTO snapshots, independent from React, presentation, browser APIs, storage, networking, and PDF libraries.
- Tests: Vitest, React Testing Library, jsdom, and Playwright configuration for later end-to-end tests.
- Quality: ESLint and Prettier.
- CI: GitHub Actions workflow for install, format check, typecheck, lint, tests, and production build.

## Missing foundations

- PDF fixture directory with small non-confidential test PDFs.
- PDF, browser file, download, lifecycle, time, and additional ID ports where needed.
- PDF.js rendering adapter and export adapter.
- Browser lifecycle and cleanup adapters.
- Real privacy/network-isolation browser tests for document workflows.
- End-to-end tests for proof-of-concept PDF flows.
- Undo/redo history model.
- UI wiring to application use cases for real document editing.

## Risks or contradictions

- Canvas/SVG overlay implementation remains unresolved.
- The export library remains unresolved until Phase 0 proof-of-concept validation.
- Static privacy checks guard against obvious persistence, analytics, service worker, and remote asset usage, and domain/application disposal clears active references, but document network-isolation cannot be proven until document handling exists.
- Playwright is configured, but no end-to-end tests are included yet because PDF workflows are intentionally unimplemented.

## Recommended first implementation milestone

Begin the Phase 0 PDF boundary with TDD:

- define application-owned PDF loading/rendering/export ports without PDF.js or pdf-lib leakage;
- add tests that verify domain/application code remains independent from PDF library objects;
- keep browser file APIs and actual PDF adapters deferred until port contracts are established.

## Exact files expected to change in the next task

- `src/application/` port definitions or use-case contract files.
- `src/infrastructure/pdf/` only if a minimal adapter proof is explicitly in scope.
- focused application/architecture tests.
- `PROJECT_STATUS.md`.
- Relevant architecture documentation if public contracts change.
