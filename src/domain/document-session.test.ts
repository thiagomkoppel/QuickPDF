import { describe, expect, it } from "vitest";

import {
  DocumentSession,
  type DomainResult,
  type DocumentPage,
  type EditorElement,
} from "./document-session";

const page = (id: string, width = 612, height = 792): DocumentPage => ({
  id,
  width,
  height,
  rotation: 0,
});

const element = (id: string, pageId: string, x = 12): EditorElement => ({
  id,
  pageId,
  type: "text",
  bounds: { x, y: 24, width: 120, height: 32 },
  content: { text: "Example" },
});

const expectDomainError = (result: DomainResult, code: string): void => {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe(code);
  }
};

describe("DocumentSession", () => {
  it("creates a valid clean session with stable identity and current page", () => {
    const session = DocumentSession.create({ id: "session-1", pages: [page("page-1")] });

    expect(session.id).toBe("session-1");
    expect(session.status).toBe("ready");
    expect(session.isDirty).toBe(false);
    expect(session.currentPageId).toBe("page-1");
    expect(session.pages()).toEqual([page("page-1")]);
  });

  it("rejects invalid session identity", () => {
    expect(() => DocumentSession.create({ id: "  ", pages: [page("page-1")] })).toThrow(
      "InvalidSessionId",
    );
  });

  it("rejects zero-page creation", () => {
    expect(() => DocumentSession.create({ id: "session-1", pages: [] })).toThrow("NoPages");
  });

  it("rejects duplicate page identities", () => {
    expect(() =>
      DocumentSession.create({ id: "session-1", pages: [page("page-1"), page("page-1")] }),
    ).toThrow("DuplicatePageId");
  });

  it("validates page dimensions and rotation", () => {
    expect(() => DocumentSession.create({ id: "session-1", pages: [page("page-1", 0)] })).toThrow(
      "InvalidPageDimensions",
    );
    expect(() =>
      DocumentSession.create({ id: "session-1", pages: [{ ...page("page-1"), rotation: 45 }] }),
    ).toThrow("InvalidPageRotation");
  });

  it("keeps page identity stable when pages are reordered", () => {
    const session = DocumentSession.create({
      id: "session-1",
      pages: [page("page-1"), page("page-2"), page("page-3")],
    });

    expect(session.reorderPages(["page-3", "page-1", "page-2"])).toEqual({ ok: true });

    expect(session.pages().map((documentPage) => documentPage.id)).toEqual([
      "page-3",
      "page-1",
      "page-2",
    ]);
    expect(session.page("page-1")?.id).toBe("page-1");
    expect(session.isDirty).toBe(true);
  });

  it("does not expose mutable page collections", () => {
    const session = DocumentSession.create({ id: "session-1", pages: [page("page-1")] });
    const pages = session.pages();

    pages.push(page("external-page"));

    expect(session.pages().map((documentPage) => documentPage.id)).toEqual(["page-1"]);
  });

  it("changes current page without changing dirty state", () => {
    const session = DocumentSession.create({
      id: "session-1",
      pages: [page("page-1"), page("page-2")],
    });

    expect(session.setCurrentPage("page-2")).toEqual({ ok: true });

    expect(session.currentPageId).toBe("page-2");
    expect(session.isDirty).toBe(false);
  });

  it("fails safely when navigating to a missing page", () => {
    const session = DocumentSession.create({ id: "session-1", pages: [page("page-1")] });

    expectDomainError(session.setCurrentPage("missing-page"), "PageNotFound");

    expect(session.currentPageId).toBe("page-1");
    expect(session.isDirty).toBe(false);
  });

  it("adds valid elements and marks the session dirty", () => {
    const session = DocumentSession.create({ id: "session-1", pages: [page("page-1")] });

    expect(session.addElement(element("element-1", "page-1"))).toEqual({ ok: true });

    expect(session.elements()).toEqual([element("element-1", "page-1")]);
    expect(session.isDirty).toBe(true);
  });

  it("rejects elements for missing pages without mutating state", () => {
    const session = DocumentSession.create({ id: "session-1", pages: [page("page-1")] });

    expectDomainError(session.addElement(element("element-1", "missing-page")), "PageNotFound");

    expect(session.elements()).toEqual([]);
    expect(session.isDirty).toBe(false);
  });
  it("rejects non-finite element bounds without mutating state", () => {
    const session = DocumentSession.create({ id: "session-1", pages: [page("page-1")] });

    expectDomainError(
      session.addElement({
        ...element("element-1", "page-1"),
        bounds: { x: Number.NaN, y: 24, width: 120, height: 32 },
      }),
      "InvalidElementBounds",
    );

    expect(session.elements()).toEqual([]);
    expect(session.isDirty).toBe(false);
  });

  it("rejects duplicate element identities atomically", () => {
    const session = DocumentSession.create({ id: "session-1", pages: [page("page-1")] });
    expect(session.addElement(element("element-1", "page-1"))).toEqual({ ok: true });
    session.markClean();

    expectDomainError(session.addElement(element("element-1", "page-1", 48)), "DuplicateElementId");

    expect(session.elements()).toEqual([element("element-1", "page-1")]);
    expect(session.isDirty).toBe(false);
  });

  it("selects an existing element and clears selection without changing dirty state", () => {
    const session = DocumentSession.create({ id: "session-1", pages: [page("page-1")] });
    session.addElement(element("element-1", "page-1"));
    session.markClean();

    expect(session.selectElement("element-1")).toEqual({ ok: true });
    expect(session.selectedElementId).toBe("element-1");
    expect(session.clearSelection()).toEqual({ ok: true });
    expect(session.clearSelection()).toEqual({ ok: true });

    expect(session.selectedElementId).toBeUndefined();
    expect(session.isDirty).toBe(false);
  });

  it("fails safely when selecting a missing element", () => {
    const session = DocumentSession.create({ id: "session-1", pages: [page("page-1")] });

    expectDomainError(session.selectElement("missing-element"), "ElementNotFound");

    expect(session.selectedElementId).toBeUndefined();
    expect(session.isDirty).toBe(false);
  });

  it("updates and deletes elements while preserving selection rules", () => {
    const session = DocumentSession.create({ id: "session-1", pages: [page("page-1")] });
    session.addElement(element("element-1", "page-1"));
    session.markClean();

    expect(
      session.updateElement({
        ...element("element-1", "page-1"),
        bounds: { x: 44, y: 24, width: 120, height: 32 },
      }),
    ).toEqual({ ok: true });
    expect(session.element("element-1")?.bounds.x).toBe(44);
    expect(session.isDirty).toBe(true);

    session.selectElement("element-1");
    expect(session.deleteElement("element-1")).toEqual({ ok: true });

    expect(session.elements()).toEqual([]);
    expect(session.selectedElementId).toBeUndefined();
  });

  it("deletes a page with owned elements atomically and clears affected selection", () => {
    const session = DocumentSession.create({
      id: "session-1",
      pages: [page("page-1"), page("page-2")],
    });
    session.addElement(element("element-1", "page-1"));
    session.addElement(element("element-2", "page-2"));
    session.selectElement("element-2");
    session.markClean();

    expect(session.deletePage("page-2")).toEqual({ ok: true });

    expect(session.pages().map((documentPage) => documentPage.id)).toEqual(["page-1"]);
    expect(session.elements()).toEqual([element("element-1", "page-1")]);
    expect(session.selectedElementId).toBeUndefined();
    expect(session.currentPageId).toBe("page-1");
    expect(session.isDirty).toBe(true);
  });

  it("moves current page to the nearest remaining page when deleting the current page", () => {
    const session = DocumentSession.create({
      id: "session-1",
      pages: [page("page-1"), page("page-2"), page("page-3")],
    });
    session.setCurrentPage("page-2");

    expect(session.deletePage("page-2")).toEqual({ ok: true });

    expect(session.currentPageId).toBe("page-3");
  });

  it("prevents zero-page state and failed deletion does not mutate", () => {
    const session = DocumentSession.create({ id: "session-1", pages: [page("page-1")] });
    const beforePages = session.pages();

    expectDomainError(session.deletePage("page-1"), "CannotDeleteLastPage");

    expect(session.pages()).toEqual(beforePages);
    expect(session.currentPageId).toBe("page-1");
    expect(session.isDirty).toBe(false);
  });

  it("rejects invalid reorder atomically", () => {
    const session = DocumentSession.create({
      id: "session-1",
      pages: [page("page-1"), page("page-2")],
    });

    expectDomainError(session.reorderPages(["page-2", "missing-page"]), "InvalidPageOrder");

    expect(session.pages().map((documentPage) => documentPage.id)).toEqual(["page-1", "page-2"]);
    expect(session.isDirty).toBe(false);
  });

  it("marks the current state clean explicitly", () => {
    const session = DocumentSession.create({ id: "session-1", pages: [page("page-1")] });
    session.addElement(element("element-1", "page-1"));

    expect(session.markClean()).toEqual({ ok: true });

    expect(session.isDirty).toBe(false);
  });

  it("disposes session data and exposes safe empty state", () => {
    const session = DocumentSession.create({
      id: "session-1",
      pages: [page("page-1"), page("page-2")],
      temporaryPersonalInfo: { originalFileName: "private.pdf" },
      sourceReference: "pdf-bytes-ref-1",
    });
    session.addElement(element("element-1", "page-1"));
    session.selectElement("element-1");

    expect(session.dispose()).toEqual({ ok: true });

    expect(session.status).toBe("disposed");
    expect(session.pages()).toEqual([]);
    expect(session.elements()).toEqual([]);
    expect(session.currentPageId).toBeUndefined();
    expect(session.selectedElementId).toBeUndefined();
    expect(session.temporaryPersonalInfo).toEqual({});
    expect(session.sourceReference).toBeUndefined();
    expect(session.isDirty).toBe(false);
  });

  it("allows repeated disposal", () => {
    const session = DocumentSession.create({ id: "session-1", pages: [page("page-1")] });

    expect(session.dispose()).toEqual({ ok: true });
    expect(session.dispose()).toEqual({ ok: true });

    expect(session.status).toBe("disposed");
  });

  it("rejects mutations after disposal without mutating safe empty state", () => {
    const session = DocumentSession.create({ id: "session-1", pages: [page("page-1")] });
    session.dispose();

    expectDomainError(session.addElement(element("element-1", "page-1")), "SessionDisposed");
    expectDomainError(session.deletePage("page-1"), "SessionDisposed");
    expectDomainError(session.markClean(), "SessionDisposed");

    expect(session.pages()).toEqual([]);
    expect(session.elements()).toEqual([]);
    expect(session.currentPageId).toBeUndefined();
  });
});
