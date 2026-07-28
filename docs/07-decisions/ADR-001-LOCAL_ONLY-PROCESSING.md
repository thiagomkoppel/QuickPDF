# ADR-001: Local-Only Document Processing

## Status

Accepted.

## Context

The product exists to solve quick PDF completion without accounts, uploads, subscriptions, or document retention.

## Decision

All document loading, rendering, editing, and export processing will occur in the browser. The application will be deployable as static assets and will not require a document-processing backend.

## Consequences

### Positive

- Strong privacy story.
- Minimal infrastructure.
- No document storage costs.
- No account system.
- Reduced breach exposure.

### Negative

- Performance depends on the user's device.
- Some large or complex PDFs may not be supported.
- Server-only conversion and OCR tools are unavailable.
- Browser memory constraints must be handled carefully.
