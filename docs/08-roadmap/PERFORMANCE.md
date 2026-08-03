# Performance and Memory Roadmap

## Goal

Keep QuickPDF responsive on large PDFs and memory-constrained mobile devices.

## Priorities

### Rendering

- Render only the current page at full resolution.
- Cancel obsolete PDF.js tasks.
- Reuse completed render results when safe.
- Recalculate fit modes only when required.

### Thumbnails

- Lazy-render thumbnails.
- Use a bounded thumbnail cache.
- Release thumbnails after document replacement.

### Fonts and export

- Load custom fonts only when needed.
- Embed each custom font once per export.
- Reuse fonts and images.
- Show progress for long exports.

### Mobile

- Limit simultaneous renders.
- Release temporary canvases.
- Avoid oversized backing canvases.
- Prevent gesture-driven render storms.

## Measurements

Track locally during development:

- bundle size
- open time
- render time
- thumbnail time
- export time
- peak memory

Do not add production analytics without a separate privacy decision.
