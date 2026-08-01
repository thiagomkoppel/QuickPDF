import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { expect, test, type Page } from "@playwright/test";

const createPdf = async (): Promise<Buffer> => {
  const document = await PDFDocument.create();
  const page = document.addPage([300, 400]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  page.drawRectangle({ x: 40, y: 302, width: 120, height: 48, color: rgb(0, 0, 0) });
  page.drawText("SOURCE", { x: 45, y: 345, size: 20, font, color: rgb(1, 0, 0) });
  return Buffer.from(await document.save());
};

const renderedCanvasHasVisibleContent = (page: Page): Promise<boolean> =>
  page
    .locator('canvas[aria-label="Rendered PDF page"]')
    .evaluate((node: SVGElement | HTMLElement) => {
      const canvas = node as HTMLCanvasElement;
      const context = canvas.getContext("2d");
      if (context === null || canvas.width === 0 || canvas.height === 0) {
        return false;
      }
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let index = 0; index < data.length; index += 4) {
        const red = data[index] ?? 255;
        const green = data[index + 1] ?? 255;
        const blue = data[index + 2] ?? 255;
        const alpha = data[index + 3] ?? 0;
        if (alpha > 0 && (red < 245 || green < 245 || blue < 245)) {
          return true;
        }
      }
      return false;
    });

const canvasRegionIsMostlyWhite = (
  page: Page,
  region: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
): Promise<boolean> =>
  page
    .locator('canvas[aria-label="Rendered PDF page"]')
    .evaluate((node: SVGElement | HTMLElement, sampleRegion) => {
      const canvas = node as HTMLCanvasElement;
      const context = canvas.getContext("2d");
      if (context === null) {
        return false;
      }
      const cssWidth = Number.parseFloat(
        canvas.style.width.length > 0 ? canvas.style.width : String(canvas.width),
      );
      const cssHeight = Number.parseFloat(
        canvas.style.height.length > 0 ? canvas.style.height : String(canvas.height),
      );
      const scaleX = canvas.width / cssWidth;
      const scaleY = canvas.height / cssHeight;
      const x = Math.floor(sampleRegion.x * scaleX);
      const y = Math.floor(sampleRegion.y * scaleY);
      const width = Math.max(1, Math.floor(sampleRegion.width * scaleX));
      const height = Math.max(1, Math.floor(sampleRegion.height * scaleY));
      const data = context.getImageData(x, y, width, height).data;
      let whitePixels = 0;
      const pixelCount = data.length / 4;
      for (let index = 0; index < data.length; index += 4) {
        const red = data[index] ?? 0;
        const green = data[index + 1] ?? 0;
        const blue = data[index + 2] ?? 0;
        const alpha = data[index + 3] ?? 0;
        if (alpha > 0 && red > 245 && green > 245 && blue > 245) {
          whitePixels += 1;
        }
      }
      return whitePixels / pixelCount > 0.9;
    }, region);
const canvasRegionHasDarkContent = (
  page: Page,
  region: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
): Promise<boolean> =>
  page
    .locator('canvas[aria-label="Rendered PDF page"]')
    .evaluate((node: SVGElement | HTMLElement, sampleRegion) => {
      const canvas = node as HTMLCanvasElement;
      const context = canvas.getContext("2d");
      if (context === null) {
        return false;
      }
      const cssWidth = Number.parseFloat(
        canvas.style.width.length > 0 ? canvas.style.width : String(canvas.width),
      );
      const cssHeight = Number.parseFloat(
        canvas.style.height.length > 0 ? canvas.style.height : String(canvas.height),
      );
      const scaleX = canvas.width / cssWidth;
      const scaleY = canvas.height / cssHeight;
      const x = Math.floor(sampleRegion.x * scaleX);
      const y = Math.floor(sampleRegion.y * scaleY);
      const width = Math.max(1, Math.floor(sampleRegion.width * scaleX));
      const height = Math.max(1, Math.floor(sampleRegion.height * scaleY));
      const data = context.getImageData(x, y, width, height).data;
      for (let index = 0; index < data.length; index += 4) {
        const red = data[index] ?? 255;
        const green = data[index + 1] ?? 255;
        const blue = data[index + 2] ?? 255;
        const alpha = data[index + 3] ?? 0;
        if (alpha > 0 && red < 80 && green < 80 && blue < 80) {
          return true;
        }
      }
      return false;
    }, region);

const canvasRegionHasNonWhiteContent = (
  page: Page,
  region: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
): Promise<boolean> =>
  page
    .locator('canvas[aria-label="Rendered PDF page"]')
    .evaluate((node: SVGElement | HTMLElement, sampleRegion) => {
      const canvas = node as HTMLCanvasElement;
      const context = canvas.getContext("2d");
      if (context === null) {
        return false;
      }
      const cssWidth = Number.parseFloat(
        canvas.style.width.length > 0 ? canvas.style.width : String(canvas.width),
      );
      const cssHeight = Number.parseFloat(
        canvas.style.height.length > 0 ? canvas.style.height : String(canvas.height),
      );
      const scaleX = canvas.width / cssWidth;
      const scaleY = canvas.height / cssHeight;
      const x = Math.floor(sampleRegion.x * scaleX);
      const y = Math.floor(sampleRegion.y * scaleY);
      const width = Math.max(1, Math.floor(sampleRegion.width * scaleX));
      const height = Math.max(1, Math.floor(sampleRegion.height * scaleY));
      const data = context.getImageData(x, y, width, height).data;
      for (let index = 0; index < data.length; index += 4) {
        const red = data[index] ?? 255;
        const green = data[index + 1] ?? 255;
        const blue = data[index + 2] ?? 255;
        const alpha = data[index + 3] ?? 0;
        if (alpha > 0 && (red < 245 || green < 245 || blue < 245)) {
          return true;
        }
      }
      return false;
    }, region);
const browserScaleSnapshot = (
  page: Page,
): Promise<{
  readonly devicePixelRatio: number;
  readonly bannerHeight: number;
}> =>
  page.evaluate(() => ({
    devicePixelRatio: window.devicePixelRatio,
    bannerHeight: document.querySelector("header")?.getBoundingClientRect().height ?? 0,
  }));

