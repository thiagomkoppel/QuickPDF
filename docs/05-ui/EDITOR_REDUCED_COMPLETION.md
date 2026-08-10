# NestlyPDF Editor Completion Specification

## Goal

Finish the editor UX in one pass. Preserve existing architecture and functionality. Use the approved Option 2 reference image as the visual target.

## Required fixes

1. **Page navigation**
   - Previous, Next, and thumbnail clicks must work.
   - Current page, selected thumbnail, toolbar/status indicators, and rendered page must stay synchronized.
   - Use stable page IDs and ordered page metadata.
   - No dirty state or history changes.

2. **Real thumbnails**
   - Render actual PDF.js page previews.
   - Preserve aspect ratio, show loading state, highlight current page.
   - Clean up render tasks on close, replacement, and unmount.
   - Browser-local only.

3. **Fit modes**
   - Manual, 100%, Fit Page, Fit Width.
   - Fit Page: `min(availableWidth / pageWidth, availableHeight / pageHeight)`.
   - Fit Width: `availableWidth / pageWidth`.
   - Use actual workspace dimensions and padding.
   - Recalculate on resize, page change, rail collapse/expand, inspector width change, and document open.
   - Do not overwrite manual zoom unless Fit is selected.
   - Show the real resulting percentage.
   - No dirty state or history.

4. **Signature and Initials dialogs**
   - Redesign completely to match the approved UI.
   - Signature: Draw / Type / Upload.
   - Initials: Draw / Type.
   - Dark professional modal, compact layout, Clear / Cancel / Accept, close button, focus management, Escape.
   - No legacy purple styling.

5. **Right inspector**
   - Width 300–340px.
   - Match the approved reference.
   - Compact, readable, minimal borders.
   - Text priority: Content, Font, Size, Actions.
   - Group Duplicate and Delete.
   - Clean Document state with no selection.
   - Preserve existing behavior.

6. **Black defaults**
   - New Text, Date, Signature, Initials, Checkmark, and Cross default to `#000000`.
   - Uploaded images retain original colors.
   - Whiteout remains white.
   - Preserve through duplicate, copy/paste, Undo/Redo, and export.

7. **Toolbar and More**
   - Remove More on desktop if all actions fit.
   - No nonfunctional controls.
   - Keep icon-first grouped toolbar.
   - No `ACTIVE` text; use visual state plus `aria-pressed`.

8. **Scrolling**
   - Keep wheel, trackpad, keyboard scrolling, and drag-to-pan.
   - Hide native visual scrollbars.
   - Do not break overlay interactions.

9. **Large-screen scaling**
   - Increase logo, icons, labels, and click targets on large displays.
   - Use responsive `clamp()` tokens.
   - Do not shrink text just to fit.
   - Keep the PDF dominant.

## Tests

Cover navigation, thumbnails, Fit modes, resize recalculation, Signature/Initials dialogs, inspector, black defaults/export, desktop More removal, and existing editor/export workflows. No skipped tests.

## Visual review

Use a real multi-page PDF. Verify all required behavior and capture screenshots for:

- full editor
- thumbnails
- Fit Page
- Fit Width
- Signature dialog
- Initials dialog
- Text inspector

## Validation

Run:

- `npm run format:check`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:ci`
- `npm run build`
- `npm run test:e2e`
- `git diff --check`

Do not commit automatically.

## Completion rule

Do not stop for intermediate progress reports unless there is a genuine blocker. Return one final report only after the full reduced scope is complete and visually reviewed.
