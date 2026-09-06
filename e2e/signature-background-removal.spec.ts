import { writeFile } from "node:fs/promises";

import { PDFDocument } from "pdf-lib";
import { expect, test, type Page } from "@playwright/test";

const createPdf = async (): Promise<Buffer> => {
  const document = await PDFDocument.create();
  document.addPage([300, 400]);
  return Buffer.from(await document.save());
};

/**
 * A JPEG that looks like a phone photo of a signature: grey paper, uneven light, paper grain,
 * and a dark curved stroke. Encoded in the browser so the test needs no image library.
 */
const createSignaturePhoto = async (page: Page): Promise<string> =>
  await page.evaluate(() => {
    const width = 900;
    const height = 320;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("no canvas context");
    }
    const image = context.createImageData(width, height);
    let seed = 7;
    const random = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const light =
          228 -
          (x / width) * 44 -
          (y / height) * 20 -
          Math.hypot(x / width - 0.5, y / height - 0.5) * 30;
        const value = light + (random() - 0.5) * 10;
        const offset = (y * width + x) * 4;
        image.data[offset] = value;
        image.data[offset + 1] = value - 3;
        image.data[offset + 2] = value - 7;
        image.data[offset + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    context.strokeStyle = "#141118";
    context.lineWidth = 5;
    context.lineCap = "round";
    context.beginPath();
    for (let step = 0; step <= 300; step += 1) {
      const progress = step / 300;
      const x = 70 + progress * (width - 150);
      const y = height / 2 + Math.sin(progress * 24) * 32 * Math.sin(progress * 3) - progress * 10;
      if (step === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.stroke();
    return canvas.toDataURL("image/jpeg", 0.9).split(",")[1] ?? "";
  });

test("removes the paper behind an uploaded signature photo in the browser", async ({
  page,
}, testInfo) => {
  const fixturePath = testInfo.outputPath("signature-upload.pdf");
  await writeFile(fixturePath, await createPdf());

  await page.goto("/");
  await page.getByLabel("Choose a PDF file").setInputFiles(fixturePath);
  await expect(page.getByRole("heading", { name: "signature-upload.pdf" })).toBeVisible();

  const photoPath = testInfo.outputPath("signature-photo.jpg");
  await writeFile(photoPath, Buffer.from(await createSignaturePhoto(page), "base64"));

  await page.getByRole("button", { name: "Signature", exact: true }).click();
  await page.getByRole("tab", { name: "Upload" }).click();
  await page.getByLabel("Upload signature image").setInputFiles(photoPath);

  await expect(page.getByLabel("Signature upload status")).toHaveText(/Background removed/);
  const preview = page.getByLabel("Uploaded signature preview");
  await expect(preview).toBeVisible();

  // The preview must be a transparent PNG cropped to the ink, not the original photograph.
  const separated = await preview.evaluate((node: HTMLElement) => {
    const element = node as HTMLImageElement;
    const canvas = document.createElement("canvas");
    canvas.width = element.naturalWidth;
    canvas.height = element.naturalHeight;
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("no canvas context");
    }
    context.drawImage(element, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let opaque = 0;
    let transparent = 0;
    for (let index = 3; index < data.length; index += 4) {
      if ((data[index] ?? 0) > 200) {
        opaque += 1;
      } else if ((data[index] ?? 0) === 0) {
        transparent += 1;
      }
    }
    return {
      isPng: element.src.startsWith("data:image/png"),
      width: canvas.width,
      height: canvas.height,
      opaque,
      transparent,
      corner: data[3] ?? 0,
    };
  });

  expect(separated.isPng).toBe(true);
  expect(separated.corner).toBe(0);
  // Cropped down from the 900x320 photo, mostly transparent, with the strokes still solid.
  expect(separated.height).toBeLessThan(260);
  expect(separated.opaque).toBeGreaterThan(1000);
  expect(separated.transparent).toBeGreaterThan(separated.opaque * 3);

  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const placed = page.locator(".overlay-signature img");
  await expect(placed).toBeVisible();
  await expect(placed).toHaveAttribute("src", /^data:image\/png/);
});

/** Media box 612x792 with the visible area cropped to 612x768, its top 12 units lower. */
const createCroppedPdf = async (): Promise<Buffer> => {
  const document = await PDFDocument.create();
  const page = document.addPage([612, 792]);
  page.setCropBox(0, 12, 612, 768);
  return Buffer.from(await document.save());
};

/**
 * A solid black JPEG. Its border is indistinguishable from its middle, so removal keeps it as
 * uploaded and the placed element is ink edge to edge - which makes the exported position
 * measurable to the pixel.
 */
const createSolidSignature = async (page: Page): Promise<string> =>
  await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 80;
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("no canvas context");
    }
    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.95).split(",")[1] ?? "";
  });

