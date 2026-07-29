import {
  DocumentSession,
  type Bounds,
  type DocumentPage,
  type DocumentSessionStatus,
  type DomainErrorCode,
  type DomainFailure,
  type DomainResult,
  type EditorElement,
  type EditorElementContent,
  type EditorElementType,
  isDomainError,
} from "../domain/document-session";

export interface IdGenerator {
  nextId(): string;
}

export interface CreateDocumentSessionInput {
  readonly pages: readonly DocumentPageInput[];
  readonly temporaryPersonalInfo?: {
    readonly originalFileName?: string;
  };
  readonly sourceReference?: string;
}

export interface DocumentPageInput {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
}

export interface AddEditorElementInput {
  readonly pageId: string;
  readonly type: EditorElementType;
  readonly bounds: Bounds;
  readonly content?: EditorElementContent;
}

export interface UpdateEditorElementInput {
  readonly id: string;
  readonly pageId: string;
  readonly type: EditorElementType;
  readonly bounds: Bounds;
  readonly content?: EditorElementContent;
}

export interface NavigateToPageInput {
  readonly pageId: string;
}

export interface SelectElementInput {
  readonly elementId: string;
}

export interface DeleteElementInput {
  readonly elementId: string;
}

export interface DeletePageInput {
  readonly pageId: string;
}

export interface ReorderPagesInput {
  readonly pageIds: readonly string[];
}

export interface DocumentPageSnapshot {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
}

export interface EditorElementSnapshot {
  readonly id: string;
  readonly pageId: string;
  readonly type: EditorElementType;
  readonly bounds: Bounds;
  readonly content?: EditorElementContent;
}

export interface DocumentSessionSnapshot {
  readonly sessionId: string;
  readonly status: DocumentSessionStatus;
  readonly isDirty: boolean;
  readonly currentPageId: string | undefined;
  readonly selectedElementId: string | undefined;
  readonly pages: readonly DocumentPageSnapshot[];
  readonly elements: readonly EditorElementSnapshot[];
}

export type ApplicationErrorCode =
  | "NoActiveSession"
  | "InvalidInput"
  | "DomainOperationRejected"
  | "SessionAlreadyDisposed"
  | "SessionCreationFailed";

export type ApplicationErrorReason =
  | "invalid-session-id"
  | "invalid-page-id"
  | "invalid-element-id"
  | "no-pages"
  | "duplicate-page"
  | "duplicate-element"
  | "invalid-page-dimensions"
  | "invalid-page-rotation"
  | "invalid-element-bounds"
  | "missing-page"
  | "missing-element"
  | "cannot-delete-last-page"
  | "invalid-page-order"
  | "session-disposed"
  | "unexpected-domain-error";

export interface ApplicationError {
  readonly code: ApplicationErrorCode;
  readonly reason?: ApplicationErrorReason;
}

export interface ApplicationSuccess<TValue> {
  readonly ok: true;
  readonly value: TValue;
}

export interface ApplicationFailure {
  readonly ok: false;
  readonly error: ApplicationError;
}

export type ApplicationResult<TValue> = ApplicationSuccess<TValue> | ApplicationFailure;

export class DocumentSessionService {
  #activeSession: DocumentSession | undefined;

  public constructor(private readonly idGenerator: IdGenerator) {}

  public createSession(
    input: CreateDocumentSessionInput,
  ): ApplicationResult<DocumentSessionSnapshot> {
    const generatedSessionId = this.#nextId();
    if (!generatedSessionId.ok) {
      return generatedSessionId;
    }

    try {
      const nextSession = DocumentSession.create({
        id: generatedSessionId.value,
        pages: input.pages.map(clonePageInput),
        ...(input.temporaryPersonalInfo === undefined
          ? {}
          : { temporaryPersonalInfo: { ...input.temporaryPersonalInfo } }),
        ...(input.sourceReference === undefined ? {} : { sourceReference: input.sourceReference }),
      });
      const previousSession = this.#activeSession;
      previousSession?.dispose();
      this.#activeSession = nextSession;
      return succeed(snapshotOf(nextSession));
    } catch (error) {
      if (isDomainError(error)) {
        return fail("SessionCreationFailed", mapDomainErrorReason(error.code));
      }
      return fail("SessionCreationFailed", "unexpected-domain-error");
    }
  }

  public getSnapshot(): ApplicationResult<DocumentSessionSnapshot> {
    return this.#withActiveSession((session) => succeed(snapshotOf(session)));
  }

