import { describe, expect, it } from "vitest";

import { removeSignatureBackground, type RgbaImageData } from "./signature-background-removal";

interface TestPixel {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a?: number;
}

const createImage = (
  width: number,
  height: number,
  paint: (x: number, y: number) => TestPixel,
): RgbaImageData => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = paint(x, y);
      const offset = (y * width + x) * 4;
      data[offset] = pixel.r;
      data[offset + 1] = pixel.g;
      data[offset + 2] = pixel.b;
      data[offset + 3] = pixel.a ?? 255;
    }
  }
  return { width, height, data };
};

const pixelAt = (
  image: RgbaImageData,
  x: number,
  y: number,
): { r: number; g: number; b: number; a: number } => {
  const offset = (y * image.width + x) * 4;
  return {
    r: image.data[offset] ?? 0,
    g: image.data[offset + 1] ?? 0,
    b: image.data[offset + 2] ?? 0,
    a: image.data[offset + 3] ?? 0,
  };
};

/** Deterministic paper grain, roughly +/- 6 luminance levels. */
const seededGrain = (): (() => number) => {
  let seed = 11;
  return () => {
    seed = (seed * 48271) % 2147483647;
    return (seed / 2147483647 - 0.5) * 12;
  };
};

const paper = { r: 205, g: 203, b: 200 };
const ink = { r: 24, g: 22, b: 28 };

/** Grey paper with a dark ink stroke in the middle rows, like a phone photo of a signature. */
const photographedSignature = (): RgbaImageData =>
  createImage(40, 30, (x, y) => (y >= 12 && y <= 17 && x >= 8 && x <= 31 ? ink : paper));

