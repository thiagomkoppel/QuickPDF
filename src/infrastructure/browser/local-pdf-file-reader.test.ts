import { describe, expect, it } from "vitest";

import { BrowserLocalPdfFileReader } from "./local-pdf-file-reader";

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

const file = (overrides: {
  readonly name?: string;
  readonly size?: number;
  readonly bytes?: Uint8Array;
  readonly throws?: boolean;
}) => ({
  name: overrides.name ?? "sample.pdf",
  size: overrides.size ?? overrides.bytes?.byteLength ?? pdfBytes.byteLength,
  type: "application/pdf",
  arrayBuffer: () => {
    if (overrides.throws === true) {
      return Promise.reject(new Error("read failed"));
    }
    const bytes = overrides.bytes ?? pdfBytes;
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return Promise.resolve(buffer);
  },
});

describe("BrowserLocalPdfFileReader", () => {
  it("accepts non-empty files with a PDF signature", async () => {
    const reader = new BrowserLocalPdfFileReader({ maxBytes: 1024 });

    expect(await reader.read(file({ name: "sample.pdf" }))).toMatchObject({
      ok: true,
      fileName: "sample.pdf",
    });
  });

  it("rejects empty, oversized, invalid-signature, and unreadable files", async () => {
    const reader = new BrowserLocalPdfFileReader({ maxBytes: 5 });

    await expect(reader.read(file({ size: 0, bytes: new Uint8Array() }))).resolves.toMatchObject({
      ok: false,
      error: { code: "EmptyFile" },
    });
    await expect(reader.read(file({ size: 6 }))).resolves.toMatchObject({
      ok: false,
      error: { code: "FileTooLarge" },
    });
    await expect(reader.read(file({ bytes: new Uint8Array([1, 2, 3]) }))).resolves.toMatchObject({
      ok: false,
      error: { code: "UnsupportedFile" },
    });
    await expect(reader.read(file({ throws: true }))).resolves.toMatchObject({
      ok: false,
      error: { code: "UnreadableFile" },
    });
  });
});
