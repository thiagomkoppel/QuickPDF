import { describe, expect, it } from "vitest";

import type { SignatureImageInput } from "../../application/editor-application";
import {
  createCanvasSignatureBackgroundRemover,
  type SignatureCanvas,
  type SignatureCanvasImage,
} from "./canvas-signature-background-remover";

interface FakeCanvasRecord {
  readonly canvas: SignatureCanvas;
  readonly drawn: { readonly width: number; readonly height: number }[];
  readonly put: { width: number; height: number; data: Uint8ClampedArray }[];
}

const paper = [205, 203, 200, 255] as const;
const ink = [24, 22, 28, 255] as const;

/** Grey paper with an ink block between rows 12 and 17, columns 8 and 31. */
const photographedPixels = (width: number, height: number): Uint8ClampedArray => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = y >= 12 && y <= 17 && x >= 8 && x <= 31 ? ink : paper;
      data.set(source, (y * width + x) * 4);
    }
  }
  return data;
};

const createFakeCanvases = (
  pixels: (width: number, height: number) => Uint8ClampedArray,
): {
  readonly createCanvas: (width: number, height: number) => SignatureCanvas;
  readonly records: FakeCanvasRecord[];
} => {
  const records: FakeCanvasRecord[] = [];
  const createCanvas = (width: number, height: number): SignatureCanvas => {
    const drawn: { width: number; height: number }[] = [];
    const put: { width: number; height: number; data: Uint8ClampedArray }[] = [];
    const canvas: SignatureCanvas = {
      width,
      height,
      getContext: () => ({
        drawImage: (_source, _dx, _dy, drawWidth, drawHeight) => {
          drawn.push({ width: drawWidth, height: drawHeight });
        },
        getImageData: (_sx, _sy, readWidth, readHeight) => ({
          width: readWidth,
          height: readHeight,
          data: pixels(readWidth, readHeight),
        }),
        createImageData: (createWidth, createHeight) => ({
          width: createWidth,
          height: createHeight,
          data: new Uint8ClampedArray(createWidth * createHeight * 4),
        }),
        putImageData: (imageData) => {
          put.push(imageData);
        },
      }),
      toDataURL: () =>
        `data:image/png;base64,canvas-${String(canvas.width)}x${String(canvas.height)}`,
    };
    records.push({ canvas, drawn, put });
    return canvas;
  };
  return { createCanvas, records };
};

const loadImageStub = (width: number, height: number) => (): Promise<SignatureCanvasImage> =>
  Promise.resolve({ width, height, source: {} as CanvasImageSource });

const uploaded: SignatureImageInput = {
  dataUrl: "data:image/jpeg;base64,original",
  mimeType: "image/jpeg",
  width: 40,
  height: 30,
  source: "upload",
};

describe("createCanvasSignatureBackgroundRemover", () => {
  it("returns a cropped transparent PNG for a photographed signature", async () => {
    const { createCanvas } = createFakeCanvases(photographedPixels);
    const remover = createCanvasSignatureBackgroundRemover({
      createCanvas,
      loadImage: loadImageStub(40, 30),
      removal: { padding: 0 },
    });

    const outcome = await remover.remove(uploaded);

    expect(outcome.status).toBe("removed");
    if (outcome.status === "failed") {
      throw new Error("expected a processed image");
    }
    expect(outcome.image.mimeType).toBe("image/png");
    expect(outcome.image.width).toBe(24);
    expect(outcome.image.height).toBe(6);
    expect(outcome.image.source).toBe("upload");
    expect(outcome.image.dataUrl).toBe("data:image/png;base64,canvas-24x6");
  });

  it("keeps the original image when no background can be separated", async () => {
    const flat = (width: number, height: number): Uint8ClampedArray => {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let index = 0; index < width * height; index += 1) {
        data.set(paper, index * 4);
      }
      return data;
    };
    const { createCanvas } = createFakeCanvases(flat);
    const remover = createCanvasSignatureBackgroundRemover({
      createCanvas,
      loadImage: loadImageStub(40, 30),
    });

    const outcome = await remover.remove(uploaded);

    expect(outcome.status).toBe("unchanged");
    if (outcome.status === "failed") {
      throw new Error("expected the original image");
    }
    expect(outcome.image).toEqual(uploaded);
  });

  it("downscales oversized photographs before separating the ink", async () => {
    const { createCanvas, records } = createFakeCanvases(photographedPixels);
    const remover = createCanvasSignatureBackgroundRemover({
      createCanvas,
      loadImage: loadImageStub(4000, 3000),
      maxDimension: 400,
      removal: { padding: 0 },
    });

    await remover.remove(uploaded);

    expect(records[0]?.canvas.width).toBe(400);
    expect(records[0]?.canvas.height).toBe(300);
    expect(records[0]?.drawn).toEqual([{ width: 400, height: 300 }]);
  });

  it("reports a typed error when the image cannot be decoded", async () => {
    const { createCanvas } = createFakeCanvases(photographedPixels);
    const remover = createCanvasSignatureBackgroundRemover({
      createCanvas,
      loadImage: () => Promise.reject(new Error("decode failed")),
    });

    const outcome = await remover.remove(uploaded);

    expect(outcome).toEqual({
      status: "failed",
      error: {
        code: "SignatureBackgroundRemovalFailed",
        message: "The signature background could not be removed. The original image was kept.",
      },
    });
  });

  it("reports a typed error when no 2D canvas context is available", async () => {
    const remover = createCanvasSignatureBackgroundRemover({
      createCanvas: (width, height) => ({
        width,
        height,
        getContext: () => null,
        toDataURL: () => "",
      }),
      loadImage: loadImageStub(40, 30),
    });

    const outcome = await remover.remove(uploaded);

    expect(outcome.status).toBe("failed");
  });

  it("writes the separated pixels onto a canvas sized to the crop", async () => {
    const { createCanvas, records } = createFakeCanvases(photographedPixels);
    const remover = createCanvasSignatureBackgroundRemover({
      createCanvas,
      loadImage: loadImageStub(40, 30),
      removal: { padding: 0 },
    });

    await remover.remove(uploaded);

    expect(records).toHaveLength(2);
    expect(records[1]?.canvas.width).toBe(24);
    expect(records[1]?.put).toHaveLength(1);
    expect(records[1]?.put[0]?.data).toHaveLength(24 * 6 * 4);
  });
});
