# Browser Compatibility

## Supported browser policy

NestlyPDF decides renderer support from a local PDF.js capability preflight, not browser names, versions, operating-system versions, or device models. The preflight uses only bundled static probe bytes; it never reads a user-selected PDF.

## Preflight outcomes

The root application bootstrap starts in `checking` and immediately displays the startup screen. The preflight then returns one of:

- `compatible`: the required browser APIs were available, the installed PDF.js module initialized its worker, and a tiny PDF rendered visible pixels to a canvas.
- `incompatible`: a required API, PDF.js module, worker, canvas, or render probe definitively failed.
- `indeterminate`: the lightweight probe did not finish within its bounded time. NestlyPDF leaves the upload controls available rather than falsely blocking a browser.

The startup screen remains visible for at least five seconds and until the probe resolves. Only a completed `incompatible` result shows the compatibility panel. Compatible and indeterminate environments never see it, including during startup; indeterminate results continue into the normal application and retain the existing pre-open safety guard.

## Required capabilities

NestlyPDF checks the APIs needed across its local PDF workflow:

- `Promise`
- `ReadableStream`
- `AbortController`
- `TextDecoder`
- `TextEncoder`
- `Worker`
- `WebAssembly`
- `ResizeObserver`
- `URL.createObjectURL`
- a usable 2D canvas

The probe then verifies PDF.js worker initialization and actual canvas rendering. Optional APIs such as `OffscreenCanvas` and bitmap-transfer APIs are not required.

## Known limitation

A browser can be classified incompatible only when the actual local probe fails. For example, an older Firefox browser on Android remains usable if it satisfies the required APIs and successfully runs the bundled PDF.js probe. A browser that completes PDF.js parsing but produces blank canvas output fails the render probe and receives the compatibility guidance before any user PDF is selected.

## User-facing behavior

The compatibility panel is an accessible alert shown only for confirmed renderer incompatibility. It explains that the browser cannot reliably display PDFs and directs the user to browser support or another device. It does not label a document invalid, corrupt, or unreadable.

## Privacy

The preflight runs entirely in memory with a static PDF fixture compiled into the application. It does not upload document bytes, inspect a selected document, store browser fingerprints, or use analytics.
