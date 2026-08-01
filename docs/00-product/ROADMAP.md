# QuickPDF Roadmap

## ✅ Phase 1 — Foundation and Core Editor

Status: Completed

- Static browser-only application
- Local PDF upload and drag-and-drop
- Real PDF.js page rendering
- Page navigation and viewer-only zoom
- Text overlays
- Whiteout overlays
- Signatures
- Initials
- Selection, move, resize, duplicate, delete, and session-local copy/paste
- Dirty-state warnings
- Browser-local PDF export
- No backend, database, accounts, cloud storage, or persistence

## ✅ Phase 2 — Undo and Redo

Status: Completed

### ✅ Phase 2.1 — History Foundation

- Application-owned command history
- Add, paste, delete, and duplicate history
- Undo and Redo toolbar controls
- Keyboard shortcuts
- Revision-based dirty tracking
- History reset on document close or replacement

### ✅ Phase 2.2 — Gesture History

- Undoable move gestures
- Undoable resize gestures
- Undoable font-size changes
- One history entry per completed gesture
- Cancelled gestures restore the starting state
- Pointer previews do not create history entries

### ✅ Phase 2.3 — Text Edit History

- Coalesced text-edit sessions
- Paste, cut, replacement, Backspace, and Delete support
- IME and composition-safe editing
- Undo and Redo while editing
- Helvetica, Times Roman, and Courier support
- Undoable font-family changes
- Standard-font PDF export

## ✅ Completed Phase 3 - Remaining Overlay Tools

Status: Completed

- Insert PNG and JPEG images
- Add checkmarks
- Add crosses
- Add dates captured at placement time in deterministic `MM/DD/YYYY` format
- Reuse the existing overlay lifecycle
- Add Undo and Redo support
- Export exactly as displayed

### Definition of Done

- Every new overlay supports select, move, resize, duplicate, delete, copy, paste, Undo, Redo, and export.
- All data remains browser-local and session-only.
- Automated and end-to-end tests pass.

## ⏳ Phase 4 — Complete UI Redesign

Status: Planned

- Modern landing page
- Large, polished drag-and-drop experience
- Final editor toolbar and inspector layout
- Finalized design system
- Consistent iconography
- Responsive desktop, tablet, and mobile layouts
- Refined spacing, typography, states, and animations
- No prototype or placeholder interface remaining

### Definition of Done

- Landing page and editor follow the approved design system.
- The PDF remains the visual priority.
- All current features fit naturally into the final interface.
- Desktop, tablet, and mobile behavior are intentionally designed and tested.

## ⏳ Phase 5 — Existing PDF Form Filling

Status: Planned

- Detect AcroForm fields
- Fill text fields
- Toggle checkboxes
- Select radio buttons
- Use dropdown fields
- Preserve or flatten form values during export
- Add Undo and Redo support for form edits

### Definition of Done

- Supported existing forms can be filled and downloaded locally.
- Form editing does not introduce a form designer.
- Browser-local privacy guarantees remain unchanged.

## ⏳ Phase 6 — Page Operations

Status: Planned

- Rotate pages
- Delete pages
- Reorder pages
- Duplicate pages
- Insert blank pages
- Extract selected pages
- Add page thumbnail navigation
- Add Undo and Redo support for page operations

### Definition of Done

- Page operations preserve valid PDF structure and output.
- Each operation is undoable and redoable.
- Large-document behavior remains understandable and stable.

## ⏳ Phase 7 — Release Hardening

Status: Planned

- Accessibility audit
- Cross-browser testing
- Mobile and touch QA
- Large and unusual PDF testing
- Memory and resource cleanup
- Performance optimization
- PDF dependency code splitting
- Error-message refinement
- Export fidelity testing
- Production deployment
- Release checklist

### Definition of Done

- Critical workflows pass on supported browsers and devices.
- Accessibility requirements are validated.
- No known critical privacy, data-loss, rendering, or export defects remain.
- Production deployment and rollback procedures are documented.

## Later or Optional Features

These are not required for the initial strong release:

- Freehand drawing
- Highlights
- Stamps
- Merge or split multiple PDFs
- Compression
- Password-protected PDF support
- OCR
- Secure redaction
- Native editing of arbitrary existing PDF text
- Custom uploaded fonts
- Cloud storage or collaboration

Any optional feature must preserve the core workflow:

> Open → Edit → Download → Done

If a feature makes that workflow slower, more complicated, or visually busier, it should be rejected unless there is a compelling product reason.