/** Where the ink sits below the top of the visible page, in PDF page units. */
const inkTopInPageUnits = async (page: Page, pageHeight: number): Promise<number> =>
  await page.locator("canvas.pdf-page-canvas").evaluate((node: HTMLElement, height: number) => {
    const canvas = node as HTMLCanvasElement;
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("no canvas context");
    }
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const offset = (y * canvas.width + x) * 4;
        if ((data[offset] ?? 255) < 128 && (data[offset + 3] ?? 0) > 200) {
          return (y / canvas.height) * height;
        }
      }
    }
    return -1;
  }, pageHeight);

test("keeps a signature in the same place when a cropped page is exported", async ({
  page,
}, testInfo) => {
  const fixturePath = testInfo.outputPath("cropped.pdf");
  await writeFile(fixturePath, await createCroppedPdf());

  await page.goto("/");
  await page.getByLabel("Choose a PDF file").setInputFiles(fixturePath);
  await expect(page.getByRole("heading", { name: "cropped.pdf" })).toBeVisible();
  await expect(page.getByText("Rendering PDF page...")).toBeHidden();

  // The overlay grid must cover exactly what the reader draws, or placement is already wrong.
  const frame = await page.evaluate(() => {
    const canvas = document.querySelector("canvas.pdf-page-canvas");
    const layer = document.querySelector(".overlay-layer");
    if (canvas === null || layer === null) {
      throw new Error("editor not ready");
    }
    const canvasBox = canvas.getBoundingClientRect();
    const layerBox = layer.getBoundingClientRect();
    return {
      canvasHeight: canvasBox.height,
      layerHeight: layerBox.height,
      canvasTop: canvasBox.top,
      layerTop: layerBox.top,
    };
  });
  expect(Math.abs(frame.canvasHeight - frame.layerHeight)).toBeLessThan(1);
  expect(Math.abs(frame.canvasTop - frame.layerTop)).toBeLessThan(1);

  const signaturePath = testInfo.outputPath("solid-signature.jpg");
  await writeFile(signaturePath, Buffer.from(await createSolidSignature(page), "base64"));

  await page.getByRole("button", { name: "Signature", exact: true }).click();
  await page.getByRole("tab", { name: "Upload" }).click();
  await page.getByLabel("Upload signature image").setInputFiles(signaturePath);
  await expect(page.getByLabel("Uploaded signature preview")).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const placedTop = await page.evaluate(() => {
    const overlay = document.querySelector(".overlay-signature");
    const canvas = document.querySelector("canvas.pdf-page-canvas");
    if (overlay === null || canvas === null) {
      throw new Error("signature not placed");
    }
    const overlayBox = overlay.getBoundingClientRect();
    const canvasBox = canvas.getBoundingClientRect();
    // Visible page height is 768, so convert CSS pixels back into page units.
    return ((overlayBox.top - canvasBox.top) / canvasBox.height) * 768;
  });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  await page
    .getByRole("dialog", { name: "Export PDF" })
    .getByRole("button", { name: "Export PDF" })
    .click();
  const downloadedPath = testInfo.outputPath("cropped-edited.pdf");
  await (await downloadPromise).saveAs(downloadedPath);

  await page.goto("/");
  await page.getByLabel("Choose a PDF file").setInputFiles(downloadedPath);
  await expect(page.getByText("Rendering PDF page...")).toBeHidden();

  const exportedTop = await inkTopInPageUnits(page, 768);
  expect(exportedTop).toBeGreaterThan(0);
  // Before the crop box was honoured this landed 12 units too high.
  expect(Math.abs(exportedTop - placedTop)).toBeLessThan(2);
});