  public navigateToPage(input: NavigateToPageInput): ApplicationResult<DocumentSessionSnapshot> {
    return this.#withActiveSession((session) =>
      this.#applyDomainResult(session, session.setCurrentPage(input.pageId)),
    );
  }

  public selectElement(input: SelectElementInput): ApplicationResult<DocumentSessionSnapshot> {
    return this.#withActiveSession((session) =>
      this.#applyDomainResult(session, session.selectElement(input.elementId)),
    );
  }

  public clearSelection(): ApplicationResult<DocumentSessionSnapshot> {
    return this.#withActiveSession((session) =>
      this.#applyDomainResult(session, session.clearSelection()),
    );
  }

  public addElement(input: AddEditorElementInput): ApplicationResult<DocumentSessionSnapshot> {
    return this.#withActiveSession((session) => {
      const generatedElementId = this.#nextId();
      if (!generatedElementId.ok) {
        return generatedElementId;
      }

      return this.#applyDomainResult(
        session,
        session.addElement({
          id: generatedElementId.value,
          pageId: input.pageId,
          type: input.type,
          bounds: cloneBounds(input.bounds),
          ...(input.content === undefined ? {} : { content: { ...input.content } }),
        }),
      );
    });
  }

  public updateElement(
    input: UpdateEditorElementInput,
  ): ApplicationResult<DocumentSessionSnapshot> {
    return this.#withActiveSession((session) =>
      this.#applyDomainResult(
        session,
        session.updateElement({
          id: input.id,
          pageId: input.pageId,
          type: input.type,
          bounds: cloneBounds(input.bounds),
          ...(input.content === undefined ? {} : { content: { ...input.content } }),
        }),
      ),
    );
  }

  public deleteElement(input: DeleteElementInput): ApplicationResult<DocumentSessionSnapshot> {
    return this.#withActiveSession((session) =>
      this.#applyDomainResult(session, session.deleteElement(input.elementId)),
    );
  }

  public deletePage(input: DeletePageInput): ApplicationResult<DocumentSessionSnapshot> {
    return this.#withActiveSession((session) =>
      this.#applyDomainResult(session, session.deletePage(input.pageId)),
    );
  }

  public reorderPages(input: ReorderPagesInput): ApplicationResult<DocumentSessionSnapshot> {
    return this.#withActiveSession((session) =>
      this.#applyDomainResult(session, session.reorderPages(input.pageIds)),
    );
  }

  public markSessionClean(): ApplicationResult<DocumentSessionSnapshot> {
    return this.#withActiveSession((session) =>
      this.#applyDomainResult(session, session.markClean()),
    );
  }

  public disposeSession(): ApplicationResult<void> {
    const session = this.#activeSession;
    if (session === undefined) {
      return fail("NoActiveSession");
    }

    session.dispose();
    this.#activeSession = undefined;
    return succeed(undefined);
  }

  #nextId(): ApplicationResult<string> {
    try {
      return succeed(this.idGenerator.nextId());
    } catch {
      return fail("InvalidInput");
    }
  }

  #withActiveSession<TValue>(
    operation: (session: DocumentSession) => ApplicationResult<TValue>,
  ): ApplicationResult<TValue> {
    const session = this.#activeSession;
    if (session === undefined) {
      return fail("NoActiveSession");
    }

    if (session.status === "disposed") {
      return fail("SessionAlreadyDisposed", "session-disposed");
    }

    return operation(session);
  }

  #applyDomainResult(
    session: DocumentSession,
    domainResult: DomainResult,
  ): ApplicationResult<DocumentSessionSnapshot> {
    if (domainResult.ok) {
      return succeed(snapshotOf(session));
    }

    return mapDomainFailure(domainResult);
  }
}

const succeed = <TValue>(value: TValue): ApplicationSuccess<TValue> => ({ ok: true, value });

const fail = (code: ApplicationErrorCode, reason?: ApplicationErrorReason): ApplicationFailure => ({
  ok: false,
  error: reason === undefined ? { code } : { code, reason },
});

const mapDomainFailure = (failure: DomainFailure): ApplicationFailure => {
  if (failure.error.code === "SessionDisposed") {
    return fail("SessionAlreadyDisposed", "session-disposed");
  }

  return fail("DomainOperationRejected", mapDomainErrorReason(failure.error.code));
};

const mapDomainErrorReason = (code: DomainErrorCode): ApplicationErrorReason => {
  switch (code) {
    case "InvalidSessionId":
      return "invalid-session-id";
    case "InvalidPageId":
      return "invalid-page-id";
    case "InvalidElementId":
      return "invalid-element-id";
    case "NoPages":
      return "no-pages";
    case "DuplicatePageId":
      return "duplicate-page";
    case "DuplicateElementId":
      return "duplicate-element";
    case "InvalidPageDimensions":
      return "invalid-page-dimensions";
    case "InvalidPageRotation":
      return "invalid-page-rotation";
    case "InvalidElementBounds":
      return "invalid-element-bounds";
    case "PageNotFound":
      return "missing-page";
    case "ElementNotFound":
      return "missing-element";
    case "CannotDeleteLastPage":
      return "cannot-delete-last-page";
    case "InvalidPageOrder":
      return "invalid-page-order";
    case "SessionDisposed":
      return "session-disposed";
  }
};

const snapshotOf = (session: DocumentSession): DocumentSessionSnapshot =>
  Object.freeze({
    sessionId: session.id,
    status: session.status,
    isDirty: session.isDirty,
    currentPageId: session.currentPageId,
    selectedElementId: session.selectedElementId,
    pages: Object.freeze(session.pages().map(pageSnapshotOf)),
    elements: Object.freeze(session.elements().map(elementSnapshotOf)),
  });

const pageSnapshotOf = (page: DocumentPage): DocumentPageSnapshot =>
  Object.freeze({
    id: page.id,
    width: page.width,
    height: page.height,
    rotation: page.rotation,
  });

const elementSnapshotOf = (element: EditorElement): EditorElementSnapshot =>
  Object.freeze({
    id: element.id,
    pageId: element.pageId,
    type: element.type,
    bounds: Object.freeze(cloneBounds(element.bounds)),
    ...(element.content === undefined ? {} : { content: Object.freeze({ ...element.content }) }),
  });

const clonePageInput = (page: DocumentPageInput): DocumentPage => ({
  id: page.id,
  width: page.width,
  height: page.height,
  rotation: page.rotation,
});

const cloneBounds = (bounds: Bounds): Bounds => ({
  x: bounds.x,
  y: bounds.y,
  width: bounds.width,
  height: bounds.height,
});
