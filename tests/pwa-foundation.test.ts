import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const publicFile = (name: string): string => resolve(root, "public", name);

describe("PWA foundation assets", () => {
  it("declares the standalone QuickPDF manifest and required install icons", async () => {
    const manifest = JSON.parse(await readFile(publicFile("manifest.webmanifest"), "utf8")) as {
      name: string;
      short_name: string;
      description: string;
      display: string;
      start_url: string;
      scope: string;
      background_color: string;
      theme_color: string;
      orientation: string;
      id: string;
      icons: readonly { src: string; sizes: string; purpose: string }[];
    };

    expect(manifest).toMatchObject({
      name: "QuickPDF",
      short_name: "QuickPDF",
      id: "/",
      description: "Private browser-based PDF editor",
      display: "standalone",
      start_url: "/",
      scope: "/",
      background_color: "#224248",
      theme_color: "#224248",
      orientation: "any",
    });
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/quickpdf-192.png", sizes: "192x192" }),
        expect.objectContaining({ src: "/quickpdf-512.png", sizes: "512x512" }),
        expect.objectContaining({ src: "/quickpdf-maskable-512.png", purpose: "maskable" }),
      ]),
    );

    for (const icon of [
      "quickpdf-192.png",
      "quickpdf-512.png",
      "quickpdf-maskable-512.png",
      "apple-touch-icon.png",
      "favicon.ico",
      "favicon-32.png",
      "favicon-16.png",
    ]) {
      expect((await stat(publicFile(icon))).size).toBeGreaterThan(0);
    }
  });

  it("links the manifest, theme color, Apple touch icon, and favicons without a service worker", async () => {
    const document = await readFile(resolve(root, "index.html"), "utf8");
    expect(document).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(document).toContain('name="theme-color" content="#224248"');
    expect(document).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(document).toContain('rel="apple-touch-icon" href="/apple-touch-icon.png"');
    expect(document).toContain('href="/favicon.ico"');
    expect(document).not.toMatch(/serviceWorker|service-worker/i);
    expect(document).toContain('id="quickpdf-boot-fallback"');
    expect(document).toContain("Starting QuickPDF...");
  });

  it("uses dynamic viewport units and safe-area insets in the application shell", async () => {
    const styles = await readFile(
      resolve(root, "src", "presentation", "styles", "global.css"),
      "utf8",
    );
    expect(styles).toContain("min-height: 100dvh");
    expect(styles).toContain("env(safe-area-inset-top");
    expect(styles).toContain("env(safe-area-inset-bottom");
  });
});
