# Testing Strategy

## Test pyramid

1. Many fast domain and application unit tests.
2. Focused adapter integration tests.
3. Component tests for interaction behavior.
4. A small set of critical end-to-end workflows.

## TDD expectations

For each behavior:

- red: add a failing test;
- green: implement the minimum behavior;
- refactor: improve structure with tests passing.

## Current viewer coverage

- Local PDF signature, empty-file, oversized-file, and read-failure validation.
- Application open, failed replacement preservation, successful replacement disposal, close disposal, page navigation boundaries, zoom limits, fit width, render cancellation, and stale render protection.
- PDF.js adapter isolation through mocked library-boundary tests.
- Component coverage for landing picker, drag-and-drop validation, invalid file errors, editor controls, disabled download, and close flow.
- Playwright smoke coverage for opening, rendering, zooming, closing, and avoiding external document requests.
- Architecture tests preventing PDF.js leakage, direct `DocumentSession` presentation access, persistence APIs, service workers, analytics, telemetry, remote assets, fetch, and XMLHttpRequest.

## Required coverage areas

- coordinate conversion;
- editor element validation;
- operation application;
- undo and redo;
- page ordering;
- form values;
- export planning;
- session cleanup;
- unload warning;
- network isolation.

## Privacy tests

Automated browser tests must verify that opening, editing, and exporting a PDF does not create network requests containing document bytes or derived content. The current viewer smoke test checks for external requests while opening and rendering a synthetic PDF.

## Snapshot testing

Avoid broad UI snapshots. Prefer behavioral assertions and focused visual regression tests for the editor canvas and responsive layouts.
