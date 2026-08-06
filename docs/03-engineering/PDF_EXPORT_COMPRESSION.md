# PDF Export Compression

QuickPDF exposes two export-only modes. **Original Size** is the default and uses the existing pdf-lib export gateway without quality changes. **Compress PDF** first creates the final edited PDF, then rasterizes each final page locally with PDF.js at 150 DPI and JPEG quality 0.82 before rebuilding a PDF with the original page dimensions.

Compression processes one page at a time and releases each canvas before the next page. It never changes session bytes, overlays, history, or the source document. Because the compressed output is rasterized, selectable text, forms, metadata, and other original PDF semantics may be flattened. The UI discloses this.

The application compares compressed bytes with the normal final export. If the rasterized result is not smaller, it does not download it as compressed and reports that Original Size should be used instead. Compression can be cancelled through an AbortSignal; cancellation stops future pages and leaves the active editor session unchanged. No document bytes leave the browser.
