# ADR-004: Vite React Static SPA

## Status

Accepted.

## Context

Phase 0 requires a browser-only foundation that can be developed and validated quickly while preserving the local-only product promise. The repository needs strict TypeScript, fast unit and component tests, a production build, and static hosting compatibility without introducing backend behavior.

## Decision

QuickPDF will use Vite, React, and TypeScript as a static client-side application. The application will not use server-side rendering, backend document processing, authentication, a database, cloud storage, analytics, telemetry, remote fonts, or external scripts.

npm is the selected package manager unless a future decision changes it.

## Consequences

### Positive

- Static hosting remains sufficient.
- The application shell is simple and browser-only.
- Vite provides fast local development and production builds.
- React component tests can run with Vitest, React Testing Library, and jsdom.
- Browser end-to-end tests can be added with Playwright as real PDF workflows appear.

### Negative

- Browser capability and memory limits remain the application's responsibility.
- Offline behavior depends on static asset loading and future caching decisions.
- Any future server-side feature would require a new architecture decision and scope review.
