import type { SignatureImageInput } from "../../application/editor-application";
import type {
  SignatureBackgroundRemovalOutcome,
  SignatureBackgroundRemover,
} from "../../application/signature-background-remover";
import {
  removeSignatureBackground,
  type SignatureBackgroundRemovalOptions,
} from "../../application/signature-background-removal";

/** Longest side used while separating the ink; larger uploads are sampled down first. */
const DEFAULT_MAX_DIMENSION = 1600;

const FAILURE_MESSAGE =
  "The signature background could not be removed. The original image was kept.";

interface MutableImageData {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/** The slice of `CanvasRenderingContext2D` this adapter needs, so tests can supply a double. */
export interface SignatureCanvasContext {
  drawImage(
    source: CanvasImageSource,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ): void;
  getImageData(sx: number, sy: number, sw: number, sh: number): MutableImageData;
  createImageData(width: number, height: number): MutableImageData;
  putImageData(imageData: MutableImageData, dx: number, dy: number): void;
}

/** The slice of `HTMLCanvasElement` this adapter needs. */
export interface SignatureCanvas {
  width: number;
  height: number;
  getContext(contextId: "2d"): SignatureCanvasContext | null;
  toDataURL(type?: string): string;
}

export interface SignatureCanvasImage {
  readonly width: number;
  readonly height: number;
  readonly source: CanvasImageSource;
}

export interface CanvasSignatureBackgroundRemoverOptions {
  readonly createCanvas?: (width: number, height: number) => SignatureCanvas;
  readonly loadImage?: (dataUrl: string) => Promise<SignatureCanvasImage>;
  readonly maxDimension?: number;
  readonly removal?: SignatureBackgroundRemovalOptions;
}

const createDomCanvas = (width: number, height: number): SignatureCanvas => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const loadDomImage = async (dataUrl: string): Promise<SignatureCanvasImage> =>
  await new Promise<SignatureCanvasImage>((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight, source: image });
    });
    image.addEventListener("error", () => {
      reject(new Error("The signature image could not be decoded."));
    });
    image.src = dataUrl;
  });

const failure = (): SignatureBackgroundRemovalOutcome => ({
  status: "failed",
  error: { code: "SignatureBackgroundRemovalFailed", message: FAILURE_MESSAGE },
});

/**
 * Removes the paper behind an uploaded signature using an offscreen canvas.
 *
 * Everything stays in the browser: pixels are read from a canvas, separated by the application
 * rule, and written back out as a PNG data URL. Nothing is uploaded.
 */
export const createCanvasSignatureBackgroundRemover = (
  options: CanvasSignatureBackgroundRemoverOptions = {},
): SignatureBackgroundRemover => {
  const createCanvas = options.createCanvas ?? createDomCanvas;
  const loadImage = options.loadImage ?? loadDomImage;
  const maxDimension = Math.max(1, options.maxDimension ?? DEFAULT_MAX_DIMENSION);

  return {
    async remove(input: SignatureImageInput): Promise<SignatureBackgroundRemovalOutcome> {
      try {
        const decoded = await loadImage(input.dataUrl);
        const longestSide = Math.max(decoded.width, decoded.height);
        if (longestSide === 0) {
          return failure();
        }
        const scale = Math.min(1, maxDimension / longestSide);
        const width = Math.max(1, Math.round(decoded.width * scale));
        const height = Math.max(1, Math.round(decoded.height * scale));

        const sourceCanvas = createCanvas(width, height);
        const sourceContext = sourceCanvas.getContext("2d");
        if (sourceContext === null) {
          return failure();
        }
        sourceContext.drawImage(decoded.source, 0, 0, width, height);
        const pixels = sourceContext.getImageData(0, 0, width, height);

        const separated = removeSignatureBackground(
          { width: pixels.width, height: pixels.height, data: pixels.data },
          options.removal,
        );
        if (separated.status === "unchanged") {
          return { status: "unchanged", image: input };
        }

        const targetCanvas = createCanvas(separated.image.width, separated.image.height);
        const targetContext = targetCanvas.getContext("2d");
        if (targetContext === null) {
          return failure();
        }
        const output = targetContext.createImageData(separated.image.width, separated.image.height);
        output.data.set(separated.image.data);
        targetContext.putImageData(output, 0, 0);

        return {
          status: separated.status,
          image: {
            dataUrl: targetCanvas.toDataURL("image/png"),
            mimeType: "image/png",
            width: separated.image.width,
            height: separated.image.height,
            source: input.source,
          },
        };
      } catch {
        // Decoding and canvas access fail for reasons the user cannot act on; the caller keeps
        // the original upload and shows the typed message instead.
        return failure();
      }
    },
  };
};
