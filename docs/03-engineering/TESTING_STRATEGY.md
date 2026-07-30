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

Automated browser tests must verify that opening, editing, and exporting a PDF does not create network requests containing document bytes or derived content.

## Snapshot testing

Avoid broad UI snapshots. Prefer behavioral assertions and focused visual regression tests for the editor canvas and responsive layouts.

## Export coverage

Current tests cover:

- top-left overlay to bottom-left PDF coordinate mapping;
- page-size variation in export coordinates;
- application export use case behavior and failure preservation;
- deterministic whiteout-before-text export ordering;
- browser download object URL cleanup;
- `pdf-lib` export preserving page count and dimensions;
- architecture isolation for PDF libraries.

## Rendering coverage

Current render tests cover:

- PDF.js render document loading and opaque document ids;
- canvas CSS dimensions and device-pixel-ratio backing dimensions;
- PDF.js render task invocation;
- render loading and failure states in the editor;
- stale render cancellation and cleanup;
- page-change and zoom-triggered rerenders;
- overlay scaling relative to canvas CSS dimensions;
- absence of the old placeholder-only page path;
- Playwright verification that a visible synthetic PDF renders to nonblank canvas pixels before overlays are added and remains visually changed after export/reopen.
