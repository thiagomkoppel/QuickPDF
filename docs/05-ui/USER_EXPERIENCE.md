# NestlyPDF User Experience

## Product promise

NestlyPDF solves one immediate problem:

> I need to complete this PDF quickly and send it back.

The primary journey is:

> Open → Edit → Download → Done

Every product and interface decision must support that journey.

## Experience principles

### Immediate

The user should understand the next action without a tutorial.

### Private

The product clearly states that documents stay in the browser session and are not uploaded to NestlyPDF.

### Predictable

The same selection, movement, resizing, duplication, deletion, copy/paste, and history model applies across overlay types.

### Forgiving

Undo/Redo, discard warnings, input validation, and recoverable errors protect users from mistakes.

### Focused

NestlyPDF avoids cloud workflows, dashboards, accounts, collaboration, and unrelated document-management features.

### Honest

Whiteout is visual cover, not secure redaction. Session disposal is not described as cryptographic deletion.

## Primary user journey

1. Arrive on the landing page.
2. Drop or choose one local PDF.
3. Wait only as long as required to render it.
4. Add or correct visible information.
5. Sign or initial when needed.
6. Review without selection UI.
7. Download the edited PDF.
8. Leave.

The common workflow should require as few decisions and clicks as practical.

## Decision rule

Before adding a feature, ask:

> Does this help the user finish a PDF faster, more safely, or with greater confidence?

A feature should be rejected or deferred when it:

- slows the primary workflow;
- adds visual clutter;
- introduces accounts or cloud assumptions;
- requires explanation disproportionate to its value;
- duplicates browser or operating-system behavior without benefit;
- weakens privacy or reliability.

## Entry experience

The landing page should communicate, within seconds:

- what NestlyPDF does;
- how to open a file;
- that the file stays local;
- that no account is required.

The drag-and-drop area is the primary interaction and should feel polished, responsive, and trustworthy.

## Tool behavior

### One-shot placement

Text, Image, Signature, Initials, Checkmark, Cross, and Date place one item and return to Select.

This prevents accidental repeated elements when users naturally click outside to review their work.

### Persistent placement

Whiteout remains active because users often cover several areas consecutively.

### Selection

- single click/tap selects;
- empty-space click with Select active deselects;
- double-click or Enter edits text;
- Escape exits the current editing/transient interaction predictably.

## Editing confidence

Users should always know:

- which tool is active;
- which element is selected;
- whether they are editing text or only selecting it;
- whether the document has unsaved changes;
- whether Download completed;
- whether Undo/Redo are available.

## Undo/Redo experience

Undo and Redo should feel immediate and unsurprising.

Logical user actions become one history step:

- one placement;
- one delete;
- one duplicate/paste;
- one completed drag;
- one completed resize;
- one committed text-edit session;
- one font change.

Pointer previews and selection changes never flood history.

## Errors

Errors must:

- use plain language;
- preserve the current document whenever possible;
- explain the next recovery action;
- avoid raw library or browser messages;
- never include document contents in telemetry.

## Loading and progress

The product should feel immediate, but it must never hide meaningful work.

Use progress or busy states for:

- opening/rendering a PDF;
- image decoding;
- export/download preparation.

Do not add artificial loading delays for animation.

## User trust

Trust is reinforced through:

- accurate privacy copy;
- clear dirty/downloaded state;
- discard warnings only when needed;
- export that matches the editor preview;
- consistent controls;
- no surprise browser page zoom;
- no persistent recent-file history.

## Simplicity limits

NestlyPDF is not initially:

- a PDF creator;
- a cloud drive;
- a collaboration tool;
- an e-signature request platform;
- a native arbitrary-text editor;
- an OCR suite;
- a secure-redaction product;
- a document-management dashboard.

## Definition of a good interaction

A good NestlyPDF interaction:

- needs little explanation;
- behaves like familiar document/design tools;
- has visible feedback;
- is reversible when it changes output;
- works with keyboard and touch;
- leaves the PDF visually dominant;
- ends without unnecessary confirmation.
