# QuickPDF Micro-Interactions

## Purpose

Micro-interactions make QuickPDF feel responsive and polished without delaying work or drawing attention away from the PDF.

Motion communicates state. It is not decoration.

## Global motion rules

- default duration: `150–200ms`;
- longer transitions only for major screen changes: maximum approximately `300ms`;
- preferred easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`;
- maximum routine scale: approximately `1.02`;
- avoid bounce, overshoot, or playful physics except an extremely subtle file-drop settle;
- no animation may delay opening, rendering, editing, or downloading;
- respect `prefers-reduced-motion`.

## Drag-and-drop landing interaction

### Idle

- optional barely visible icon drift;
- low-opacity radial glow;
- stable, calm surface.

### Drag enter

- drop zone rises `2–4px`;
- border changes to primary;
- glow increases;
- icon tilts or rises subtly;
- copy changes to `Release to open your PDF`.

Duration: `160–200ms`.

### Drag over

- stable elevated state;
- optional cursor-following radial highlight at low opacity;
- no continuous particle spectacle.

### Drag leave

- return to idle smoothly;
- no flicker across child elements.

### Valid drop

- document icon/card settles toward center;
- brief `0.98 → 1` compression/settle may be used;
- loading state appears immediately;
- animation never blocks file processing.

### Invalid drop

- one restrained horizontal shake;
- error icon/text fade in;
- drop zone remains usable.

Reduced motion: border/text state changes only.

## Buttons

### Hover

- background or border changes;
- optional `1px` visual lift for major buttons;
- no large scale.

### Pressed

- immediate response;
- optional subtle compression to `0.98–0.99` for primary buttons;
- release returns within `120–160ms`.

### Disabled

- no hover/press motion;
- clear visual and semantic disabled state.

### Loading

- button width remains stable;
- text may change to a progress label;
- spinner uses reduced-motion-safe behavior;
- repeated activation prevented.

## Active tools

When a tool becomes active:

- background/outline transitions to primary state;
- icon/text contrast updates;
- active semantics update immediately;
- no toolbar reflow.

When one-shot placement completes:

- active state returns to Select with a short color transition;
- no toast required.

## Selection

### Select element

- outline and handles fade in within `120–160ms`;
- inspector appears without moving the page;
- avoid scaling the actual overlay.

### Deselect

- outline/handles fade out quickly;
- inspector fades/slides by a few pixels;
- no history or status toast.

### Hover

A subtle hover cue may appear, but it must not resemble an exported border.

## Move and resize

- cursor changes immediately;
- preview follows pointer without easing or lag;
- selection outline remains stable;
- on release, no decorative snap unless snapping is implemented;
- cancelled gesture restores state immediately or within a very short transition that does not misrepresent the exact position.

## Text editing

- entering edit mode changes cursor/field state immediately;
- avoid selection-box animation that disturbs caret positioning;
- focus should not repeatedly reselect content;
- Escape exits edit mode without a toast;
- font size/family changes update live with a short style transition only if it does not distort measurement.

## Floating inspector

### Appear

- opacity `0 → 1`;
- translate `4–6px → 0`;
- `150–180ms`.

### Disappear

- shorter than appear: `100–140ms`;
- never leave an invisible focusable panel.

### Responsive transformation

When changing to a sheet/drawer layout, preserve selected element and current focus when possible.

## Undo and redo

- apply immediately;
- no toast for routine Undo/Redo;
- disabled/enabled toolbar states update smoothly without layout shift;
- selected overlay should remain visually understandable after state restoration.

## Copy and paste

- Copy produces no toast by default;
- Paste selects the new element and shows normal selection UI;
- optional very subtle placement fade-in, under `150ms`;
- do not animate from the original element.

## Delete

- remove immediately or with a very short opacity fade;
- inspector disappears at the same time;
- Undo availability updates immediately;
- avoid confirmation dialogs for ordinary overlay deletion because Undo exists.

## Export and download

### Start

- Download button enters stable busy state;
- status changes to `Exporting…`;
- prevent duplicate export.

### Success

- status changes to `Downloaded` with a check icon;
- optional subtle check fade/scale under `180ms`;
- editor remains open.

### Failure

- button returns to enabled state;
- concise recoverable error appears;
- no document state is lost.

## Dialogs

### Open

- backdrop fades in;
- dialog translates up a few pixels and fades;
- focus moves only after dialog is present.

### Close

- reverse quickly;
- focus returns to the invoking control;
- reduced motion uses opacity or immediate state.

## Errors

Use restrained feedback:

- inline message;
- error icon;
- optional one-cycle shake for invalid drop/input;
- focus/announcement where necessary.

Avoid repeated shaking, pulsing red, or blocking alerts.

## Loading PDF pages

- show a stable loading surface matching expected page dimensions when known;
- avoid canvas flash;
- fade rendered content in only if it does not delay visibility;
- stale renders must not visually replace the active page.

## Status transitions

`Unsaved changes`, `Downloaded`, and `Ready` may use short color/icon transitions.

Status must remain readable without animation.
