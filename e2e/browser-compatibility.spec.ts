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

  await expect(page.getByRole("heading", { name: "Preparing QuickPDF" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browser not supported" })).toHaveCount(0);
  await expect(page.getByLabel("Choose a PDF file")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browser not supported" })).toHaveCount(0);
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
    page.getByText("This browser cannot reliably display PDFs in QuickPDF."),
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
