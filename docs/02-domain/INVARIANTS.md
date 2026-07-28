# Domain Invariants

- A non-disposed session contains at least one page.
- Every editor element belongs to an existing page.
- Element identifiers are unique within a session.
- Page identifiers are unique within a session.
- Session, page, and element identifiers are non-empty and stable.
- Page identity is independent from page order.
- Width and height are positive for pages and element bounds.
- Page rotation must be one of the supported normalized values: 0, 90, 180, or 270 degrees.
- Opacity is between 0 and 1 when opacity-bearing elements are introduced.
- Page order contains each active page exactly once.
- Current page must reference an existing page while the session is not disposed.
- Selected elements must exist in the session.
- Selection changes do not affect dirty state.
- History cannot apply operations to a disposed session when history is introduced.
- Original PDF bytes are read-only and represented only through abstract references in the pure domain.
- Disposal clears pages, elements, selection, current page, temporary personal information, and abstract source references.
- Whiteout is classified as visual covering, not redaction.
- Export uses a consistent snapshot of session state when export is introduced.
