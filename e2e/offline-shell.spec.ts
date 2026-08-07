import { readFile } from "node:fs/promises";

import { createCanvas } from "@napi-rs/canvas";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { expect, test } from "@playwright/test";

const createPdf = async (): Promise<Buffer> => {
  const raster = createCanvas(900, 1200);
  const context = raster.getContext("2d");
  const image = context.createImageData(900, 1200);
  let seed = 1_337;
  for (let y = 0; y < 1200; y += 1) {
    for (let x = 0; x < 900; x += 1) {
      seed = (seed * 1_103_515_245 + 12_345) & 0x7fff_ffff;
      const offset = (y * 900 + x) * 4;
      const noise = (seed & 15) - 8;
      image.data[offset] = Math.max(0, Math.min(255, Math.round((x / 899) * 255) + noise));
      image.data[offset + 1] = Math.max(0, Math.min(255, Math.round((y / 1199) * 255) + noise));
      image.data[offset + 2] = Math.max(0, Math.min(255, 148 + noise));
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  const document = await PDFDocument.create();
  const page = document.addPage([300, 400]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  const embeddedRaster = await document.embedPng(raster.toBuffer("image/png"));
  page.drawImage(embeddedRaster, { x: 0, y: 0, width: 300, height: 400 });
  page.drawRectangle({ x: 35, y: 300, width: 150, height: 50, color: rgb(0, 0, 0) });
  page.drawText("OFFLINE SOURCE", { x: 42, y: 330, size: 18, font, color: rgb(1, 1, 1) });
  return Buffer.from(await document.save());
};

const waitForControl = async (page: import("@playwright/test").Page): Promise<string[]> => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => navigator.serviceWorker.controller !== null)))
    await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
  return page.evaluate(async () => {
    const names = await caches.keys();
    const name = names.find((value) => value.startsWith("quickpdf-shell-"));
    if (name === undefined) return [];
    return (await caches.open(name))
      .keys()
      .then((requests) => requests.map((request) => request.url));
  });
};

const expectValidPdfDownload = async (
  download: import("@playwright/test").Download,
): Promise<number> => {
  const path = await download.path();
  const bytes = await readFile(path);
  const exported = await PDFDocument.load(bytes);
  expect(exported.getPageCount()).toBeGreaterThan(0);
  return bytes.byteLength;
};

const expectNoDocumentDataInShellCache = (cachedUrls: readonly string[]): void => {
  expect(
    cachedUrls.every(
      (url) =>
        !url.endsWith(".pdf") &&
        !url.startsWith("blob:") &&
        !url.startsWith("data:") &&
        !url.includes("offline-fixture"),
    ),
  ).toBe(true);
};

test("uses the production shell to open and render a local PDF offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Edit PDFs/i })).toBeVisible({ timeout: 9_000 });
  const cachedUrls = await waitForControl(page);
  expect(cachedUrls.some((url) => url.endsWith("/index.html") || url.endsWith("/"))).toBe(true);
  expect(cachedUrls.some((url) => url.includes("pdf.worker"))).toBe(true);
  expect(cachedUrls.some((url) => url.includes("PatrickHand"))).toBe(true);
  expect(cachedUrls.some((url) => url.endsWith("manifest.webmanifest"))).toBe(true);
  expectNoDocumentDataInShellCache(cachedUrls);

  const failedRequests: string[] = [];
  page.on("requestfailed", (request) => failedRequests.push(request.url()));
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole("heading", { name: /Edit PDFs/i })).toBeVisible({ timeout: 9_000 });
    const sourcePdf = await createPdf();
    expect(sourcePdf.byteLength).toBeGreaterThan(200_000);
    await page.getByLabel("Choose a PDF file").setInputFiles({
      name: "offline-fixture.pdf",
      mimeType: "application/pdf",
      buffer: sourcePdf,
    });
    await expect(page.getByLabel("Rendered PDF page")).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(() =>
        page.locator('canvas[aria-label="Rendered PDF page"]').evaluate((node) => {
          const canvas = node as HTMLCanvasElement;
          const context = canvas.getContext("2d");
          return (
            context !== null &&
            canvas.width > 0 &&
            canvas.height > 0 &&
            context
              .getImageData(0, 0, canvas.width, canvas.height)
              .data.some((value) => value !== 255)
          );
        }),
      )
      .toBe(true);
    expect(failedRequests.some((url) => url.includes("pdf.worker"))).toBe(false);

    await page.getByRole("button", { name: "Text" }).click();
    await page.getByLabel("PDF overlay").click({ position: { x: 100, y: 100 } });
    await page.getByLabel("Edit text element").fill("Offline Patrick Hand");
    await page.getByRole("tab", { name: "Style" }).click();
    await page
      .getByRole("combobox", { name: /^Text font$/ })
      .selectOption({ label: "Patrick Hand" });

    const originalDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download" }).click();
    await page
      .getByRole("dialog", { name: "Export PDF" })
      .getByRole("button", { name: "Export PDF" })
      .click();
    const originalBytes = await expectValidPdfDownload(await originalDownload);

    await page.getByRole("button", { name: "Download" }).click();
    const exportDialog = page.getByRole("dialog", { name: "Export PDF" });
    await exportDialog.getByRole("radio", { name: /Compress PDF/ }).check();
    const compressedDownload = page.waitForEvent("download");
    await Promise.all([
      expect(exportDialog.getByText("Compressing PDF...")).toBeVisible(),
      exportDialog.getByRole("button", { name: "Export PDF" }).click(),
    ]);
    const compressedBytes = await expectValidPdfDownload(await compressedDownload);
    expect(compressedBytes).toBeLessThan(originalBytes);

    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
    await page.goto("/editor");
    await expect(page.getByLabel("Choose a PDF file")).toBeVisible({ timeout: 9_000 });

    expectNoDocumentDataInShellCache(await waitForControl(page));
  } finally {
    await context.setOffline(false);
  }
});