describe("removeSignatureBackground", () => {
  it("makes the paper transparent and keeps the ink opaque", () => {
    const result = removeSignatureBackground(photographedSignature(), { padding: 0 });

    expect(result.status).toBe("removed");
    expect(pixelAt(result.image, 0, 0).a).toBe(255);
    expect(pixelAt(result.image, 0, 0).r).toBeLessThan(60);
  });

  it("crops the result to the ink bounding box plus padding", () => {
    const result = removeSignatureBackground(photographedSignature(), { padding: 2 });

    // Ink spans x 8..31 (24 px) and y 12..17 (6 px), padded by 2 px on every side.
    expect(result.image.width).toBe(28);
    expect(result.image.height).toBe(10);
    expect(pixelAt(result.image, 0, 0).a).toBe(0);
    expect(pixelAt(result.image, 2, 2).a).toBe(255);
  });

  it("clamps the padded crop to the source bounds", () => {
    const edgeToEdge = createImage(10, 10, () => ink);

    const result = removeSignatureBackground(edgeToEdge, { padding: 20 });

    expect(result.image.width).toBe(10);
    expect(result.image.height).toBe(10);
  });

  it("reports the share of the result covered by ink", () => {
    const result = removeSignatureBackground(photographedSignature(), { padding: 0 });

    expect(result.inkCoverage).toBeCloseTo(1, 5);
  });

  it("leaves an image alone when paper and ink are not distinguishable", () => {
    const flat = createImage(20, 20, () => paper);

    const result = removeSignatureBackground(flat);

    expect(result.status).toBe("unchanged");
    expect(result.image.width).toBe(20);
    expect(result.image.height).toBe(20);
    expect(pixelAt(result.image, 5, 5).a).toBe(255);
  });

  it("only crops an image that already carries transparency", () => {
    const cutOut = createImage(20, 20, (x, y) =>
      y >= 8 && y <= 11 && x >= 4 && x <= 15 ? ink : { ...paper, a: 0 },
    );

    const result = removeSignatureBackground(cutOut, { padding: 0 });

    expect(result.status).toBe("already-transparent");
    expect(result.image.width).toBe(12);
    expect(result.image.height).toBe(4);
    expect(pixelAt(result.image, 0, 0).a).toBe(255);
  });

  it("removes a dark background behind light ink", () => {
    const inverted = createImage(40, 30, (x, y) =>
      y >= 12 && y <= 17 && x >= 8 && x <= 31
        ? { r: 240, g: 240, b: 236 }
        : { r: 20, g: 18, b: 24 },
    );

    const result = removeSignatureBackground(inverted, { padding: 0 });

    expect(result.status).toBe("removed");
    expect(result.image.width).toBe(24);
    expect(pixelAt(result.image, 0, 0).a).toBe(255);
    expect(pixelAt(result.image, 0, 0).r).toBeGreaterThan(200);
  });

  it("keeps anti-aliased stroke edges as partially transparent ink", () => {
    const softEdge = createImage(40, 30, (x, y) => {
      if (y >= 12 && y <= 17 && x >= 8 && x <= 31) {
        return ink;
      }
      if (y === 11 && x >= 8 && x <= 31) {
        return { r: 160, g: 158, b: 159 };
      }
      return paper;
    });

    const result = removeSignatureBackground(softEdge, { padding: 0 });
    const edge = pixelAt(result.image, 4, 0);

    expect(edge.a).toBeGreaterThan(0);
    expect(edge.a).toBeLessThan(255);
    // Un-mixing must recover ink colour rather than the grey blend with the paper.
    expect(edge.r).toBeLessThan(160);
  });

  it("removes unevenly lit paper without eating the ink", () => {
    // A phone photo is brighter under the lamp and darker in the corner; a single global
    // threshold would keep the shaded paper or drop the strokes there.
    const litUnevenly = createImage(160, 80, (x, y) => {
      const shade = Math.round(235 - (x / 159) * 70 - (y / 79) * 15);
      if (y >= 30 && y <= 45 && x >= 20 && x <= 139) {
        return { r: 30, g: 28, b: 34 };
      }
      return { r: shade, g: shade - 2, b: shade - 5 };
    });

    const result = removeSignatureBackground(litUnevenly, { padding: 0 });

    expect(result.status).toBe("removed");
    expect(result.image.width).toBe(120);
    expect(result.image.height).toBe(16);
    expect(result.inkCoverage).toBeCloseTo(1, 5);
  });

  it("keeps shaded paper transparent around the ink", () => {
    const litUnevenly = createImage(160, 80, (x, y) => {
      const shade = Math.round(235 - (x / 159) * 70 - (y / 79) * 15);
      if (y >= 30 && y <= 45 && x >= 60 && x <= 99) {
        return { r: 30, g: 28, b: 34 };
      }
      return { r: shade, g: shade - 2, b: shade - 5 };
    });

    const result = removeSignatureBackground(litUnevenly, { padding: 8 });

    // The darkest paper corner sits well below the brightest paper, yet stays transparent.
    expect(pixelAt(result.image, 0, result.image.height - 1).a).toBe(0);
    expect(pixelAt(result.image, result.image.width - 1, 0).a).toBe(0);
  });

  it("ignores speckles that are far smaller than the signature", () => {
    const speckled = createImage(40, 30, (x, y) => {
      if (y >= 12 && y <= 17 && x >= 8 && x <= 31) {
        return ink;
      }
      if (x === 2 && y === 2) {
        return ink;
      }
      return paper;
    });

    const result = removeSignatureBackground(speckled, { padding: 0 });

    expect(result.image.width).toBe(24);
    expect(result.image.height).toBe(6);
  });

  it("drops faint patches that never reach solid ink", () => {
    // Paper grain and shading survive thresholding as broad, barely visible patches. They are
    // far too large for the speckle rule, but they never contain a solid stroke pixel.
    const grainy = createImage(60, 40, (x, y) => {
      if (y >= 18 && y <= 23 && x >= 10 && x <= 49) {
        return ink;
      }
      if (y >= 30 && y <= 36 && x >= 4 && x <= 30) {
        return { r: 170, g: 168, b: 165 };
      }
      return paper;
    });

    const result = removeSignatureBackground(grainy, { padding: 0 });

    expect(result.image.width).toBe(40);
    expect(result.image.height).toBe(6);
  });

  it("leaves grainy blank paper alone", () => {
    const grain = seededGrain();
    const blank = createImage(120, 90, () => {
      const value = 198 + grain();
      return { r: value, g: value - 2, b: value - 5 };
    });

    const result = removeSignatureBackground(blank);

    expect(result.status).toBe("unchanged");
  });

  it("keeps a pale pencil signature and ignores the grain around it", () => {
    const grain = seededGrain();
    const pencil = createImage(120, 90, (x, y) => {
      const value = (y >= 40 && y <= 49 && x >= 20 && x <= 99 ? 140 : 198) + grain();
      return { r: value, g: value - 2, b: value - 5 };
    });

    const result = removeSignatureBackground(pencil, { padding: 0 });

    expect(result.status).toBe("removed");
    expect(result.image.width).toBe(80);
    expect(result.image.height).toBe(10);
  });

  it("rejects images without pixels", () => {
    const empty: RgbaImageData = { width: 0, height: 0, data: new Uint8ClampedArray(0) };

    const result = removeSignatureBackground(empty);

    expect(result.status).toBe("unchanged");
  });
});