const modifiedWheel = async (page: Page, direction: "in" | "out", count = 1): Promise<void> => {
  await page.keyboard.down("Control");
  for (let index = 0; index < count; index += 1) {
    await page.mouse.wheel(0, direction === "out" ? 160 : -160);
  }
  await page.keyboard.up("Control");
};
const dragWhiteout = async (
  page: Page,
  start: { readonly x: number; readonly y: number },
  end: { readonly x: number; readonly y: number },
): Promise<void> => {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await expect(page.getByLabel("Whiteout preview")).toBeVisible();
  await page.mouse.move(end.x, end.y);
  await expect(page.getByLabel("Whiteout preview")).toBeVisible();
  await page.mouse.up();
  await expect(page.getByLabel("Whiteout preview")).toHaveCount(0);
};

const borderWidthsFor = (page: Page, selector: string): Promise<string> =>
  page.locator(selector).evaluate((element) => {
    const style = window.getComputedStyle(element);
    return `${style.borderTopWidth} ${style.borderRightWidth} ${style.borderBottomWidth} ${style.borderLeftWidth}`;
  });

interface WheelListenerRecord {
  readonly tagName: string;
  readonly className: string;
  readonly ariaLabel: string | null;
}

interface WheelEventRecord {
  readonly target: string;
  readonly path: readonly string[];
  readonly editor: { readonly width: number; readonly height: number } | null;
  readonly viewport: { readonly width: number; readonly height: number } | null;
  readonly workspace: { readonly width: number; readonly height: number } | null;
  readonly pageFrame: { readonly width: number; readonly height: number } | null;
  readonly pointerInsideEditor: boolean;
  readonly pointerInsideViewport: boolean;
  readonly pointerInsideWorkspace: boolean;
  readonly pointerInsidePageFrame: boolean;
}

const installWheelListenerRecorder = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    type ListenerWindow = Window & { __quickPdfWheelListeners?: WheelListenerRecord[] };
    const listenerWindow = window as ListenerWindow;
    const originalAddEventListener = Reflect.get(EventTarget.prototype, "addEventListener");
    listenerWindow.__quickPdfWheelListeners = [];
    EventTarget.prototype.addEventListener = function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): void {
      if (type === "wheel" && this instanceof HTMLElement) {
        listenerWindow.__quickPdfWheelListeners?.push({
          tagName: this.tagName,
          className: this.className,
          ariaLabel: this.getAttribute("aria-label"),
        });
      }
      originalAddEventListener.call(this, type, listener, options);
    };
  });
};

const startWheelEventRecorder = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    interface RectRecord {
      readonly width: number;
      readonly height: number;
    }
    type EventWindow = Window & { __quickPdfWheelEvents?: WheelEventRecord[] };
    const eventWindow = window as EventWindow;
    const describe = (target: EventTarget): string => {
      if (!(target instanceof HTMLElement)) {
        return target.constructor.name;
      }
      const label = target.getAttribute("aria-label");
      const className = target.className;
      return [target.tagName.toLowerCase(), className, label].filter(Boolean).join(".");
    };
    const rectFor = (selector: string): DOMRect | null =>
      document.querySelector(selector)?.getBoundingClientRect() ?? null;
    const sizeFor = (rect: DOMRect | null): RectRecord | null =>
      rect === null ? null : { width: rect.width, height: rect.height };
    const contains = (rect: DOMRect | null, event: WheelEvent): boolean =>
      rect !== null &&
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    eventWindow.__quickPdfWheelEvents = [];
    document.addEventListener(
      "wheel",
      (event) => {
        const editor = rectFor(".editor-viewer");
        const viewport = rectFor('[aria-label="PDF editor viewport"]');
        const workspace = rectFor('[aria-label="PDF workspace"]');
        const pageFrame = rectFor(".pdf-page-frame");
        eventWindow.__quickPdfWheelEvents?.push({
          target: describe(event.target ?? document),
          path: event.composedPath().map(describe).slice(0, 8),
          editor: sizeFor(editor),
          viewport: sizeFor(viewport),
          workspace: sizeFor(workspace),
          pageFrame: sizeFor(pageFrame),
          pointerInsideEditor: contains(editor, event),
          pointerInsideViewport: contains(viewport, event),
          pointerInsideWorkspace: contains(workspace, event),
          pointerInsidePageFrame: contains(pageFrame, event),
        });
      },
      { capture: true },
    );
  });
};

const wheelListenerRecords = (page: Page): Promise<WheelListenerRecord[]> =>
  page.evaluate(() => {
    type ListenerWindow = Window & { readonly __quickPdfWheelListeners?: WheelListenerRecord[] };
    return (window as ListenerWindow).__quickPdfWheelListeners ?? [];
  });

const wheelEventRecords = (page: Page): Promise<WheelEventRecord[]> =>
  page.evaluate(() => {
    type EventWindow = Window & { readonly __quickPdfWheelEvents?: WheelEventRecord[] };
    return (window as EventWindow).__quickPdfWheelEvents ?? [];
  });
const addDrawnSignature = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Signature" }).click();
  const signaturePad = page.getByLabel("Draw signature");
  const padBox = await signaturePad.boundingBox();
  expect(padBox).not.toBeNull();
  if (padBox === null) {
    return;
  }
  await page.mouse.move(padBox.x + 60, padBox.y + 90);
  await page.mouse.down();
  await page.mouse.move(padBox.x + 160, padBox.y + 45);
  await page.mouse.move(padBox.x + 280, padBox.y + 100);
  await page.mouse.up();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByRole("group", { name: "signature element" })).toBeVisible();
};

const addTypedSignature = async (page: Page, name: string): Promise<void> => {
  await page.getByRole("button", { name: "Signature" }).click();
  await page.getByRole("tab", { name: "Type" }).click();
  await page.getByLabel("Signature name").fill(name);
  await page.getByLabel("Font").selectOption("serif");
  await expect(page.getByLabel("Signature preview")).toHaveText(name);
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByRole("group", { name: "signature element" })).toBeVisible();
};

