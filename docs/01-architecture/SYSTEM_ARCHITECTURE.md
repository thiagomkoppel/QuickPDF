# System Architecture

## Architecture style

A client-only layered application with explicit ports and adapters.

```text
Presentation Layer
- React components
- Responsive layout
- Keyboard and touch interaction

Application Layer
- DocumentSessionService
- Active session ownership
- Use-case input/output contracts
- Application snapshots and errors
- OpenDocument later
- ExportDocument later
- CloseDocument later

Domain Layer
- DocumentSession
- PageModel
- EditorElement
- EditorOperation later
- History later
- Value objects and invariants

Infrastructure Layer
- PDF.js rendering adapter later
- PDF export adapter later
- Browser file picker adapter later
- Browser download adapter later
- Browser lifecycle adapter later
- Web Worker adapters later
```

## Dependency rule

The domain layer depends on nothing outside itself. Application use cases depend on domain abstractions. Infrastructure implements ports defined by inner layers. UI invokes application use cases.

Presentation must not manipulate `DocumentSession` directly. It receives application-facing snapshots and sends explicit command/query input objects to application services.

## Active session ownership

Phase 0 uses one active editing session for the MVP. `DocumentSessionService` owns that active session reference and never returns the mutable domain object to callers.

Creating a replacement session is atomic:

1. generate and validate new-session inputs;
2. create the new `DocumentSession` successfully;
3. dispose the previous active session;
4. replace the active application reference.

If creation fails, the previous active session remains unchanged.

Disposing through the application service disposes the domain session and removes the application reference. Repeated disposal through the application boundary reports `NoActiveSession` once the reference has been removed.

## Snapshot model

Application queries return readonly `DocumentSessionSnapshot` DTOs containing session ID, lifecycle status, dirty state, current page ID, selected element ID, ordered page summaries, and element summaries.

Snapshots do not expose domain methods, PDF bytes, browser objects, PDF engine objects, or live domain collections. Later mutations do not alter previously returned snapshots.

## Application error mapping

Expected failures return typed application results. Missing active sessions return `NoActiveSession`. Domain rejections are mapped to `DomainOperationRejected` with stable application reasons such as `missing-page`, `missing-element`, `invalid-page-order`, or `cannot-delete-last-page`. Session creation failures return `SessionCreationFailed`.

Application errors do not expose domain exception objects or infrastructure exceptions.

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

## Deferred integrations

Browser file APIs, PDF.js, pdf-lib, rendering, export, signatures, persistence, networking, and React document-editing state remain deferred until their Phase 0 workstreams.
