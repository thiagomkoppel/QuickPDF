import { describe, expect, it } from "vitest";

import { BrowserLocalPdfFileReader } from "./local-pdf-file-reader";

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

const file = (overrides: {
  readonly name?: string;
  readonly size?: number;
  readonly type?: string;
  readonly bytes?: Uint8Array;
  readonly throws?: boolean;
}) => ({
  name: overrides.name ?? "document.pdf",
  size: overrides.size ?? overrides.bytes?.byteLength ?? pdfBytes.byteLength,
  type: overrides.type ?? "application/pdf",
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
  it("accepts a non-empty file with a PDF signature", async () => {
    const reader = new BrowserLocalPdfFileReader({ maxBytes: 1024 });

    const result = await reader.read(file({ name: "Example.PDF" }));

    expect(result).toMatchObject({ ok: true, fileName: "Example.PDF" });
  });

  it("rejects empty files", async () => {
    const reader = new BrowserLocalPdfFileReader({ maxBytes: 1024 });

    const result = await reader.read(file({ size: 0, bytes: new Uint8Array() }));

    expect(result).toMatchObject({ ok: false, error: { code: "EmptyFile" } });
  });

  it("rejects oversized files before reading bytes", async () => {
    const reader = new BrowserLocalPdfFileReader({ maxBytes: 4 });

    const result = await reader.read(file({ size: 5 }));

    expect(result).toMatchObject({ ok: false, error: { code: "FileTooLarge" } });
  });

  it("rejects files without a PDF signature", async () => {
    const reader = new BrowserLocalPdfFileReader({ maxBytes: 1024 });

    const result = await reader.read(file({ bytes: new Uint8Array([1, 2, 3, 4, 5]) }));

    expect(result).toMatchObject({ ok: false, error: { code: "UnsupportedFile" } });
  });

  it("maps read failures to a stable error code", async () => {
    const reader = new BrowserLocalPdfFileReader({ maxBytes: 1024 });

    const result = await reader.read(file({ throws: true }));

    expect(result).toMatchObject({ ok: false, error: { code: "UnreadableFile" } });
  });
});