const addTypedInitials = async (page: Page, initials: string): Promise<void> => {
  await page.getByRole("button", { name: "Initials" }).click();
  await page.getByRole("tab", { name: "Type" }).click();
  await page.getByLabel("Initials text").fill(initials);
  await expect(page.getByLabel("Signature preview")).toHaveText(initials);
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByRole("group", { name: "initials element" })).toBeVisible();
};

const downloadEditedPdf = async (
  page: Page,
  suggestedFilename: string,
  outputPath: string,
): Promise<void> => {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(suggestedFilename);
  await download.saveAs(outputPath);
};
const expectBoxNear = (
  box: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  } | null,
  expected: { readonly x: number; readonly y: number },
): void => {
  expect(box).not.toBeNull();
  if (box === null) {
    return;
  }
  expect(Math.abs(box.x - expected.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.y - expected.y)).toBeLessThanOrEqual(1);
};

test("opens a visible synthetic PDF, aligns overlays, and downloads an edited PDF", async ({
  page,
}, testInfo) => {
  const fixturePath = testInfo.outputPath("export-fixture.pdf");
  const fixtureBytes = await createPdf();
  await import("node:fs/promises").then((fs) => fs.writeFile(fixturePath, fixtureBytes));
  await installWheelListenerRecorder(page);

  await page.goto("/");
  await page.getByLabel("Choose a PDF file").setInputFiles(fixturePath);
  await expect(page.getByRole("heading", { name: "export-fixture.pdf" })).toBeVisible();
  await expect(page.getByText("Rendering PDF page...")).toBeHidden();
  await expect.poll(() => renderedCanvasHasVisibleContent(page)).toBe(true);

  const overlayBox = await page.locator(".overlay-layer").boundingBox();
  expect(overlayBox).not.toBeNull();
  if (overlayBox === null) {
    return;
  }

  await page.getByRole("button", { name: "Whiteout" }).click();
  await dragWhiteout(
    page,
    { x: overlayBox.x + 40, y: overlayBox.y + 50 },
    { x: overlayBox.x + 160, y: overlayBox.y + 98 },
  );
  const whiteout = page.getByRole("group", { name: "whiteout element" });
  await expect(whiteout).toBeVisible();
  expectBoxNear(await whiteout.boundingBox(), { x: overlayBox.x + 40, y: overlayBox.y + 50 });
  await expect.poll(() => borderWidthsFor(page, ".overlay-whiteout")).toBe("0px 0px 0px 0px");

  await page.getByRole("button", { name: "Text" }).click();
  await page.mouse.click(overlayBox.x + 130, overlayBox.y + 110);
  const textBox = page.getByLabel("Edit text element");
  await textBox.fill("Replacement");
  await textBox.press("Escape");
  const textOverlay = page.getByRole("group", { name: "text element" });
  expectBoxNear(await textOverlay.boundingBox(), { x: overlayBox.x + 130, y: overlayBox.y + 110 });

  await expect
    .poll(() => wheelListenerRecords(page))
    .toContainEqual({
      tagName: "SECTION",
      className: "editor-viewer",
      ariaLabel: null,
    });
  const pageFrameAtFullZoom = await page.locator(".pdf-page-frame").boundingBox();
  expect(pageFrameAtFullZoom).not.toBeNull();
  if (pageFrameAtFullZoom === null) {
    return;
  }
  await page.mouse.move(pageFrameAtFullZoom.x + 260, pageFrameAtFullZoom.y + 100);
  await startWheelEventRecorder(page);
  const browserScaleBeforeBoundaryZoom = await browserScaleSnapshot(page);
  await modifiedWheel(page, "out", 2);
  await expect(page.getByLabel("Zoom level")).toHaveText("50%");
  await modifiedWheel(page, "out", 3);
  await expect(page.getByLabel("Zoom level")).toHaveText("50%");
  const wheelRecordsAtMin = await wheelEventRecords(page);
  const lastWheelAtMin = wheelRecordsAtMin.at(-1);
  expect(lastWheelAtMin).toBeDefined();
  expect(lastWheelAtMin?.path).toContain("section.editor-viewer");
  expect(lastWheelAtMin?.pointerInsideEditor).toBe(true);
  expect(lastWheelAtMin?.pointerInsidePageFrame).toBe(false);
  expect(lastWheelAtMin?.editor?.width).toBeGreaterThan(0);
  expect(lastWheelAtMin?.editor?.height).toBeGreaterThan(0);
  expect(lastWheelAtMin?.pageFrame?.width).toBe(150);
  expect(lastWheelAtMin?.pageFrame?.height).toBe(200);
  await expect.poll(() => browserScaleSnapshot(page)).toEqual(browserScaleBeforeBoundaryZoom);

  await modifiedWheel(page, "in", 10);
  await expect(page.getByLabel("Zoom level")).toHaveText("300%");
  const browserScaleBeforeMaxBoundaryZoom = await browserScaleSnapshot(page);
  await modifiedWheel(page, "in", 2);
  await expect(page.getByLabel("Zoom level")).toHaveText("300%");
  await expect.poll(() => browserScaleSnapshot(page)).toEqual(browserScaleBeforeMaxBoundaryZoom);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("export-fixture-edited.pdf");
  const downloadedPath = testInfo.outputPath("export-fixture-edited.pdf");
  await download.saveAs(downloadedPath);
  const downloadedBytes = await import("node:fs/promises").then((fs) =>
    fs.readFile(downloadedPath),
  );
  const exported = await PDFDocument.load(downloadedBytes);
  expect(exported.getPageCount()).toBe(1);
  expect(exported.getPage(0).getWidth()).toBe(300);
  expect(exported.getPage(0).getHeight()).toBe(400);
  await expect(
    page.getByText("Downloaded export-fixture-edited.pdf. The editor remains open."),
  ).toBeVisible();

  await page.goto("/");
  await page.getByLabel("Choose a PDF file").setInputFiles(downloadedPath);
  await expect(page.getByRole("heading", { name: "export-fixture-edited.pdf" })).toBeVisible();
  await expect
    .poll(() => canvasRegionIsMostlyWhite(page, { x: 130, y: 84, width: 20, height: 10 }))
    .toBe(true);
});

