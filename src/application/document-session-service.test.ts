import { describe, expect, it } from "vitest";

import {
  ApplicationErrorCode,
  DocumentSessionService,
  type CreateDocumentSessionInput,
  type IdGenerator,
} from "./document-session-service";

const page = (id: string, width = 612, height = 792) => ({
  id,
  width,
  height,
  rotation: 0,
});

const createInput = (pages = [page("page-1")]): CreateDocumentSessionInput => ({ pages });

class DeterministicIdGenerator implements IdGenerator {
  readonly #ids: string[];

  public constructor(ids: readonly string[]) {
    this.#ids = [...ids];
  }

  public nextId(): string {
    const id = this.#ids.shift();
    if (id === undefined) {
      throw new Error("No deterministic IDs remain.");
    }
    return id;
  }
}

const expectApplicationError = (
  result:
    | { readonly ok: true; readonly value: unknown }
    | { readonly ok: false; readonly error: { readonly code: ApplicationErrorCode } },
  code: ApplicationErrorCode,
): void => {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe(code);
  }
};

describe("DocumentSessionService", () => {
  it("creates an active session with a deterministic generated ID", () => {
    const service = new DocumentSessionService(new DeterministicIdGenerator(["session-1"]));

    const result = service.createSession(createInput());

    expect(result).toEqual({
      ok: true,
      value: {
        sessionId: "session-1",
        status: "ready",
        isDirty: false,
        currentPageId: "page-1",
        selectedElementId: undefined,
        pages: [{ id: "page-1", width: 612, height: 792, rotation: 0 }],
        elements: [],
      },
    });
  });

  it("returns readonly snapshots that do not expose domain methods or live collections", () => {
    const service = new DocumentSessionService(
      new DeterministicIdGenerator(["session-1", "element-1"]),
    );
    const created = service.createSession(createInput());
    if (!created.ok) throw new Error("Expected session creation to pass.");

    const snapshot = service.getSnapshot();
    if (!snapshot.ok) throw new Error("Expected snapshot to exist.");
    const mutablePages = [...snapshot.value.pages, page("external-page")];

    expect("setCurrentPage" in snapshot.value).toBe(false);
    expect(mutablePages).toHaveLength(2);
    expect(
      service.addElement({
        pageId: "page-1",
        type: "text",
        bounds: { x: 1, y: 2, width: 3, height: 4 },
        content: { text: "A" },
      }),
    ).toEqual({
      ok: true,
      value: {
        sessionId: "session-1",
        status: "ready",
        isDirty: true,
        currentPageId: "page-1",
        selectedElementId: undefined,
        pages: [{ id: "page-1", width: 612, height: 792, rotation: 0 }],
        elements: [
          {
            id: "element-1",
            pageId: "page-1",
            type: "text",
            bounds: { x: 1, y: 2, width: 3, height: 4 },
            content: { text: "A" },
          },
        ],
      },
    });
    expect(snapshot.value.elements).toEqual([]);
    expect(service.getSnapshot()).toMatchObject({ ok: true, value: { pages: [page("page-1")] } });
  });

  it("reports missing active-session errors for commands and queries", () => {
    const service = new DocumentSessionService(new DeterministicIdGenerator(["unused"]));

    expectApplicationError(service.getSnapshot(), "NoActiveSession");
    expectApplicationError(service.navigateToPage({ pageId: "page-1" }), "NoActiveSession");
    expectApplicationError(service.disposeSession(), "NoActiveSession");
  });

  it("navigates through a use case without changing dirty state", () => {
    const service = new DocumentSessionService(new DeterministicIdGenerator(["session-1"]));
    service.createSession(createInput([page("page-1"), page("page-2")]));

    const result = service.navigateToPage({ pageId: "page-2" });

    expect(result).toMatchObject({ ok: true, value: { currentPageId: "page-2", isDirty: false } });
  });

  it("selects and clears selection through use cases", () => {
    const service = new DocumentSessionService(
      new DeterministicIdGenerator(["session-1", "element-1"]),
    );
    service.createSession(createInput());
    service.addElement({
      pageId: "page-1",
      type: "text",
      bounds: { x: 1, y: 2, width: 3, height: 4 },
      content: { text: "A" },
    });
    service.markSessionClean();

    expect(service.selectElement({ elementId: "element-1" })).toMatchObject({
      ok: true,
      value: { selectedElementId: "element-1", isDirty: false },
    });
    expect(service.clearSelection()).toMatchObject({
      ok: true,
      value: { selectedElementId: undefined, isDirty: false },
    });
  });

  it("adds, updates, and deletes elements through use cases", () => {
    const service = new DocumentSessionService(
      new DeterministicIdGenerator(["session-1", "element-1"]),
    );
    service.createSession(createInput());

    expect(
      service.addElement({
        pageId: "page-1",
        type: "text",
        bounds: { x: 1, y: 2, width: 3, height: 4 },
        content: { text: "A" },
      }),
    ).toMatchObject({
      ok: true,
      value: { isDirty: true, elements: [{ id: "element-1", bounds: { x: 1 } }] },
    });
    expect(
      service.updateElement({
        id: "element-1",
        pageId: "page-1",
        type: "text",
        bounds: { x: 9, y: 2, width: 3, height: 4 },
        content: { text: "B" },
      }),
    ).toMatchObject({
      ok: true,
      value: { elements: [{ id: "element-1", bounds: { x: 9 }, content: { text: "B" } }] },
    });
    expect(service.deleteElement({ elementId: "element-1" })).toMatchObject({
      ok: true,
      value: { elements: [] },
    });
  });

  it("deletes and reorders pages through use cases", () => {
    const service = new DocumentSessionService(
      new DeterministicIdGenerator(["session-1", "element-1"]),
    );
    service.createSession(createInput([page("page-1"), page("page-2"), page("page-3")]));
    service.addElement({
      pageId: "page-2",
      type: "text",
      bounds: { x: 1, y: 2, width: 3, height: 4 },
    });

    expect(service.reorderPages({ pageIds: ["page-3", "page-2", "page-1"] })).toMatchObject({
      ok: true,
      value: { pages: [{ id: "page-3" }, { id: "page-2" }, { id: "page-1" }], isDirty: true },
    });
    expect(service.deletePage({ pageId: "page-2" })).toMatchObject({
      ok: true,
      value: { pages: [{ id: "page-3" }, { id: "page-1" }], elements: [], isDirty: true },
    });
  });

  it("marks the active session clean", () => {
    const service = new DocumentSessionService(
      new DeterministicIdGenerator(["session-1", "element-1"]),
    );
    service.createSession(createInput());
    service.addElement({
      pageId: "page-1",
      type: "text",
      bounds: { x: 1, y: 2, width: 3, height: 4 },
    });

    expect(service.markSessionClean()).toMatchObject({ ok: true, value: { isDirty: false } });
  });

  it("disposes the active session and removes application references", () => {
    const service = new DocumentSessionService(new DeterministicIdGenerator(["session-1"]));
    service.createSession(createInput());

    expect(service.disposeSession()).toEqual({ ok: true, value: undefined });
    expectApplicationError(service.getSnapshot(), "NoActiveSession");
    expectApplicationError(service.disposeSession(), "NoActiveSession");
  });

  it("atomically replaces an active session after creating the replacement", () => {
    const service = new DocumentSessionService(
      new DeterministicIdGenerator(["session-1", "element-1", "session-2"]),
    );
    service.createSession(createInput([page("old-page")]));
    service.addElement({
      pageId: "old-page",
      type: "text",
      bounds: { x: 1, y: 2, width: 3, height: 4 },
    });

    const result = service.createSession(createInput([page("new-page")]));

    expect(result).toMatchObject({
      ok: true,
      value: { sessionId: "session-2", pages: [{ id: "new-page" }], elements: [] },
    });
    expectApplicationError(
      service.navigateToPage({ pageId: "old-page" }),
      "DomainOperationRejected",
    );
  });

  it("preserves the current session when replacement creation fails", () => {
    const service = new DocumentSessionService(
      new DeterministicIdGenerator(["session-1", "session-2"]),
    );
    service.createSession(createInput([page("old-page")]));

    expectApplicationError(service.createSession(createInput([])), "SessionCreationFailed");

    expect(service.getSnapshot()).toMatchObject({
      ok: true,
      value: { sessionId: "session-1", pages: [{ id: "old-page" }] },
    });
  });

  it("maps domain errors to application errors and preserves previous state", () => {
    const service = new DocumentSessionService(new DeterministicIdGenerator(["session-1"]));
    service.createSession(createInput([page("page-1")]));
    const before = service.getSnapshot();

    const result = service.deletePage({ pageId: "page-1" });

    expectApplicationError(result, "DomainOperationRejected");
    expect(result).toMatchObject({ ok: false, error: { reason: "cannot-delete-last-page" } });
    expect(service.getSnapshot()).toEqual(before);
  });
});
