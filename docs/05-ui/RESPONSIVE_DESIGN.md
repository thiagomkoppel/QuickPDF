# NestlyPDF Responsive Design

## Purpose

NestlyPDF must remain usable on desktop, tablet, and mobile without turning the PDF into a small secondary preview.

The PDF remains the visual priority at every size.

NestlyPDF uses fluid responsive density across width and height. UI spacing, controls,
typography, panels, and inspector content must adapt from phones through large desktops while
preserving accessibility and full functionality.

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

Tablet uses a dedicated **Quick Edit** presentation, shared by portrait and landscape. It deliberately follows the phone PDF-first interaction model instead of compressing the desktop editor into a touch viewport. The editor determines its form factor centrally from the current visual viewport, orientation, shortest viewport edge, and actual touch capability (`pointer: coarse` or touch points). It does not use width alone, so a wide physical tablet remains tablet Quick Edit rather than accidentally becoming desktop.

- touch-capable viewport with a shortest edge below `768px`: Phone Quick Edit;
- touch-capable viewport with a shortest edge from `768px` through `1024px`: Tablet Quick Edit;
- non-touch viewports remain desktop, including desktop browser windows at tablet-like CSS widths.

Tablet Quick Edit uses one stable structure in both orientations. It also shows the existing dismissible, session-only Quick Edit notice used on phones; the notice copy is unchanged and directs users to the full toolset on a larger device:

```text
Compact header
Primary toolbar
PDF workspace
Page / zoom bar
Temporary contextual sheet
```

The primary toolbar contains Select, Text, Image, Signature, Checkmark, Date, and More. Whiteout, Initials, and Cross move behind More. Page thumbnails use a temporary drawer, and the contextual inspector is a temporary bottom sheet that opens only when requested or when an element is selected. Both surfaces have explicit close controls and do not permanently consume PDF workspace. Page navigation, zoom, history, export, layers, and privacy behavior remain unchanged; only their permanent presentation changes.

### Light Mode

Phones and tablets expose a session-only **Editor performance profile** with `Automatic`, `Light Mode`, and `Full Quality` choices. Automatic selects Light Mode only for touch devices that report limited hardware capacity; it never downgrades desktop browsers automatically.

Light Mode preserves the same page-space geometry, overlays, interactions, history, export, and privacy behavior. It lowers only presentation cost by rendering visible pages and thumbnails at a 1x backing scale, reducing thumbnail dimensions, and disabling editor-only animation, blur, and shadow effects. Users can switch back to Full Quality at any time, and no preference or document data is persisted.
Across tablet Quick Edit:

- all editor tools remain available, with secondary tools in More;
- toolbar controls use at least `48px` touch targets and scroll horizontally instead of wrapping;
- contextual controls appear only in the temporary inspector sheet;
- page, zoom, selection, history, tool, layers, and document session remain intact through layout changes;
- resize handles remain touch-friendly and pointer gestures support pen and touch;
- sheets and drawers respect safe-area insets and use CSS transforms with reduced-motion fallbacks.

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

## Phone Quick Edit

Below `768px`, NestlyPDF uses a reduced **Quick Edit** layout. It keeps the PDF workspace dominant and exposes only Select, Text, Signature, Checkmark, Date, Image, Undo, Redo, Download, simple page navigation, and viewer zoom. A dismissible session-only notice directs users to desktop or tablet for layers, advanced formatting, and the complete toolset.

The phone inspector is a two-state contextual bottom panel: collapsed when nothing is selected and open for a selected overlay. It intentionally omits desktop inspector tabs, Layers, ordering, font family, typography controls beyond Text size and color, and precise geometry controls. Existing Whiteout, Initials, and Cross overlays remain viewable, movable where supported, and deletable, with an explanation that advanced editing is available on desktop or tablet. Tablet and desktop retain the full editor.

## Phone landing breakpoint

At widths below 768px, landing navigation moves Privacy and GitHub into the header menu. The landing uses safe-area-aware horizontal padding, 44px minimum picker and menu targets, and no horizontal overflow at 390x844 or 430x932.
