import { DocumentSessionService, type IdGenerator } from "./document-session-service";

export const createDocumentSessionApplication = (
  idGenerator: IdGenerator,
): DocumentSessionService => new DocumentSessionService(idGenerator);
