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
