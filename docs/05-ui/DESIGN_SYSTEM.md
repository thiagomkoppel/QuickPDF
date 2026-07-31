# QuickPDF Design System

## Purpose

This document defines the final visual language for QuickPDF.

QuickPDF is a private browser utility for short, focused document tasks. It is not a dashboard, collaboration platform, cloud drive, or office suite.

The interface must feel:

- calm;
- modern;
- immediate;
- trustworthy;
- lightweight;
- intentionally minimal.

The PDF is the primary visual object. Controls support the document and must never compete with it.

## Design direction

QuickPDF combines:

- Apple-like restraint, spacing, clarity, and softness;
- Linear-like precision, compact controls, and crisp interaction states.

Avoid:

- dashboard-heavy layouts;
- excessive cards;
- glassmorphism;
- neumorphism;
- bright gradients used as decoration;
- unnecessary borders;
- excessive shadows;
- visual effects that delay the task.

## Core principles

1. The PDF remains visually dominant.
2. The common workflow must remain obvious: **Open → Edit → Download → Done**.
3. Only one primary action should dominate a screen.
4. Controls appear when useful and recede when not needed.
5. Status must be clear without becoming visually loud.
6. Every interaction must work with keyboard, mouse, touch, and assistive technology.
7. No interface should imply cloud storage, accounts, or persistent document history.

## Color tokens

### Neutrals

| Token                    |     Value | Use                                            |
| ------------------------ | --------: | ---------------------------------------------- |
| `--color-canvas`         | `#F7F8FA` | Application and landing-page background        |
| `--color-surface`        | `#FFFFFF` | Cards, toolbars, dialogs, inspector            |
| `--color-surface-muted`  | `#F2F4F7` | Secondary surfaces and hover states            |
| `--color-text-primary`   | `#111827` | Primary text                                   |
| `--color-text-secondary` | `#667085` | Supporting text                                |
| `--color-text-muted`     | `#98A2B3` | Tertiary labels and placeholders               |
| `--color-border`         | `#E4E7EC` | Subtle separators and input borders            |
| `--color-border-strong`  | `#D0D5DD` | Focus-adjacent and selected structural borders |

### Brand and status

| Token                   |     Value | Use                                      |
| ----------------------- | --------: | ---------------------------------------- |
| `--color-primary`       | `#5B4DFF` | Primary actions and selected tool state  |
| `--color-primary-hover` | `#6C5FFF` | Hover state                              |
| `--color-primary-soft`  | `#EFEDFF` | Selected backgrounds and subtle emphasis |
| `--color-success`       | `#16A34A` | Downloaded or successful state           |
| `--color-warning`       | `#F59E0B` | Unsaved-state emphasis when needed       |
| `--color-danger`        | `#DC2626` | Destructive actions and errors           |
| `--color-focus`         | `#7C6FFF` | Keyboard focus ring                      |

Colors must not be the only indicator of state.

## Typography

Primary stack:

