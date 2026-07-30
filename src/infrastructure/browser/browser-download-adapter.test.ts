import { afterEach, describe, expect, it, vi } from "vitest";

import { BrowserDownloadAdapter } from "./browser-download-adapter";

describe("BrowserDownloadAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("downloads with a temporary object URL and revokes it", () => {
    const createObjectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:quickpdf-export");
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    new BrowserDownloadAdapter().download({
      bytes: new Uint8Array([1, 2, 3]),
      filename: "contract-edited.pdf",
      mimeType: "application/pdf",
    });

    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:quickpdf-export");
    expect(document.querySelector('a[download="contract-edited.pdf"]')).toBeNull();
  });
});
