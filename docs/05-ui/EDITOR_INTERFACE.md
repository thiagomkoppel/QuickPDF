# Editor Interface

## Current proof-of-concept layout

- header: close document, filename, disabled future Download button;
- toolbar: Select, Text, Whiteout, Duplicate, Delete, page navigation, zoom controls, fit width;
- warning text: whiteout is visual cover only;
- main workspace: PDF canvas background with transparent interactive DOM overlay.

## Supported tools

- Text: click or tap on the current page to add an editable text box.
- Whiteout: click or tap on the current page to add an opaque white visual cover rectangle.
- Select: select, move, resize, duplicate, or delete existing text and whiteout elements.

## Interaction principles

- The default action after opening a PDF should be obvious.
- Tool names use everyday language.
- The Download action remains visible but disabled until export exists.
- Selection handles must be easy to use.
- Common actions must not require nested menus.
- Dirty destructive actions require clear confirmation.

## Status communication

Show:

- current page;
- zoom level;
- selected tool;
- unsaved state;
- local-processing privacy statement;
- whiteout warning.
