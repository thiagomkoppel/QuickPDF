# ADR-003: PDF Engine Boundary

## Status

Accepted.

## Context

The application may use PDF.js for rendering and another library for export. Library-specific types can create tight coupling and make future replacement difficult.

## Decision

PDF loading, rendering, form handling, page manipulation, and export will be accessed through application-owned ports. Infrastructure adapters contain library-specific code.

## Consequences

- Domain and UI remain testable without PDF libraries.
- Libraries can be replaced or combined.
- Initial implementation requires more interface design.
- Adapter integration tests are mandatory.
