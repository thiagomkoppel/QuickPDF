import { writeFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const asciiBytes = (text: string): Uint8Array => new TextEncoder().encode(text);

const onePagePdf = (): Uint8Array => {
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Resources << >> /Contents 4 0 R >>\nendobj\n",
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

test("opens, renders, zooms, and closes a local PDF without external document requests", async ({
  page,
}, testInfo) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      externalRequests.push(request.url());
    }
  });

  const fixturePath = testInfo.outputPath("synthetic.pdf");
  await writeFile(fixturePath, onePagePdf());

  await page.goto("/");
  await page.getByLabel(/open a local pdf/i).setInputFiles(fixturePath);

  await expect(page.getByRole("heading", { name: "synthetic.pdf" })).toBeVisible();
  const canvas = page.getByLabel("PDF page 1 of 1");
  await expect(canvas).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();

  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByRole("button", { name: "125%" })).toBeVisible();
  await page.getByRole("button", { name: "Close document" }).click();
  await expect(page.getByRole("heading", { name: "QuickPDF" })).toBeVisible();
  expect(externalRequests).toEqual([]);
});