test("selects text with one click and edits text only through explicit edit actions", async ({
  page,
}, testInfo) => {
  const fixturePath = testInfo.outputPath("text-interaction-fixture.pdf");
  const fixtureBytes = await createPdf();
  await import("node:fs/promises").then((fs) => fs.writeFile(fixturePath, fixtureBytes));

  await page.goto("/");
  await page.getByLabel("Choose a PDF file").setInputFiles(fixturePath);
  await expect(page.getByRole("heading", { name: "text-interaction-fixture.pdf" })).toBeVisible();
  await expect(page.getByText("Rendering PDF page...")).toBeHidden();
  await expect.poll(() => renderedCanvasHasVisibleContent(page)).toBe(true);

  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.locator(".viewer-main").evaluate((workspace) => {
    workspace.scrollTop = 180;
  });
  await expect(page.getByRole("button", { name: "Download" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  await page.getByRole("button", { name: "Reset zoom" }).click();

  const overlayBox = await page.locator(".overlay-layer").boundingBox();
  expect(overlayBox).not.toBeNull();
  if (overlayBox === null) {
    return;
  }

  await page.getByRole("button", { name: "Text" }).click();
  await page.mouse.click(overlayBox.x + 80, overlayBox.y + 130);
  const initialEditor = page.getByLabel("Edit text element");
  await expect(initialEditor).toBeFocused();
  await initialEditor.fill("Click selectable text");
  await initialEditor.press("Escape");
  await expect(page.getByLabel("Edit text element")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Select" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.mouse.click(overlayBox.x + 22, overlayBox.y + 22);
  await expect(page.getByRole("group", { name: "text element" })).toHaveCount(1);

  const firstTextContent = page.getByLabel("Text element content");
  const firstTextBox = await firstTextContent.boundingBox();
  expect(firstTextBox).not.toBeNull();
  if (firstTextBox === null) {
    return;
  }
  await page.mouse.click(
    firstTextBox.x + firstTextBox.width / 2,
    firstTextBox.y + firstTextBox.height / 2,
  );
  await expect(page.getByRole("button", { name: "Duplicate" })).toBeVisible();
  await expect(page.getByLabel("Edit text element")).toHaveCount(0);
  await page.mouse.click(overlayBox.x + 20, overlayBox.y + 20);
  await expect(page.getByRole("button", { name: "Duplicate" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "text element" })).toHaveCount(1);
  await page.mouse.click(
    firstTextBox.x + firstTextBox.width / 2,
    firstTextBox.y + firstTextBox.height / 2,
  );
  await expect(page.getByRole("button", { name: "Duplicate" })).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("group", { name: "text element" })).toHaveCount(0);

  await page.getByRole("button", { name: "Text" }).click();
  await page.mouse.click(overlayBox.x + 90, overlayBox.y + 180);
  const secondEditor = page.getByLabel("Edit text element");
  await secondEditor.fill("Draft text");
  await secondEditor.press("Escape");
  await page.getByRole("group", { name: "text element" }).focus();
  await page.keyboard.press("Enter");
  const reopenedEditor = page.getByLabel("Edit text element");
  await reopenedEditor.fill("Edited text");
  await reopenedEditor.press("Escape");
  await expect(page.getByText("Edited text")).toBeVisible();
  await expect(page.getByRole("button", { name: "Duplicate" })).toBeVisible();

  const selectedText = page.getByRole("group", { name: "text element" });
  const beforeResize = await selectedText.boundingBox();
  expect(beforeResize).not.toBeNull();
  if (beforeResize === null) {
    return;
  }
  const beforeFontSize = await page
    .getByLabel("Text element content")
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  const resizeHandle = page.getByLabel("Resize text element");
  const handleBox = await resizeHandle.boundingBox();
  expect(handleBox).not.toBeNull();
  if (handleBox === null) {
    return;
  }
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 + 80,
    handleBox.y + handleBox.height / 2 + 48,
  );
  await page.mouse.up();
  const resizedText = await selectedText.boundingBox();
  expect(resizedText).not.toBeNull();
  if (resizedText === null) {
    return;
  }
  const resizedFontSize = await page
    .getByLabel("Text element content")
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(resizedText.width).toBeGreaterThan(beforeResize.width + 20);
  expect(resizedFontSize).toBeGreaterThan(beforeFontSize + 2);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect
    .poll(async () => (await selectedText.boundingBox())?.width ?? 0)
    .toBeLessThan(resizedText.width - 10);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect
    .poll(async () => (await selectedText.boundingBox())?.width ?? 0)
    .toBeGreaterThan(beforeResize.width + 20);

  const resizedDownloadPath = testInfo.outputPath("text-interaction-fixture-edited.pdf");
  await downloadEditedPdf(page, "text-interaction-fixture-edited.pdf", resizedDownloadPath);
  await page.goto("/");
  await page.getByLabel("Choose a PDF file").setInputFiles(resizedDownloadPath);
  await expect(
    page.getByRole("heading", { name: "text-interaction-fixture-edited.pdf" }),
  ).toBeVisible();
  await expect(page.getByText("Rendering PDF page...")).toBeHidden();
  await expect.poll(() => renderedCanvasHasVisibleContent(page)).toBe(true);
});
test("undoes and redoes overlay add/delete history and exports the final state", async ({
  page,
}, testInfo) => {
  const fixturePath = testInfo.outputPath("history-fixture.pdf");
  const fixtureBytes = await createPdf();
  await import("node:fs/promises").then((fs) => fs.writeFile(fixturePath, fixtureBytes));

  await page.goto("/");
  await page.getByLabel("Choose a PDF file").setInputFiles(fixturePath);
  await expect(page.getByRole("heading", { name: "history-fixture.pdf" })).toBeVisible();
  await expect(page.getByText("Rendering PDF page...")).toBeHidden();
  await expect.poll(() => renderedCanvasHasVisibleContent(page)).toBe(true);

  const overlayBox = await page.locator(".overlay-layer").boundingBox();
  expect(overlayBox).not.toBeNull();
  if (overlayBox === null) {
    return;
  }

  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Redo" })).toBeDisabled();

  await page.getByRole("button", { name: "Text" }).click();
  await page.mouse.click(overlayBox.x + 170, overlayBox.y + 220);
  const firstText = page.getByLabel("Edit text element");
  await firstText.press("Escape");
  await expect(page.getByLabel("Edit text element")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("group", { name: "text element" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Redo" })).toBeEnabled();

  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByLabel("Text element content")).toHaveText("Text");

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("group", { name: "text element" })).toHaveCount(0);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("Text element content")).toHaveText("Text");

  await page.keyboard.press("Control+Y");
  await expect(page.getByRole("group", { name: "text element" })).toHaveCount(0);

  await page.getByRole("button", { name: "Whiteout" }).click();
  await dragWhiteout(
    page,
    { x: overlayBox.x + 40, y: overlayBox.y + 50 },
    { x: overlayBox.x + 160, y: overlayBox.y + 98 },
  );
  await expect(page.getByRole("group", { name: "whiteout element" })).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("group", { name: "whiteout element" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Redo" })).toBeEnabled();

  await page.getByRole("button", { name: "Text" }).click();
  await page.mouse.click(overlayBox.x + 170, overlayBox.y + 220);
  const finalText = page.getByLabel("Edit text element");
  await finalText.fill("Final state");
  await finalText.press("Escape");
  await expect(page.getByRole("button", { name: "Redo" })).toBeDisabled();

  const downloadedPath = testInfo.outputPath("history-fixture-edited.pdf");
  await downloadEditedPdf(page, "history-fixture-edited.pdf", downloadedPath);
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();

  await page.goto("/");
  await page.getByLabel("Choose a PDF file").setInputFiles(downloadedPath);
  await expect(page.getByRole("heading", { name: "history-fixture-edited.pdf" })).toBeVisible();
  await expect
    .poll(() => canvasRegionHasDarkContent(page, { x: 170, y: 220, width: 100, height: 40 }))
    .toBe(true);
  await expect
    .poll(() => canvasRegionIsMostlyWhite(page, { x: 40, y: 50, width: 120, height: 48 }))
    .toBe(false);
});
test("deletes every selected overlay type and excludes deleted overlays from export", async ({
  page,
}, testInfo) => {
  const fixturePath = testInfo.outputPath("delete-overlays-fixture.pdf");
  const fixtureBytes = await createPdf();
  await import("node:fs/promises").then((fs) => fs.writeFile(fixturePath, fixtureBytes));

  await page.goto("/");
  await page.getByLabel("Choose a PDF file").setInputFiles(fixturePath);
  await expect(page.getByRole("heading", { name: "delete-overlays-fixture.pdf" })).toBeVisible();
  await expect(page.getByText("Rendering PDF page...")).toBeHidden();
  await expect.poll(() => renderedCanvasHasVisibleContent(page)).toBe(true);

  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.locator(".viewer-main").evaluate((workspace) => {
    workspace.scrollTop = 180;
  });
  await expect(page.getByRole("button", { name: "Download" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  await page.getByRole("button", { name: "Reset zoom" }).click();

  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.locator(".viewer-main").evaluate((workspace) => {
    workspace.scrollTop = 180;
  });
  await expect(page.getByRole("button", { name: "Download" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  await page.getByRole("button", { name: "Reset zoom" }).click();

  const overlayBox = await page.locator(".overlay-layer").boundingBox();
  expect(overlayBox).not.toBeNull();
  if (overlayBox === null) {
    return;
  }

  await page.getByRole("button", { name: "Text" }).click();
  await page.mouse.click(overlayBox.x + 45, overlayBox.y + 120);
  const textToDelete = page.getByLabel("Edit text element");
  await textToDelete.fill("Delete me");
  await textToDelete.press("Escape");
  await expect(page.getByRole("button", { name: "Duplicate" })).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("group", { name: "text element" })).toHaveCount(0);

  await page.getByRole("button", { name: "Whiteout" }).click();
  await dragWhiteout(
    page,
    { x: overlayBox.x + 40, y: overlayBox.y + 50 },
    { x: overlayBox.x + 160, y: overlayBox.y + 98 },
  );
  await expect(page.getByRole("group", { name: "whiteout element" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Duplicate" })).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("group", { name: "whiteout element" })).toHaveCount(0);

  await addTypedSignature(page, "Delete Me");
  await expect(page.getByRole("button", { name: "Duplicate" })).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("group", { name: "signature element" })).toHaveCount(0);

  await addTypedInitials(page, "DM");
  await expect(page.getByRole("button", { name: "Duplicate" })).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("group", { name: "initials element" })).toHaveCount(0);

  const downloadedPath = testInfo.outputPath("delete-overlays-fixture-edited.pdf");
  await downloadEditedPdf(page, "delete-overlays-fixture-edited.pdf", downloadedPath);

  await page.goto("/");
  await page.getByLabel("Choose a PDF file").setInputFiles(downloadedPath);
  await expect(
    page.getByRole("heading", { name: "delete-overlays-fixture-edited.pdf" }),
  ).toBeVisible();
  await expect
    .poll(() => canvasRegionHasDarkContent(page, { x: 40, y: 50, width: 120, height: 48 }))
    .toBe(true);
  await expect
    .poll(() => canvasRegionHasDarkContent(page, { x: 45, y: 120, width: 120, height: 48 }))
    .toBe(false);
  await expect
    .poll(() => canvasRegionHasDarkContent(page, { x: 56, y: 180, width: 96, height: 52 }))
    .toBe(false);
  await expect
    .poll(() => canvasRegionHasDarkContent(page, { x: 56, y: 250, width: 220, height: 70 }))
    .toBe(false);
});
test("places annotation overlays, reuses shared history, and exports visible symbols", async ({
  page,
}, testInfo) => {
  const fixturePath = testInfo.outputPath("annotation-fixture.pdf");
  await import("node:fs/promises").then(async (fs) => fs.writeFile(fixturePath, await createPdf()));
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "http:" || url.protocol === "https:") {
      if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
        externalRequests.push(request.url());
      }
    }
  });

  await page.goto("/");
  await page.getByLabel("Choose a PDF file").setInputFiles(fixturePath);
  await expect(page.getByRole("heading", { name: "annotation-fixture.pdf" })).toBeVisible();
  await expect(page.getByText("Rendering PDF page...")).toBeHidden();
  await expect.poll(() => renderedCanvasHasVisibleContent(page)).toBe(true);

  const overlayBox = await page.locator(".overlay-layer").boundingBox();
  expect(overlayBox).not.toBeNull();
  if (overlayBox === null) {
    return;
  }

  await page.getByRole("button", { name: "Checkmark" }).click();
  await expect(page.getByRole("button", { name: /Checkmark/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.mouse.click(overlayBox.x + 80, overlayBox.y + 160);
  await expect(page.getByRole("button", { name: "Select" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const checkmark = page.getByRole("group", { name: "checkmark element" }).first();
  await expect(checkmark).toBeVisible();
  const checkmarkStart = await checkmark.boundingBox();
  expect(checkmarkStart).not.toBeNull();
  if (checkmarkStart === null) {
    return;
  }

  await page.mouse.move(
    checkmarkStart.x + checkmarkStart.width / 2,
    checkmarkStart.y + checkmarkStart.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    checkmarkStart.x + checkmarkStart.width / 2 + 40,
    checkmarkStart.y + checkmarkStart.height / 2 + 20,
  );
  await page.mouse.up();
  const checkmarkMoved = await checkmark.boundingBox();
  expect(checkmarkMoved).not.toBeNull();
  if (checkmarkMoved === null) {
    return;
  }
  expect(checkmarkMoved.x).toBeGreaterThan(checkmarkStart.x + 30);

  const checkmarkHandle = page.getByLabel("Resize checkmark element");
  const checkmarkHandleBox = await checkmarkHandle.boundingBox();
  expect(checkmarkHandleBox).not.toBeNull();
  if (checkmarkHandleBox === null) {
    return;
  }
  await page.mouse.move(
    checkmarkHandleBox.x + checkmarkHandleBox.width / 2,
    checkmarkHandleBox.y + checkmarkHandleBox.height / 2,
  );
  await page.mouse.down();
  const checkmarkResizeBoxes: { width: number; height: number }[] = [];
  for (const delta of [6, 12, 18, 24, 28]) {
    await page.mouse.move(
      checkmarkHandleBox.x + checkmarkHandleBox.width / 2 + delta,
      checkmarkHandleBox.y + checkmarkHandleBox.height / 2 + delta,
    );
    await page.waitForTimeout(16);
    const box = await checkmark.boundingBox();
    if (box !== null) {
      checkmarkResizeBoxes.push({ width: box.width, height: box.height });
    }
    await expect(checkmark).toBeVisible();
  }
  await page.mouse.up();
  expect(checkmarkResizeBoxes.length).toBeGreaterThan(2);
  for (let index = 1; index < checkmarkResizeBoxes.length; index += 1) {
    const previousBox = checkmarkResizeBoxes[index - 1];
    const currentBox = checkmarkResizeBoxes[index];
    expect(previousBox).toBeDefined();
    expect(currentBox).toBeDefined();
    if (previousBox === undefined || currentBox === undefined) {
      return;
    }
    expect(currentBox.width).toBeGreaterThanOrEqual(previousBox.width - 1);
    expect(currentBox.height).toBeGreaterThanOrEqual(previousBox.height - 1);
    expect(Math.abs(currentBox.width - currentBox.height)).toBeLessThanOrEqual(2);
  }
  const checkmarkResized = await checkmark.boundingBox();
  expect(checkmarkResized).not.toBeNull();
  if (checkmarkResized === null) {
    return;
  }
  expect(checkmarkResized.width).toBeGreaterThan(checkmarkMoved.width + 10);

  await page.getByRole("button", { name: "Undo" }).click();
  const checkmarkUndoResize = await checkmark.boundingBox();
  expect(checkmarkUndoResize).not.toBeNull();
  if (checkmarkUndoResize === null) {
    return;
  }
  expect(Math.abs(checkmarkUndoResize.width - checkmarkMoved.width)).toBeLessThanOrEqual(2);
  await page.getByRole("button", { name: "Redo" }).click();
  const checkmarkRedoResize = await checkmark.boundingBox();
  expect(checkmarkRedoResize).not.toBeNull();
  if (checkmarkRedoResize === null) {
    return;
  }
  expect(Math.abs(checkmarkRedoResize.width - checkmarkResized.width)).toBeLessThanOrEqual(2);

  await page.keyboard.press("Control+C");
  await page.keyboard.press("Control+V");
  await expect(page.getByRole("group", { name: "checkmark element" })).toHaveCount(2);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("group", { name: "checkmark element" })).toHaveCount(1);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByRole("group", { name: "checkmark element" })).toHaveCount(2);

  await page.getByRole("button", { name: "Cross" }).click();
  await page.mouse.click(overlayBox.x + 180, overlayBox.y + 140);
  const cross = page.getByRole("group", { name: "cross element" });
  await expect(cross).toBeVisible();
  const crossBeforeResize = await cross.boundingBox();
  expect(crossBeforeResize).not.toBeNull();
  if (crossBeforeResize === null) {
    return;
  }
  const crossHandleBox = await page.getByLabel("Resize cross element").boundingBox();
  expect(crossHandleBox).not.toBeNull();
  if (crossHandleBox === null) {
    return;
  }
  await page.mouse.move(
    crossHandleBox.x + crossHandleBox.width / 2,
    crossHandleBox.y + crossHandleBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    crossHandleBox.x + crossHandleBox.width / 2 + 20,
    crossHandleBox.y + crossHandleBox.height / 2 + 20,
  );
  await page.mouse.up();
  const crossAfterResize = await cross.boundingBox();
  expect(crossAfterResize).not.toBeNull();
  if (crossAfterResize === null) {
    return;
  }
  expect(crossAfterResize.width).toBeGreaterThan(crossBeforeResize.width + 8);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect
    .poll(async () => (await cross.boundingBox())?.width ?? 0)
    .toBeLessThan(crossAfterResize.width - 6);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect
    .poll(async () => (await cross.boundingBox())?.width ?? 0)
    .toBeGreaterThan(crossBeforeResize.width + 8);
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(cross).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(cross).toBeVisible();

  await page.getByRole("button", { name: "Date" }).click();
  await page.mouse.click(overlayBox.x + 80, overlayBox.y + 240);
  const date = page.getByRole("group", { name: "date element" });
  await expect(date).toBeVisible();
  await expect(date).toHaveText(/\d{2}\/\d{2}\/\d{4}/);
  const dateHandle = page.getByLabel("Resize date element");
  const dateHandleBox = await dateHandle.boundingBox();
  expect(dateHandleBox).not.toBeNull();
  if (dateHandleBox === null) {
    return;
  }
  const dateBeforeResize = await date.boundingBox();
  expect(dateBeforeResize).not.toBeNull();
  if (dateBeforeResize === null) {
    return;
  }
  const dateFontBeforeResize = await page
    .getByLabel("Text element content")
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  await page.mouse.move(
    dateHandleBox.x + dateHandleBox.width / 2,
    dateHandleBox.y + dateHandleBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    dateHandleBox.x + dateHandleBox.width / 2 + 100,
    dateHandleBox.y + dateHandleBox.height / 2 + 40,
  );
  await page.mouse.up();
  const dateAfterResize = await date.boundingBox();
  expect(dateAfterResize).not.toBeNull();
  if (dateAfterResize === null) {
    return;
  }
  expect(dateAfterResize.width).toBeGreaterThan(dateBeforeResize.width + 20);
  await expect
    .poll(() =>
      page
        .getByLabel("Text element content")
        .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
    )
    .toBeGreaterThan(dateFontBeforeResize + 2);
  const dateFontAfterResize = await page
    .getByLabel("Text element content")
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));

  await page.getByRole("button", { name: "Undo" }).click();
  await expect
    .poll(async () => (await date.boundingBox())?.width ?? 0)
    .toBeLessThan(dateAfterResize.width - 10);
  await expect
    .poll(() =>
      page
        .getByLabel("Text element content")
        .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
    )
    .toBeLessThan(dateFontAfterResize - 1);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect
    .poll(async () => (await date.boundingBox())?.width ?? 0)
    .toBeGreaterThan(dateBeforeResize.width + 20);
  await expect
    .poll(() =>
      page
        .getByLabel("Text element content")
        .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
    )
    .toBeGreaterThan(dateFontBeforeResize + 2);

  const downloadedPath = testInfo.outputPath("annotation-fixture-edited.pdf");
  await downloadEditedPdf(page, "annotation-fixture-edited.pdf", downloadedPath);

  await page.goto("/");
  await page.getByLabel("Choose a PDF file").setInputFiles(downloadedPath);
  await expect(page.getByRole("heading", { name: "annotation-fixture-edited.pdf" })).toBeVisible();
  await expect(page.getByText("Rendering PDF page...")).toBeHidden();
  await expect.poll(() => renderedCanvasHasVisibleContent(page)).toBe(true);
  await expect
    .poll(() => canvasRegionHasNonWhiteContent(page, { x: 100, y: 160, width: 90, height: 90 }))
    .toBe(true);
  await expect
    .poll(() => canvasRegionHasNonWhiteContent(page, { x: 160, y: 120, width: 70, height: 70 }))
    .toBe(true);
  await expect
    .poll(() => canvasRegionHasNonWhiteContent(page, { x: 80, y: 235, width: 160, height: 60 }))
    .toBe(true);
  expect(externalRequests).toEqual([]);
});
test("inserts, edits, copies, pastes, exports, and reopens an image overlay", async ({
  page,
}, testInfo) => {
  const fixturePath = testInfo.outputPath("image-fixture.pdf");
  await import("node:fs/promises").then(async (fs) => fs.writeFile(fixturePath, await createPdf()));
  const imagePath = testInfo.outputPath("quickpdf-image.png");
  const blackPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR42mNkAAAAAAUAAY27m/MAAAAASUVORK5CYII=",
    "base64",
  );
  await import("node:fs/promises").then((fs) => fs.writeFile(imagePath, blackPng));

  await page.goto("/");
  await page.getByLabel("Choose a PDF file").setInputFiles(fixturePath);
  await expect(page.getByRole("heading", { name: "image-fixture.pdf" })).toBeVisible();
  await expect.poll(() => renderedCanvasHasVisibleContent(page)).toBe(true);

  await expect(page.getByRole("button", { name: "Image" })).toHaveCount(1);
  await expect(page.locator('input[aria-label="Choose image"]')).toBeHidden();
  await expect(page.getByText(/Choose File|No file chosen/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Image" }).click();
  await page.locator('input[aria-label="Choose image"]').setInputFiles(imagePath);
  await expect(page.getByText("Click the PDF page to place the image.")).toBeVisible();
  const overlayBox = await page.locator(".overlay-layer").boundingBox();
  expect(overlayBox).not.toBeNull();
  if (overlayBox === null) {
    return;
  }
  await page.mouse.click(overlayBox.x + 140, overlayBox.y + 160);
  const image = page.getByRole("group", { name: "image element" }).first();
  await expect(image).toBeVisible();
  await expect(page.getByRole("button", { name: "Duplicate" })).toBeVisible();
  const renderedImage = image.locator("img");
  const placedSelectionBox = await image.boundingBox();
  const placedImageBox = await renderedImage.boundingBox();
  expect(placedSelectionBox).not.toBeNull();
  expect(placedImageBox).not.toBeNull();
  if (placedSelectionBox === null || placedImageBox === null) {
    return;
  }
  expect(Math.abs(placedSelectionBox.x - placedImageBox.x)).toBeLessThan(1);
  expect(Math.abs(placedSelectionBox.y - placedImageBox.y)).toBeLessThan(1);
  expect(Math.abs(placedSelectionBox.width - placedImageBox.width)).toBeLessThan(1);
  expect(Math.abs(placedSelectionBox.height - placedImageBox.height)).toBeLessThan(1);

  const initialBox = await image.boundingBox();
  expect(initialBox).not.toBeNull();
  if (initialBox === null) {
    return;
  }
  const resizeHandle = page.getByLabel("Resize image element");
  const movedBox = initialBox;
  const imageSourceBeforeResize = await renderedImage.getAttribute("src");
  const intermediateBoxes: { width: number; height: number }[] = [];
  await resizeHandle.hover();
  await page.mouse.down();
  for (const delta of [4, 7, 10, 13, 16, 18]) {
    await page.mouse.move(
      movedBox.x + movedBox.width + delta,
      movedBox.y + movedBox.height + delta,
    );
    await page.waitForTimeout(20);
    const intermediateBox = await image.boundingBox();
    expect(intermediateBox).not.toBeNull();
    if (intermediateBox !== null) {
      intermediateBoxes.push({ width: intermediateBox.width, height: intermediateBox.height });
    }
    await expect(renderedImage).toBeVisible();
  }
  await page.mouse.up();
  expect(await renderedImage.getAttribute("src")).toBe(imageSourceBeforeResize);
  expect(intermediateBoxes.length).toBeGreaterThan(2);
  for (let index = 1; index < intermediateBoxes.length; index += 1) {
    const previousBox = intermediateBoxes[index - 1];
    const currentBox = intermediateBoxes[index];
    expect(previousBox).toBeDefined();
    expect(currentBox).toBeDefined();
    if (previousBox === undefined || currentBox === undefined) {
      return;
    }
    expect(currentBox.width).toBeGreaterThanOrEqual(previousBox.width - 1);
    expect(currentBox.height).toBeGreaterThanOrEqual(previousBox.height - 1);
  }
  const resizedSelectionBox = await image.boundingBox();
  const resizedImageBox = await renderedImage.boundingBox();
  expect(resizedSelectionBox).not.toBeNull();
  expect(resizedImageBox).not.toBeNull();
  if (resizedSelectionBox === null || resizedImageBox === null) {
    return;
  }
  expect(resizedSelectionBox.width).toBeGreaterThan(movedBox.width);
  expect(Math.abs(resizedSelectionBox.width - resizedImageBox.width)).toBeLessThan(1);
  expect(Math.abs(resizedSelectionBox.height - resizedImageBox.height)).toBeLessThan(1);

  await page.getByRole("button", { name: "Undo" }).click();
  const undoneResizeBox = await image.boundingBox();
  expect(undoneResizeBox).not.toBeNull();
  if (undoneResizeBox === null) {
    return;
  }
  expect(Math.abs(undoneResizeBox.width - movedBox.width)).toBeLessThan(1);
  await page.getByRole("button", { name: "Redo" }).click();
  const redoneResizeBox = await image.boundingBox();
  expect(redoneResizeBox).not.toBeNull();
  if (redoneResizeBox === null) {
    return;
  }
  expect(Math.abs(redoneResizeBox.width - resizedSelectionBox.width)).toBeLessThan(1);

  await page.keyboard.press("Control+C");
  await page.keyboard.press("Control+V");
  await expect(page.getByRole("group", { name: "image element" })).toHaveCount(2);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("group", { name: "image element" })).toHaveCount(1);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByRole("group", { name: "image element" })).toHaveCount(2);

  const downloadedPath = testInfo.outputPath("image-fixture-edited.pdf");
  await downloadEditedPdf(page, "image-fixture-edited.pdf", downloadedPath);

  await page.goto("/");
  await page.getByLabel("Choose a PDF file").setInputFiles(downloadedPath);
  await expect(page.getByRole("heading", { name: "image-fixture-edited.pdf" })).toBeVisible();
  await expect.poll(() => renderedCanvasHasVisibleContent(page)).toBe(true);
});
test("draws, resizes, exports, and reopens a signature", async ({ page }, testInfo) => {
  const fixturePath = testInfo.outputPath("draw-signature-fixture.pdf");
  const fixtureBytes = await createPdf();
  await import("node:fs/promises").then((fs) => fs.writeFile(fixturePath, fixtureBytes));

  await page.goto("/");
  await page.getByLabel("Choose a PDF file").setInputFiles(fixturePath);
  await expect(page.getByRole("heading", { name: "draw-signature-fixture.pdf" })).toBeVisible();
  await expect(page.getByText("Rendering PDF page...")).toBeHidden();
  await addDrawnSignature(page);

  const signature = page.getByRole("group", { name: "signature element" });
  await page.getByLabel("Selected element width").fill("260");
  const resizedBox = await signature.boundingBox();
  expect(resizedBox?.width).toBeGreaterThan(220);

  const downloadedPath = testInfo.outputPath("draw-signature-fixture-edited.pdf");
  await downloadEditedPdf(page, "draw-signature-fixture-edited.pdf", downloadedPath);

  await page.goto("/");
  await page.getByLabel("Choose a PDF file").setInputFiles(downloadedPath);
  await expect(
    page.getByRole("heading", { name: "draw-signature-fixture-edited.pdf" }),
  ).toBeVisible();
  await expect
    .poll(() => canvasRegionHasDarkContent(page, { x: 56, y: 250, width: 240, height: 90 }))
    .toBe(true);
});

test("types, exports, and reopens a signature", async ({ page }, testInfo) => {
  const fixturePath = testInfo.outputPath("typed-signature-fixture.pdf");
  const fixtureBytes = await createPdf();
  await import("node:fs/promises").then((fs) => fs.writeFile(fixturePath, fixtureBytes));

  await page.goto("/");
  await page.getByLabel("Choose a PDF file").setInputFiles(fixturePath);
  await expect(page.getByRole("heading", { name: "typed-signature-fixture.pdf" })).toBeVisible();
  await expect(page.getByText("Rendering PDF page...")).toBeHidden();
  await addTypedSignature(page, "Ada Lovelace");

  const downloadedPath = testInfo.outputPath("typed-signature-fixture-edited.pdf");
  await downloadEditedPdf(page, "typed-signature-fixture-edited.pdf", downloadedPath);

  await page.goto("/");
  await page.getByLabel("Choose a PDF file").setInputFiles(downloadedPath);
  await expect(
    page.getByRole("heading", { name: "typed-signature-fixture-edited.pdf" }),
  ).toBeVisible();
  await expect
    .poll(() => canvasRegionHasDarkContent(page, { x: 56, y: 250, width: 220, height: 70 }))
    .toBe(true);
});
