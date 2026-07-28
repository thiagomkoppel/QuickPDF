# Project Status

## Current phase

Phase 0 - Architecture and technical proof of concept.

## Product status

Repository foundation initialized. The project now has a Vite, React, and TypeScript static client scaffold with strict TypeScript, ESLint, Prettier, Vitest, React Testing Library, jsdom, Playwright configuration, CI workflow, and a minimal accessible application shell.

The first pure domain foundation is implemented: `DocumentSession`, page identity/order handling, minimal editor elements, selection, dirty-state tracking, page deletion, typed domain failures, and disposal behavior.

No PDF product functionality exists yet.

## Current objective

Prove that the application can safely and reliably:

1. open a local PDF without uploading it;
2. render one or more pages;
3. add text and a signature as overlay elements;
4. export a valid PDF containing those additions;
5. discard the document and editing state when the session ends.

## Required Phase 0 deliverables

- Static web application scaffold. Done.
- Strict TypeScript configuration. Done.
- Test runner and browser test environment. Done for unit/component tests; Playwright is configured for later end-to-end tests.
- PDF engine abstraction. Not started.
- Local file adapter. Not started.
- In-memory document session. Started with pure domain model; application use case integration not started.
- PDF rendering proof of concept. Not started.
- PDF export proof of concept. Not started.
- Text element. Started as minimal domain element type only; no UI or export behavior.
- Signature element. Not started.
- Undo and redo proof of concept. Not started.
- Privacy verification showing no document network requests. Started with static privacy baseline tests only.
- Automated tests for the full proof-of-concept flow. Not started.

## Not started

- PDF loading, rendering, editing, signing, and export.
- Application use cases for document opening or editing.
- Production UI.
- Interactive form filling.
- Page organization UI.
- Mobile interaction design beyond the initial responsive shell.
- Whiteout and correction tools beyond a minimal domain element type.
- Accessibility audit.
- Large-document performance work.

## Blocking decisions

- Canvas/SVG overlay implementation.
- Exact PDF export library after proof-of-concept validation.

## Recent assessment

Document-session domain foundation implemented on 2026-07-28 using strict TDD and pure TypeScript. Repository foundation implemented on 2026-07-28 using Vite, React, TypeScript, npm, Vitest, React Testing Library, jsdom, ESLint, Prettier, and Playwright configuration. The Vite SPA choice is documented in ADR-004.