test("cold-starts the standalone manifest route from the production shell while offline", async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    const originalMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query: string): MediaQueryList =>
      query.includes("display-mode: standalone")
        ? ({
            matches: true,
            media: query,
            onchange: null,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            addListener: () => undefined,
            removeListener: () => undefined,
            dispatchEvent: () => false,
          } as MediaQueryList)
        : originalMatchMedia(query);
  });

  await page.goto("/");
  await expect(page.getByLabel("Choose a PDF file")).toBeVisible({ timeout: 9_000 });
  const launchConfiguration = await page.evaluate(async () => {
    const response = await fetch("/manifest.webmanifest");
    return (await response.json()) as {
      readonly id: string;
      readonly start_url: string;
      readonly scope: string;
      readonly display: string;
    };
  });
  expect(launchConfiguration).toMatchObject({
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
  });
  await waitForControl(page);
  await page.close();
  await context.setOffline(true);

  const coldPage = await context.newPage();
  try {
    await coldPage.goto(launchConfiguration.start_url);
    await expect(coldPage.getByLabel("Choose a PDF file")).toBeVisible({ timeout: 9_000 });
    expect(
      await coldPage.evaluate(() => window.matchMedia("(display-mode: standalone)").matches),
    ).toBe(true);
    expect(await coldPage.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    expect(
      await coldPage.evaluate(
        async () => (await navigator.serviceWorker.getRegistration("/"))?.scope,
      ),
    ).toBe(`${new URL(coldPage.url()).origin}/`);
  } finally {
    await coldPage.close();
    await context.setOffline(false);
  }
});
test("shows only non-sensitive shell diagnostics when explicitly requested", async ({ page }) => {
  await page.goto("/?pwa-debug=1");

  await expect(page.getByRole("heading", { name: "QuickPDF diagnostics" })).toBeVisible({
    timeout: 9_000,
  });
  await expect(page.getByText("Service worker supported", { exact: true })).toBeVisible();
  await expect(page.getByText("Manifest start URL", { exact: true })).toBeVisible();
  await expect(page.getByText("Cached PDF.js worker", { exact: true })).toBeVisible();
  await expect(page.getByText("No document or user data is shown.")).toBeVisible();
  await expect(page.getByLabel("Choose a PDF file")).toHaveCount(0);
});
test.describe("offline responsive shell", () => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
  ]) {
    test(`loads offline at ${String(viewport.width)}x${String(viewport.height)}`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expect(page.getByRole("heading", { name: /Edit PDFs/i })).toBeVisible({
        timeout: 9_000,
      });
      await waitForControl(page);
      await context.setOffline(true);
      try {
        await page.reload();
        await expect(page.getByLabel("Choose a PDF file")).toBeVisible({ timeout: 9_000 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
      } finally {
        await context.setOffline(false);
      }
    });
  }
});
