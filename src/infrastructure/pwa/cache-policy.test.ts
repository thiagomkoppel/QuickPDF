import { describe, expect, it } from "vitest";

import { shouldCacheRequest } from "./cache-policy";

const response = (contentType: string): Response =>
  new Response("ok", { status: 200, headers: { "content-type": contentType } });

describe("shell cache policy", () => {
  it("allows only owned application shell assets", () => {
    expect(
      shouldCacheRequest(
        new Request(new URL("/assets/app.js", window.location.origin).href),
        response("application/javascript"),
      ),
    ).toBe(true);
    expect(
      shouldCacheRequest(
        new Request(new URL("/assets/pdf.worker.mjs", window.location.origin).href),
        response("text/javascript"),
      ),
    ).toBe(true);
    expect(
      shouldCacheRequest(
        new Request(new URL("/assets/font.ttf", window.location.origin).href),
        response("font/ttf"),
      ),
    ).toBe(true);
  });
  it("rejects PDFs, blobs, data URLs, and cross-origin assets", () => {
    expect(
      shouldCacheRequest(
        new Request(new URL("/document.pdf", window.location.origin).href),
        response("application/pdf"),
      ),
    ).toBe(false);
    expect(
      shouldCacheRequest(
        new Request("https://example.com/app.js"),
        response("application/javascript"),
      ),
    ).toBe(false);
  });
});
