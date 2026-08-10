# Project Philosophy

NestlyPDF favors small, local, understandable workflows over platform breadth.

## Principles

- Keep document data in the browser.
- Make common PDF fixes fast without accounts, uploads, subscriptions, or watermarks.
- Prefer explicit application use cases over UI-owned business rules.
- Preserve the original PDF and model user additions as temporary overlay elements until export.
- Be honest about limitations, especially whiteout and memory disposal.
- Add complexity only when a current phase requires it.

## Current editing posture

The current proof of concept supports temporary text and whiteout overlays and exports those overlays into a new browser-generated PDF. It does not edit existing PDF text and does not securely redact content.
