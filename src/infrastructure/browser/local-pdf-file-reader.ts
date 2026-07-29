import type {
  EditorError,
  LocalPdfFile,
  LocalPdfFileReader,
  LocalPdfReadResult,
} from "../../application/editor-application";

export interface LocalPdfFileReaderOptions {
  readonly maxBytes: number;
}

const pdfSignature = [0x25, 0x50, 0x44, 0x46, 0x2d] as const;

const failure = (code: EditorError["code"], message: string): LocalPdfReadResult => ({
  ok: false,
  error: { code, message },
});

const hasPdfSignature = (bytes: Uint8Array): boolean => {
  const searchLimit = Math.min(bytes.length, 1024);

  for (let offset = 0; offset <= searchLimit - pdfSignature.length; offset += 1) {
    if (pdfSignature.every((byte, index) => bytes[offset + index] === byte)) {
      return true;
    }
  }

  return false;
};

export class BrowserLocalPdfFileReader implements LocalPdfFileReader {
  readonly #maxBytes: number;

  public constructor(options: LocalPdfFileReaderOptions) {
    this.#maxBytes = options.maxBytes;
  }

  public async read(file: LocalPdfFile): Promise<LocalPdfReadResult> {
    if (file.size === 0) {
      return failure("EmptyFile", "Choose a PDF that is not empty.");
    }

    if (file.size > this.#maxBytes) {
      return failure("FileTooLarge", "Choose a smaller PDF for this device.");
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!hasPdfSignature(bytes)) {
        return failure("UnsupportedFile", "Choose a valid PDF file.");
      }

      return { ok: true, fileName: file.name, bytes };
    } catch {
      return failure("UnreadableFile", "The selected file could not be read.");
    }
  }
}
