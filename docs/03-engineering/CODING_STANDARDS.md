# Coding Standards

## TypeScript

- Enable strict mode and all practical strictness options.
- Avoid `any`.
- Use discriminated unions for element and command types.
- Use `readonly` for immutable data.
- Keep domain types independent of DOM and framework types.
- Parse unknown external input before use.

## Modules

- One principal responsibility per module.
- No circular dependencies.
- No barrel files that hide dependency cycles.
- Keep public exports deliberate.
- Avoid utility dumping grounds.

## Functions and classes

- Prefer pure functions for transformations and calculations.
- Use classes when they protect invariants or lifecycle.
- Prefer composition over inheritance.
- Keep side effects at application or infrastructure boundaries.

## React

- Components render state and emit user intent.
- Components do not manipulate raw PDF documents.
- Business rules do not live in hooks.
- Large editor state must not be passed through deeply nested props.
- Memoization is driven by measured need, not habit.

## Commits

Each commit should represent one coherent change and leave the repository buildable and tested.
