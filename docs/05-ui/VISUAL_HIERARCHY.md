# NestlyPDF Visual Hierarchy

## Purpose

This document defines what should attract attention, in what order, and how the interface avoids competing with the PDF.

## Priority order

### 1. The PDF

The open document is always the primary visual object.

It should receive:

- the largest continuous area;
- the strongest spatial focus;
- sufficient neutral margin;
- minimal visual obstruction.

### 2. The current task and active tool

Users must quickly identify:

- what tool is active;
- what element is selected;
- whether text is being edited;
- the primary next action.

These states are clear but visually subordinate to the PDF.

### 3. Main toolbar

The toolbar remains visible and structured, but compact.

It must not resemble a second application header or consume excessive vertical space.

### 4. Contextual inspector

The inspector appears only when needed and displays only relevant controls.

It should feel connected to the current selection without covering the document.

### 5. Document status

Unsaved/downloaded/exporting state remains visible but calm.

### 6. Secondary help and metadata

File name, privacy reminders, shortcuts/help, and minor navigation remain tertiary.

## Landing-page hierarchy

1. Product promise
2. Drop zone
3. Choose PDF action
4. Privacy reassurance
5. Minimal footer/help

The logo should establish identity but should not overpower the primary action.

## Editor hierarchy

Recommended visual balance:

- PDF viewport: approximately `70–80%` of available visual emphasis;
- toolbar and inspector: compact and functional;
- neutral shell/background: quiet;
- status and metadata: subtle.

These percentages describe emphasis, not fixed layout measurements.

## Contrast

Use contrast deliberately:

- primary color for active tool and primary action;
- dark text for main labels;
- muted text for support;
- red only for errors/destructive actions;
- green only for success/downloaded state;
- subtle borders for structure.

Avoid using primary color on many unrelated controls simultaneously.

## Whitespace

Whitespace separates responsibilities.

Use it to distinguish:

- toolbar groups;
- inspector sections;
- landing-page message from drop zone;
- PDF page from shell.

Do not add cards merely to create separation.

## Typography hierarchy

Landing page:

- strong concise hero;
- smaller privacy support;
- clear drop-zone instruction.

Editor:

- compact labels;
- readable status;
- no oversized headings competing with document content.

## Borders

Borders are structural, not decorative.

Use them for:

- inputs;
- subtle toolbar/group separation;
- drop-zone boundary;
- keyboard focus;
- selected overlay editor UI.

Do not give every panel and overlay a permanent border.

## Elevation

Elevation order:

1. dialogs;
2. floating inspector and sticky toolbar;
3. PDF page over viewport background;
4. base surfaces.

Selection handles sit above the page overlay but remain below dialogs and fixed controls.

## Z-index policy

Use a small documented scale, for example:

- base shell: `0`;
- PDF page/canvas: `10`;
- overlay elements: `20`;
- selection UI: `30`;
- sticky toolbar/inspector: `50`;
- popovers/tooltips: `70`;
- dialog backdrop: `90`;
- dialog: `100`.

Avoid arbitrary escalating values.

## Density

NestlyPDF should feel spacious on landing and efficient in the editor.

Landing:

- generous whitespace;
- few elements;
- large target.

Editor:

- compact toolbar;
- efficient inspector;
- maximum room for PDF.

## State hierarchy

When multiple states exist, prioritize:

1. blocking error;
2. active dialog;
3. current editing/selection state;
4. export/loading state;
5. dirty/downloaded status;
6. ordinary hover.

Do not show competing banners or multiple simultaneous toasts.

## Responsive hierarchy

When space is limited:

1. preserve PDF visibility;
2. preserve Download;
3. preserve active tool and primary tools;
4. preserve Undo/Redo;
5. move secondary controls into overflow/sheets;
6. reduce labels before reducing touch targets.

## Explicitly avoid

- dashboard-style side navigation;
- multiple competing primary buttons;
- large inspector panels for simple selections;
- decorative gradients across the editor;
- heavy shadows;
- permanently visible advanced controls;
- status banners that cover the PDF;
- toolbars that wrap into several tall rows on desktop.
