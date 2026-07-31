# QuickPDF Responsive Design

## Purpose

QuickPDF must remain usable on desktop, tablet, and mobile without turning the PDF into a small secondary preview.

The PDF remains the visual priority at every size.

## Breakpoint strategy

Use content-driven breakpoints rather than device-name assumptions.

Suggested starting ranges:

- wide desktop: `≥ 1280px`;
- desktop/laptop: `960–1279px`;
- tablet: `640–959px`;
- mobile: `< 640px`.

These values may be adjusted when real layout tests justify it.

## Wide desktop

Recommended:

- sticky top toolbar with full labels where useful;
- central scrollable PDF viewport;
- compact right-side inspector or horizontal inspector below toolbar;
- visible document status;
- page/navigation controls integrated in toolbar or status region.

Avoid excessive empty sidebars.

## Desktop and laptop

- toolbar groups remain visible but may use icon-first controls;
- floating inspector prefers horizontal layout below toolbar;
- viewport uses remaining height;
- page canvas remains centered with comfortable neutral margins;
- horizontal scrolling appears only when zoom requires it.

## Tablet

- increase touch targets to at least `44px`;
- allow toolbar horizontal scrolling by groups;
- pin the most important actions: Select, Text, Whiteout, Signature, Image, Undo, Redo, Download;
- secondary view/page controls may use an overflow menu;
- inspector may wrap into two compact rows or become an anchored sheet;
- resize handles must be touch-friendly;
- pointer gestures must support pen and touch.

## Mobile portrait

The desktop toolbar must not simply shrink.

Recommended structure:

```text
Compact header/status
Scrollable PDF viewport
Sticky bottom primary tool bar
Contextual bottom sheet or compact inspector
```

Primary bottom tools may include:

- Select;
- Text;
- Whiteout;
- Signature;
- More;
- Download.

Undo/Redo remain easy to reach through the header or bottom toolbar.

Secondary tools use a sheet/drawer.

The inspector:

- becomes a bottom sheet, compact floating bar, or horizontally scrollable panel;
- must not permanently obscure most of the page;
- collapses when selection clears;
- supports safe-area insets.

## Mobile landscape

- use the extra width for a compact side tool rail or horizontal toolbar;
- keep the PDF centered and maximized;
- avoid tall bottom sheets that consume most of the viewport;
- preserve access to Download and Undo/Redo.

## Sticky behavior

Desktop/tablet:

- main toolbar remains sticky at the top of the editor shell;
- inspector remains visible under it or beside the viewport.

Mobile:

- primary toolbar may be sticky at the bottom;
- header/status remains compact;
- contextual inspector must account for the primary toolbar and safe areas.

No sticky element may overlap another without a defined stack order.

## Toolbar adaptation

Priority order when space decreases:

1. Keep Download visible.
2. Keep active tool and primary creation tools visible.
3. Keep Undo/Redo visible.
4. Collapse labels to icons with tooltips/accessibility names.
5. Move low-frequency controls into an overflow menu.
6. Allow group-level horizontal scrolling.

Do not hide the active tool state.

## Landing page

Desktop:

- large centered drop zone;
- generous whitespace;
- privacy reassurance in one row.

Mobile:

- nearly full-width drop zone;
- large Choose PDF button;
- concise copy;
- privacy points wrap naturally;
- avoid requiring the user to scroll before reaching the primary action.

## Touch interactions

- minimum target: `44 × 44px`;
- resize handles must exceed desktop visual size while preserving page-space geometry;
- no hover-only action;
- one tap selects;
- text editing has a clear touch-accessible entry, not double-tap only;
- drag gestures use pointer capture;
- pinch/modified-wheel behavior must not conflict with page scroll.

## Inspector behavior

The inspector must remain available while selected, but compact.

Wide:

- horizontal bar or right-side panel.

Tablet:

- wrapped bar or small anchored sheet.

Mobile:

- bottom sheet with a collapsed header;
- only current element controls;
- destructive action visually separated;
- does not trap focus unless presented as a modal sheet.

## Dialogs and sheets

Desktop:

- centered modal.

Mobile:

- bottom sheet preferred for signature, initials, image selection, and tool menus;
- respect safe-area insets;
- retain focus management and Escape/back behavior.

## PDF viewport

- use `100dvh` or equivalent carefully to handle mobile browser chrome;
- do not lock body scrolling in ways that break dialogs or accessibility;
- central editor viewport owns document scrolling;
- maintain canvas/overlay alignment across responsive changes;
- rerender or recompute fit width after meaningful viewport resize.

## Orientation changes

On orientation change:

- preserve current page;
- preserve document zoom when practical;
- recompute fit width if active;
- preserve selected element;
- do not create history or dirty-state changes;
- avoid losing dialog state unless the layout cannot safely preserve it.

## Accessibility and zoom

- browser text/page accessibility zoom must remain possible outside the editor's handled viewer shortcuts;
- layout must not become unusable at browser zoom levels required for accessibility;
- controls must wrap or scroll instead of disappearing;
- do not rely on fixed pixel heights that clip content.

## Testing matrix

At minimum test:

- desktop mouse/keyboard;
- laptop-size viewport;
- tablet touch/pen simulation;
- mobile portrait;
- mobile landscape;
- reduced motion;
- increased browser text/page zoom;
- long PDF page at high viewer zoom;
- floating inspector while scrolling;
- safe-area behavior where supported.
