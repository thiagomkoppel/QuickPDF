# Error Handling

## Principles

- Expected failures use typed results or typed errors.
- User-facing errors explain what happened and what the user can do next.
- Internal errors must not expose document content.
- A failure in one page render should not automatically destroy the session.
- Export failures preserve edits.

## Error categories

- UnsupportedFile
- InvalidPdf
- EncryptedPdf
- UnsupportedPdfFeature
- RenderFailure
- ExportFailure
- BrowserCapabilityUnavailable
- FileTooLargeForDevice
- SessionClosed
- InvalidOperation

## Logging

Development logs may include identifiers and technical metadata, but never PDF bytes, extracted text, form values, signatures, image content, or filenames in production telemetry.
