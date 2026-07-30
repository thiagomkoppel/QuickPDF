import type {
  LocalPdfFile,
  LocalPdfFileReader,
  LocalPdfReadResult,
} from "../../application/editor-application";

export class BrowserLocalPdfFileReader implements LocalPdfFileReader {
  public async read(file: LocalPdfFile): Promise<LocalPdfReadResult> {
    if (file.size <= 0) {
      return { ok: false, error: { code: "EmptyFile", message: "Choose a non-empty PDF file." } };
    }
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".pdf") && file.type !== "application/pdf") {
      return {
        ok: false,
        error: { code: "UnsupportedFile", message: "Only PDF files can be opened." },
      };
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const hasPdfSignature =
        bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70 && bytes[4] === 45;
      if (!hasPdfSignature) {
        return {
          ok: false,
          error: { code: "InvalidPdf", message: "This file does not look like a valid PDF." },
        };
      }
      return { ok: true, fileName: file.name, bytes };
    } catch {
      return {
        ok: false,
        error: { code: "UnreadableFile", message: "The selected PDF could not be read." },
      };
    }
  }
}
