# QuickPDF Roadmap

This folder defines the roadmap after completion of the `05-ui` milestone.

## Completed milestones

- `00-product`
- `01-architecture`
- `02-domain`
- `03-engineering`
- `04-security`
- `05-ui`

## Next milestone: `06-delivery`

Recommended order:

1. Progressive Web App
2. Version 1.0 release preparation
3. Project Save/Open
4. Performance and memory optimization
5. Accessibility completion
6. Browser compatibility
7. Localization
8. Future editing features

## Documents

- [PWA.md](PWA.md)
- [VERSION_1_0_RELEASE.md](VERSION_1_0_RELEASE.md)
- [PROJECT_FORMAT.md](PROJECT_FORMAT.md)
- [PERFORMANCE.md](PERFORMANCE.md)
- [ACCESSIBILITY.md](ACCESSIBILITY.md)
- [BROWSER_COMPATIBILITY.md](BROWSER_COMPATIBILITY.md)
- [LOCALIZATION.md](LOCALIZATION.md)
- [FEATURE_BACKLOG.md](FEATURE_BACKLOG.md)

## Roadmap rules

- Preserve browser-local document processing.
- Do not introduce accounts, cloud storage, analytics, or automatic persistence without an explicit product decision.
- Keep the original PDF unchanged until export.
- Treat Whiteout as visual masking, not secure redaction.
- Keep phone Quick Edit intentionally simpler than the full desktop and tablet editor.
