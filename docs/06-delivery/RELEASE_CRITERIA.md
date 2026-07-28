# Release Criteria

## Functional

- Critical user flows pass end to end.
- Exported PDFs open in major current PDF readers.
- Supported form values persist.
- Page operations export correctly.
- Undo and redo remain reliable.

## Quality

- Typecheck passes.
- Lint passes.
- Unit tests pass.
- Integration tests pass.
- Component tests pass.
- End-to-end tests pass.
- Production build passes.
- No known critical or high-severity defects.

## Privacy and security

- No PDF or derived document data leaves the browser during normal use.
- No document data is stored persistently.
- Object URLs and session references are cleaned up.
- CSP is configured.
- Dependency security review is complete.
- Whiteout is clearly labeled as non-secure visual covering.

## Accessibility

- Keyboard completion flow passes.
- Screen-reader smoke test passes.
- Contrast requirements pass.
- Mobile touch targets pass.

## Performance

- Common small and medium PDFs remain responsive on supported devices.
- Large document limits fail gracefully.
