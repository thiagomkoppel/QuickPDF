import { writeFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const asciiBytes = (text: string): Uint8Array => new TextEncoder().encode(text);

const onePagePdf = (): Uint8Array => {
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << >> /Contents 4 0 R >>\nendobj\n",
    "4 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\n",
  ];
  let pdf = "%PDF-1.7\n";
  const offsets = [0];

  for (const object of objects) {
    offsets.push(asciiBytes(pdf).byteLength);
    pdf += object;
  }

  const xrefOffset = asciiBytes(pdf).byteLength;
  pdf += `xref\n0 ${String(objects.length + 1)}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\n`;
  pdf += `startxref\n${String(xrefOffset)}\n%%EOF\n`;

  return asciiBytes(pdf);
};

test("adds text and whiteout, warns on discard, and supports modified-wheel zoom", async ({
  page,
}, testInfo) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      externalRequests.push(request.url());
    }
  });

  const fixturePath = testInfo.outputPath("overlay-fixture.pdf");
  await writeFile(fixturePath, onePagePdf());

  await page.goto("/");
  await page.getByLabel(/open a local pdf/i).setInputFiles(fixturePath);
  await expect(page.getByRole("heading", { name: "overlay-fixture.pdf" })).toBeVisible();

  await page.getByRole("button", { name: "Text" }).click();
  await page.getByLabel("PDF overlay").click({ position: { x: 80, y: 90 } });
  await page.getByLabel("Edit text element").fill("Hello PDF");
  await expect(page.getByText("Unsaved temporary edits")).toBeVisible();

  await page.getByRole("button", { name: "Whiteout" }).click();
  await page.getByLabel("PDF overlay").click({ position: { x: 120, y: 150 } });
  await expect(page.getByRole("group", { name: /whiteout element selected/i })).toBeVisible();

  await page.mouse.wheel(0, -120);
  await expect(page.getByRole("button", { name: "100%" })).toBeVisible();
  const platform = await page.evaluate(() => navigator.platform);
  const modifier = platform.toLowerCase().includes("mac") ? "Meta" : "Control";
  await page.keyboard.down(modifier);
  await page.mouse.wheel(0, -120);
  await page.keyboard.up(modifier);
  await expect(page.getByRole("button", { name: "125%" })).toBeVisible();
  await expect(page.getByText("Unsaved temporary edits")).toBeVisible();

  await page.getByRole("button", { name: "Close document" }).click();
  await expect(page.getByRole("dialog", { name: "Discard unsaved edits?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByLabel("Edit text element")).toHaveValue("Hello PDF");

  await page.getByRole("button", { name: "Close document" }).click();
  await page.getByRole("button", { name: "Discard edits" }).click();
  await expect(page.getByRole("heading", { name: "QuickPDF" })).toBeVisible();
  expect(externalRequests).toEqual([]);
});
