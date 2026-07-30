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
  await page.getByLabel(/open a local pdf/i).setInputFiles(fixturePath);
  await expect(page.getByRole("heading", { name: "export-fixture.pdf" })).toBeVisible();
  await expect(page.getByText("Rendering PDF page...")).toBeHidden();
  await expect.poll(() => renderedCanvasHasVisibleContent(page)).toBe(true);

  const overlayBox = await page.locator(".overlay-layer").boundingBox();
  expect(overlayBox).not.toBeNull();
  if (overlayBox === null) {
    return;
  }

  await page.getByRole("button", { name: "Whiteout" }).click();
  await page.mouse.click(overlayBox.x + 40, overlayBox.y + 50);
  const whiteout = page.getByRole("group", { name: "whiteout element" });
  await expect(whiteout).toBeVisible();
  expectBoxNear(await whiteout.boundingBox(), { x: overlayBox.x + 40, y: overlayBox.y + 50 });

  await page.getByRole("button", { name: "Text" }).click();
  await page.mouse.click(overlayBox.x + 45, overlayBox.y + 55);
  const textBox = page.getByLabel("Edit text element");
  await textBox.fill("Replacement");
  const textOverlay = page.getByRole("group", { name: "text element" });
  expectBoxNear(await textOverlay.boundingBox(), { x: overlayBox.x + 45, y: overlayBox.y + 55 });

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
  await page.getByLabel(/open a local pdf/i).setInputFiles(downloadedPath);
  await expect(page.getByRole("heading", { name: "export-fixture-edited.pdf" })).toBeVisible();
  await expect
    .poll(() => canvasRegionIsMostlyWhite(page, { x: 130, y: 84, width: 20, height: 10 }))
    .toBe(true);
});