```css
font-family:
  Inter,
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

Do not load remote fonts on the editor route.

### Scale

| Role                  |                           Size | Weight | Line height |
| --------------------- | -----------------------------: | -----: | ----------: |
| Landing hero          | `48px` desktop / `36px` mobile |    700 |        1.08 |
| Page title            |                         `30px` |    700 |         1.2 |
| Section title         |                         `20px` |    600 |         1.3 |
| Control label         |                         `13px` |    600 |         1.3 |
| Body                  |                         `15px` |    400 |        1.55 |
| Small supporting text |                         `13px` |    400 |        1.45 |
| Status text           |                         `12px` |    500 |         1.3 |

Avoid thin weights.

## Spacing

Use a four-pixel base grid.

Preferred values:

- `4px` — icon/text micro-gap;
- `8px` — compact control gap;
- `12px` — toolbar groups and form spacing;
- `16px` — card and inspector spacing;
- `24px` — section spacing;
- `32px` — major layout spacing;
- `48px+` — landing-page breathing room.

## Radius

| Component                  |  Radius |
| -------------------------- | ------: |
| Compact controls           |  `10px` |
| Buttons and inputs         |  `12px` |
| Cards and panels           |  `16px` |
| Dialogs and main drop zone |  `20px` |
| Pills and status badges    | `999px` |

## Shadows

Shadows indicate elevation, not decoration.

```css
--shadow-subtle: 0 1px 2px rgb(16 24 40 / 0.05);
--shadow-panel: 0 8px 24px rgb(16 24 40 / 0.08);
--shadow-dialog: 0 24px 64px rgb(16 24 40 / 0.18);
```

Do not use heavy black shadows.

## Icons

Use Lucide icons or an equivalent consistent outline set.

Rules:

- default size: `18–20px`;
- stroke width: visually consistent across controls;
- monochrome except status icons;
- every icon-only button requires an accessible name and tooltip;
- do not mix unrelated icon families.

## Buttons

### Primary

Use for the dominant action, such as **Choose PDF** or **Download**.

- filled primary color;
- white text;
- strong but calm emphasis;
- one primary action per region.

### Secondary

Use for supporting actions.

- white or muted background;
- subtle border;
- primary text.

### Ghost

Use for toolbar and compact contextual actions.

- transparent background;
- visible hover and active states;
- no persistent border unless selected.

### Danger

Use for destructive confirmation only.

- danger text or filled danger background;
- never use red for ordinary selection.

### States

Every button must define:

- default;
- hover;
- pressed;
- keyboard focus;
- disabled;
- loading.

Disabled controls must remain readable and must not rely only on reduced opacity.

## Inputs and selects

- minimum height: `40px` desktop, `44px` touch layouts;
- visible label or accessible name;
- `12px` radius;
- subtle border;
- clear error message;
- visible focus ring;
- compact controls may be used inside the floating inspector.

## Editor toolbar

The toolbar is sticky and remains visible while the PDF viewport scrolls.

Recommended logical groups:

1. **File:** Open, Download
2. **Edit:** Undo, Redo, Copy, Paste
3. **Insert:** Select, Text, Whiteout, Image, Signature, Initials, Checkmark, Cross, Date
4. **View:** Zoom out, zoom value, zoom in, Reset, Fit width
5. **Pages:** Previous, current/total, Next

Groups use separators or spacing, not large cards.

The toolbar must:

- remain compact;
- preserve a stable height;
- horizontally scroll or collapse on small screens;
- clearly show the active tool using icon, label/state text, and `aria-pressed`;
- keep Download visually identifiable as the primary action.

## Floating selected-element inspector

The inspector remains visible whenever an element is selected.

It appears:

- directly below the sticky toolbar; or
- in a compact, stable right-side position on wide screens.

It must never be rendered below the full PDF page in normal document flow.

It contains only relevant controls:

- element type/status;
- text font family and size for text;
- dimensions where useful;
- Copy, Duplicate, Delete;
- future element-specific controls only when justified.

Showing or hiding the inspector must not resize, reflow, or misalign the PDF canvas and overlay.

## Tool states

One-shot tools:

- Text;
- Image;
- Signature;
- Initials;
- Checkmark;
- Cross;
- Date.

After placement, they return to Select.

Persistent tools:

- Whiteout.

Select remains the neutral/default tool.

## Selection styling

Unselected overlays have no decorative border.

Selected overlays may show:

- a `1–2px` primary outline;
- resize handles;
- clear move and resize cursors;
- subtle selection background only when necessary for contrast.

Selection UI is editor-only and is never exported.

## Dialogs

- centered on desktop;
- bottom sheet on narrow mobile layouts when appropriate;
- focus trap;
- Escape closes when safe;
- focus returns to the invoking control;
- primary action aligned consistently;
- destructive choices require explicit wording.

## Status

Document status should be calm and persistent:

- `Unsaved changes`;
- `Downloaded`;
- `Exporting…`;
- `Ready`;
- recoverable error state.

Use text plus an icon or shape. Avoid excessive toasts.

## Motion

Default duration: `150–200ms`.

Use:

```css
transition-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
```

Allowed motion:

- opacity;
- small translation;
- subtle scale up to approximately `1.02`;
- progress indicators;
- gentle drop-zone response.

Avoid:

- bouncing;
- large zooms;
- continuous decorative motion;
- animation that delays PDF opening;
- motion without reduced-motion fallback.

## Dark mode

Dark mode is deferred. The initial final design is light mode only.

Do not partially implement dark mode before a dedicated decision and complete token set exist.
