import { expect, test } from "@playwright/test";
import type { PdfJsCompatibilityResult } from "../src/infrastructure/browser/browser-compatibility";

declare global {
  interface Window {
    __quickpdfCompatibilityResult__?: PdfJsCompatibilityResult;
  }
}

const compatibleProbe = {
  status: "compatible",
  diagnostics: {
    missingRequiredApis: [],
    canvasAvailable: true,
    moduleLoaded: true,
    workerInitialized: true,
    renderProbeCompleted: true,
  },
} as const;
const incompatibleProbe = {
  status: "incompatible",
  reason: "render-probe-failed",
  diagnostics: {
    missingRequiredApis: [],
    canvasAvailable: true,
    moduleLoaded: true,
    workerInitialized: true,
    renderProbeCompleted: false,
  },
} as const;

const indeterminateProbe = {
  status: "indeterminate",
  diagnostics: {
    missingRequiredApis: [],
    canvasAvailable: true,
    moduleLoaded: true,
    workerInitialized: false,
    renderProbeCompleted: false,
  },
} as const;

test("never mounts the unsupported page for a compatible renderer", async ({ page }) => {
  await page.addInitScript((result) => {
    window.__quickpdfCompatibilityResult__ = result;
  }, compatibleProbe);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Preparing Nest" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browser not supported" })).toHaveCount(0);
  await expect(page.getByLabel("Choose a PDF file")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browser not supported" })).toHaveCount(0);
});
test("keeps the startup screen contained on small phones", async ({ page }) => {
  await page.addInitScript((result) => {
    window.__quickpdfCompatibilityResult__ = result;
  }, compatibleProbe);

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 640 },
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Preparing Nest" })).toBeVisible();

    const layout = await page.evaluate(() => {
      const rectFor = (selector: string): DOMRect => {
        const element = document.querySelector(selector);
        if (element === null) throw new Error(`Missing ${selector}`);
        return element.getBoundingClientRect();
      };
      const content = rectFor(".startup-screen__content");
      const brandMark = rectFor(".startup-screen__brand img");
      const privacy = rectFor(".startup-screen__privacy");
      return {
        content: {
          top: content.top,
          right: content.right,
          bottom: content.bottom,
          left: content.left,
        },
        brandMarkWidth: brandMark.width,
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        privacy: { right: privacy.right, left: privacy.left },
        scrollWidth: document.documentElement.scrollWidth,
      };
    });

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.innerWidth);
    expect(layout.content.top).toBeGreaterThanOrEqual(0);
    expect(layout.content.bottom).toBeLessThanOrEqual(layout.innerHeight);
    expect(layout.content.left).toBeGreaterThanOrEqual(0);
    expect(layout.content.right).toBeLessThanOrEqual(layout.innerWidth);
    expect(layout.privacy.left).toBeGreaterThanOrEqual(0);
    expect(layout.privacy.right).toBeLessThanOrEqual(layout.innerWidth);
    expect(layout.brandMarkWidth).toBeLessThanOrEqual(64);
  }
});
test("shows the compatibility panel only for a confirmed incompatible renderer", async ({
  page,
}) => {
  await page.addInitScript((result) => {
    window.__quickpdfCompatibilityResult__ = result;
  }, incompatibleProbe);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Browser not supported" })).toBeVisible();
  await expect(
    page.getByText("This browser cannot reliably display PDFs in NestlyPDF."),
  ).toBeVisible();
  await expect(page.getByLabel("Choose a PDF file")).toHaveCount(0);
});

test("keeps the PDF picker available for an indeterminate renderer probe", async ({ page }) => {
  await page.addInitScript((result) => {
    window.__quickpdfCompatibilityResult__ = result;
  }, indeterminateProbe);

  await page.goto("/");

  await expect(page.getByLabel("Choose a PDF file")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browser not supported" })).toHaveCount(0);
});
