# System Architecture

## Architecture style

A client-only layered application with explicit ports and adapters.

```text
Presentation Layer
- React components
- Responsive layout
- Keyboard and touch interaction

Application Layer
- OpenDocument
- AddElement
- UpdateElement
- OrganizePages
- ExportDocument
- CloseDocument

Domain Layer
- DocumentSession
- PageModel
- EditorElement
- EditorOperation
- History
- Value objects and invariants

Infrastructure Layer
- PDF.js rendering adapter
- PDF export adapter
- Browser file picker adapter
- Browser download adapter
- Browser lifecycle adapter
- Web Worker adapters
```

## Dependency rule

The domain layer depends on nothing outside itself. Application use cases depend on domain abstractions. Infrastructure implements ports defined by inner layers. UI invokes application use cases.

## Suggested source layout

```text
src/
├── domain/
├── application/
├── ports/
├── infrastructure/
├── presentation/
├── workers/
└── shared/
```

## No backend requirement

The production editor does not require an application API, database, user account, or document storage service.

Static hosting is sufficient.
