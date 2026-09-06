/**
 * Separates handwritten signature ink from the paper it was photographed or scanned on.
 *
 * The rule lives in the application layer and works on plain RGBA bytes so it can be unit
 * tested without a canvas, and so no browser API leaks into the decision logic. Adapters are
 * responsible for decoding an image into pixels and encoding the result back into a PNG.
 */

export interface RgbaImageData {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface SignatureBackgroundRemovalOptions {
  /** Share of the paper-to-ink contrast that still counts as paper. */
  readonly tolerance?: number;
  /** Share of the paper-to-ink contrast at which a pixel counts as solid ink. */
  readonly inkThreshold?: number;
  /** Transparent margin kept around the detected ink, in source pixels. */
  readonly padding?: number;
}

export type SignatureBackgroundRemovalStatus = "removed" | "already-transparent" | "unchanged";

export interface SignatureBackgroundRemovalResult {
  readonly status: SignatureBackgroundRemovalStatus;
  readonly image: RgbaImageData;
  /** Share of the returned pixels that carry visible ink, between 0 and 1. */
  readonly inkCoverage: number;
}

const DEFAULT_TOLERANCE = 0.12;
const DEFAULT_INK_THRESHOLD = 0.45;
const DEFAULT_PADDING = 6;

/** Below this paper-to-ink luminance gap the image is not a signature on a plain background. */
const MIN_CONTRAST = 24;
/** Alpha at which a pixel counts as visible ink for cropping and coverage. */
const VISIBLE_ALPHA = 8;
/** Share of already translucent pixels that means the caller handed us a cut-out image. */
const EXISTING_TRANSPARENCY_RATIO = 0.02;
/** Un-mixing is unstable for nearly transparent pixels, so the original colour is kept. */
const MIN_UNMIX_ALPHA = 0.08;
const MIN_SPECKLE_AREA = 2;
/** Share of the strongest ink an island must reach to count as a pen mark rather than noise. */
const SOLID_INK_ALPHA_RATIO = 0.45;
const MIN_SOLID_INK_ALPHA = 64;
const MAX_SOLID_INK_ALPHA = 178;
const MAX_SPECKLE_AREA = 24;
const SPECKLE_AREA_RATIO = 0.0005;
/** Distance percentile that still describes paper rather than ink, and its safety factor. */
const PAPER_NOISE_PERCENTILE = 0.85;
const PAPER_NOISE_FACTOR = 2;
/** Ink must run this much deeper than the paper noise before a background is removed at all. */
const MIN_INK_TO_NOISE = 2;
/** Shortest ramp from paper to solid ink, as a share of the contrast. */
const MIN_INK_RAMP = 0.15;
/** Trimmed extremes used to judge which side of the paper the ink sits on. */
const EXTREME_PERCENTILE = 0.001;
/** Darkest pixels ignored as dust or hot pixels when measuring how deep the ink runs. */
const INK_TRIM_RATIO = 0.0005;
const MIN_INK_PIXELS = 4;
/** Fraction of the shorter side sampled as background around the image border. */
const BORDER_SAMPLE_RATIO = 0.03;

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

const luminanceOf = (red: number, green: number, blue: number): number =>
  0.2126 * red + 0.7152 * green + 0.0722 * blue;

const medianOf = (values: readonly number[]): number => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted[middle] ?? 0;
};

/** Luminance at the given percentile, read from a 256-bin histogram to stay linear in pixels. */
const percentileOf = (histogram: readonly number[], total: number, percentile: number): number => {
  const target = total * percentile;
  let seen = 0;
  for (let bin = 0; bin < histogram.length; bin += 1) {
    seen += histogram[bin] ?? 0;
    if (seen >= target) {
      return bin;
    }
  }
  return histogram.length - 1;
};

interface BackgroundEstimate {
  readonly luminance: number;
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

/**
 * Per-cell paper brightness, sampled on a coarse grid and read back with bilinear interpolation.
 *
 * A phone photo is rarely lit evenly, so a single global threshold either keeps the shaded half
 * of the paper or eats the strokes in the bright half. Estimating the paper locally removes the
 * lighting gradient before the ink is thresholded.
 */
interface BackgroundField {
  readonly columns: number;
  readonly rows: number;
  readonly cellSize: number;
  readonly luminances: Float32Array;
}

/** Grid cells across the longest side; big enough that no stroke fills a 3x3 neighbourhood. */
const BACKGROUND_FIELD_CELLS = 16;
const MIN_BACKGROUND_CELL_SIZE = 8;
/** How far a local paper estimate may drift from the global one, as a share of the contrast. */
const MAX_LOCAL_BACKGROUND_DRIFT = 0.6;

const estimateBackgroundField = (
  image: RgbaImageData,
  inkIsDarker: boolean,
  globalLuminance: number,
  contrast: number,
): BackgroundField => {
  const cellSize = Math.max(
    MIN_BACKGROUND_CELL_SIZE,
    Math.round(Math.max(image.width, image.height) / BACKGROUND_FIELD_CELLS),
  );
  const columns = Math.max(1, Math.ceil(image.width / cellSize));
  const rows = Math.max(1, Math.ceil(image.height / cellSize));
  const histograms: number[][] = Array.from({ length: columns * rows }, () =>
    new Array<number>(256).fill(0),
  );
  const counts = new Int32Array(columns * rows);
  for (let y = 0; y < image.height; y += 1) {
    const row = Math.min(rows - 1, Math.floor(y / cellSize));
    for (let x = 0; x < image.width; x += 1) {
      const column = Math.min(columns - 1, Math.floor(x / cellSize));
      const offset = (y * image.width + x) * 4;
      const bin = clamp(
        Math.round(
          luminanceOf(
            image.data[offset] ?? 0,
            image.data[offset + 1] ?? 0,
            image.data[offset + 2] ?? 0,
          ),
        ),
        0,
        255,
      );
      const cell = row * columns + column;
      const histogram = histograms[cell];
      if (histogram !== undefined) {
        histogram[bin] = (histogram[bin] ?? 0) + 1;
      }
      counts[cell] = (counts[cell] ?? 0) + 1;
    }
  }

  // The paper is the bright end of a cell for dark ink, and the dark end for light ink.
  const sampled = new Float32Array(columns * rows);
  for (let cell = 0; cell < sampled.length; cell += 1) {
    const histogram = histograms[cell];
    const count = counts[cell] ?? 0;
    sampled[cell] =
      histogram === undefined || count === 0
        ? globalLuminance
        : percentileOf(histogram, count, inkIsDarker ? 0.9 : 0.1);
  }

  // A cell buried under a thick stroke has no paper left to sample. The neighbourhood median
  // repairs it from the cells around it while following a lighting gradient, which a maximum
  // filter would not: that would read every shaded pixel as faint ink.
  const luminances = new Float32Array(columns * rows);
  const lowerBound = globalLuminance - contrast * MAX_LOCAL_BACKGROUND_DRIFT;
  const upperBound = globalLuminance + contrast * MAX_LOCAL_BACKGROUND_DRIFT;
  const neighbourhood: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      neighbourhood.length = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const ny = row + dy;
          const nx = column + dx;
          if (ny < 0 || nx < 0 || ny >= rows || nx >= columns) {
            continue;
          }
          neighbourhood.push(sampled[ny * columns + nx] ?? globalLuminance);
        }
      }
      luminances[row * columns + column] = clamp(medianOf(neighbourhood), lowerBound, upperBound);
    }
  }
  return { columns, rows, cellSize, luminances };
};

/** Paper brightness at a pixel, interpolated between the surrounding cell centres. */
const sampleBackgroundField = (field: BackgroundField, x: number, y: number): number => {
  const gridX = clamp(x / field.cellSize - 0.5, 0, field.columns - 1);
  const gridY = clamp(y / field.cellSize - 0.5, 0, field.rows - 1);
  const left = Math.floor(gridX);
  const top = Math.floor(gridY);
  const right = Math.min(field.columns - 1, left + 1);
  const bottom = Math.min(field.rows - 1, top + 1);
  const weightX = gridX - left;
  const weightY = gridY - top;
  const topLeft = field.luminances[top * field.columns + left] ?? 0;
  const topRight = field.luminances[top * field.columns + right] ?? 0;
  const bottomLeft = field.luminances[bottom * field.columns + left] ?? 0;
  const bottomRight = field.luminances[bottom * field.columns + right] ?? 0;
  const upper = topLeft + (topRight - topLeft) * weightX;
  const lower = bottomLeft + (bottomRight - bottomLeft) * weightX;
  return upper + (lower - upper) * weightY;
};

const estimateBackground = (image: RgbaImageData): BackgroundEstimate => {
  const thickness = Math.max(
    1,
    Math.round(Math.min(image.width, image.height) * BORDER_SAMPLE_RATIO),
  );
  const reds: number[] = [];
  const greens: number[] = [];
  const blues: number[] = [];
  for (let y = 0; y < image.height; y += 1) {
    const isBorderRow = y < thickness || y >= image.height - thickness;
    for (let x = 0; x < image.width; x += 1) {
      const isBorderColumn = x < thickness || x >= image.width - thickness;
      if (!isBorderRow && !isBorderColumn) {
        continue;
      }
      const offset = (y * image.width + x) * 4;
      reds.push(image.data[offset] ?? 0);
      greens.push(image.data[offset + 1] ?? 0);
      blues.push(image.data[offset + 2] ?? 0);
    }
  }
  const red = medianOf(reds);
  const green = medianOf(greens);
  const blue = medianOf(blues);
  return { luminance: luminanceOf(red, green, blue), red, green, blue };
};

interface Bounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const visibleBounds = (image: RgbaImageData): Bounds | undefined => {
  let left = image.width;
  let top = image.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.data[(y * image.width + x) * 4 + 3] ?? 0;
      if (alpha <= VISIBLE_ALPHA) {
        continue;
      }
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return right < 0 || bottom < 0 ? undefined : { left, top, right, bottom };
};

const cropTo = (image: RgbaImageData, bounds: Bounds, padding: number): RgbaImageData => {
  const left = clamp(bounds.left - padding, 0, image.width - 1);
  const top = clamp(bounds.top - padding, 0, image.height - 1);
  const right = clamp(bounds.right + padding, 0, image.width - 1);
  const bottom = clamp(bounds.bottom + padding, 0, image.height - 1);
  const width = right - left + 1;
  const height = bottom - top + 1;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceStart = ((top + y) * image.width + left) * 4;
    data.set(image.data.subarray(sourceStart, sourceStart + width * 4), y * width * 4);
  }
  return { width, height, data };
};

/**
 * Clears ink islands that cannot be part of the signature.
 *
 * Two ways an island is rejected: it is far too small to be a pen mark, or it never reaches the
 * strength of real ink. Sensor noise, paper grain and shading survive thresholding as broad but
 * uniformly faint patches, while every genuine stroke — including the dot on an "i" and the
 * thin tail of a flourish — is anchored to pixels that are solidly inked.
 */
const clearWeakIslands = (image: RgbaImageData, totalInk: number, strongAlpha: number): void => {
  const minimumArea = clamp(totalInk * SPECKLE_AREA_RATIO, MIN_SPECKLE_AREA, MAX_SPECKLE_AREA);
  const pixelCount = image.width * image.height;
  const visited = new Uint8Array(pixelCount);
  const component: number[] = [];
  const queue: number[] = [];
  for (let start = 0; start < pixelCount; start += 1) {
    if (visited[start] === 1 || (image.data[start * 4 + 3] ?? 0) <= VISIBLE_ALPHA) {
      continue;
    }
    component.length = 0;
    queue.length = 0;
    queue.push(start);
    visited[start] = 1;
    let reachesSolidInk = false;
    while (queue.length > 0) {
      const index = queue.pop() ?? 0;
      component.push(index);
      if ((image.data[index * 4 + 3] ?? 0) >= strongAlpha) {
        reachesSolidInk = true;
      }
      const x = index % image.width;
      const y = (index - x) / image.width;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height) {
            continue;
          }
          const neighbour = ny * image.width + nx;
          if (visited[neighbour] === 1 || (image.data[neighbour * 4 + 3] ?? 0) <= VISIBLE_ALPHA) {
            continue;
          }
          visited[neighbour] = 1;
          queue.push(neighbour);
        }
      }
    }
    if (reachesSolidInk && component.length >= minimumArea) {
      continue;
    }
    for (const index of component) {
      image.data[index * 4 + 3] = 0;
    }
  }
};

const coverageOf = (image: RgbaImageData): number => {
  const pixelCount = image.width * image.height;
  if (pixelCount === 0) {
    return 0;
  }
  let visible = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    if ((image.data[index * 4 + 3] ?? 0) > VISIBLE_ALPHA) {
      visible += 1;
    }
  }
  return visible / pixelCount;
};

const unchanged = (image: RgbaImageData): SignatureBackgroundRemovalResult => ({
  status: "unchanged",
  image,
  inkCoverage: coverageOf(image),
});

/**
 * Returns the signature drawn on a transparent background, cropped to the ink.
 *
 * The source image is never mutated. When the paper cannot be told apart from the ink the
 * original image is returned with status `unchanged` so callers can fall back to it instead of
 * showing an empty or badly cut signature.
 */
export const removeSignatureBackground = (
  image: RgbaImageData,
  options: SignatureBackgroundRemovalOptions = {},
): SignatureBackgroundRemovalResult => {
  const pixelCount = image.width * image.height;
  if (pixelCount === 0) {
    return unchanged(image);
  }
  const padding = Math.max(0, Math.round(options.padding ?? DEFAULT_PADDING));
  const tolerance = clamp(options.tolerance ?? DEFAULT_TOLERANCE, 0, 0.9);
  const inkThreshold = clamp(options.inkThreshold ?? DEFAULT_INK_THRESHOLD, tolerance + 0.05, 1);

  let translucent = 0;
  const histogram = new Array<number>(256).fill(0);
  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    if ((image.data[offset + 3] ?? 0) < 250) {
      translucent += 1;
    }
    const bin = Math.round(
      luminanceOf(
        image.data[offset] ?? 0,
        image.data[offset + 1] ?? 0,
        image.data[offset + 2] ?? 0,
      ),
    );
    const histogramBin = clamp(bin, 0, 255);
    histogram[histogramBin] = (histogram[histogramBin] ?? 0) + 1;
  }

  // An image that already carries a cut-out only needs to be trimmed to its ink.
  if (translucent / pixelCount > EXISTING_TRANSPARENCY_RATIO) {
    const bounds = visibleBounds(image);
    if (bounds === undefined) {
      return unchanged(image);
    }
    const cropped = cropTo(image, bounds, padding);
    return { status: "already-transparent", image: cropped, inkCoverage: coverageOf(cropped) };
  }

  const background = estimateBackground(image);
  const darkestLuminance = percentileOf(histogram, pixelCount, EXTREME_PERCENTILE);
  const lightestLuminance = percentileOf(histogram, pixelCount, 1 - EXTREME_PERCENTILE);
  const inkIsDarker =
    background.luminance - darkestLuminance >= lightestLuminance - background.luminance;
  const roughContrast = inkIsDarker
    ? background.luminance - darkestLuminance
    : lightestLuminance - background.luminance;

  const field = estimateBackgroundField(image, inkIsDarker, background.luminance, roughContrast);

  // How deep the ink sits below (or above) its own local paper. Measuring against the field
  // rather than a fixed luminance percentile is what keeps a small signature on a large,
  // unevenly lit sheet honest: there, most of the darkest pixels are shaded paper, not ink.
  const distances = new Array<number>(256).fill(0);
  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    const x = index % image.width;
    const luminance = luminanceOf(
      image.data[offset] ?? 0,
      image.data[offset + 1] ?? 0,
      image.data[offset + 2] ?? 0,
    );
    const localLuminance = sampleBackgroundField(field, x, (index - x) / image.width);
    const distance = inkIsDarker ? localLuminance - luminance : luminance - localLuminance;
    const bin = clamp(Math.round(distance), 0, 255);
    distances[bin] = (distances[bin] ?? 0) + 1;
  }
  const outliers = Math.max(MIN_INK_PIXELS, Math.round(pixelCount * INK_TRIM_RATIO));
  let seen = 0;
  let contrast = 0;
  for (let bin = 255; bin >= 0; bin -= 1) {
    seen += distances[bin] ?? 0;
    if (seen >= outliers) {
      contrast = bin;
      break;
    }
  }
  // Paper grain and sensor noise also sit above the local paper level. Most of an upload is
  // paper, so a high percentile of the distances measures that noise, and ink has to clear it.
  const noiseFloor =
    percentileOf(distances, pixelCount, PAPER_NOISE_PERCENTILE) * PAPER_NOISE_FACTOR;
  if (contrast < Math.max(MIN_CONTRAST, noiseFloor * MIN_INK_TO_NOISE)) {
    return unchanged(image);
  }

  const low = Math.max(contrast * tolerance, noiseFloor);
  const high = Math.max(contrast * inkThreshold, low + contrast * MIN_INK_RAMP);
  const separated: RgbaImageData = {
    width: image.width,
    height: image.height,
    data: new Uint8ClampedArray(pixelCount * 4),
  };
  let totalInk = 0;
  let strongestAlpha = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    const red = image.data[offset] ?? 0;
    const green = image.data[offset + 1] ?? 0;
    const blue = image.data[offset + 2] ?? 0;
    const sourceAlpha = (image.data[offset + 3] ?? 0) / 255;
    const x = index % image.width;
    const localLuminance = sampleBackgroundField(field, x, (index - x) / image.width);
    const distance = inkIsDarker
      ? localLuminance - luminanceOf(red, green, blue)
      : luminanceOf(red, green, blue) - localLuminance;
    const alpha = clamp((distance - low) / (high - low), 0, 1) * sourceAlpha;
    if (alpha <= 0) {
      continue;
    }
    // The paper colour is shaded like the local paper brightness, so un-mixing follows it.
    const shade = background.luminance === 0 ? 1 : localLuminance / background.luminance;
    const backgroundRed = clamp(background.red * shade, 0, 255);
    const backgroundGreen = clamp(background.green * shade, 0, 255);
    const backgroundBlue = clamp(background.blue * shade, 0, 255);
    if (alpha >= MIN_UNMIX_ALPHA) {
      // The observed pixel is ink blended over paper; recover the ink so soft stroke edges do
      // not carry a grey halo onto the page they are placed on.
      separated.data[offset] = (red - backgroundRed * (1 - alpha)) / alpha;
      separated.data[offset + 1] = (green - backgroundGreen * (1 - alpha)) / alpha;
      separated.data[offset + 2] = (blue - backgroundBlue * (1 - alpha)) / alpha;
    } else {
      separated.data[offset] = red;
      separated.data[offset + 1] = green;
      separated.data[offset + 2] = blue;
    }
    const storedAlpha = Math.round(alpha * 255);
    separated.data[offset + 3] = storedAlpha;
    if (storedAlpha > VISIBLE_ALPHA) {
      totalInk += 1;
      strongestAlpha = Math.max(strongestAlpha, storedAlpha);
    }
  }

  if (totalInk === 0) {
    return unchanged(image);
  }
  // Relative to the darkest ink found, so a pale pen is judged against its own strokes.
  const strongAlpha = clamp(
    strongestAlpha * SOLID_INK_ALPHA_RATIO,
    MIN_SOLID_INK_ALPHA,
    MAX_SOLID_INK_ALPHA,
  );
  clearWeakIslands(separated, totalInk, strongAlpha);
  const bounds = visibleBounds(separated);
  if (bounds === undefined) {
    return unchanged(image);
  }
  const cropped = cropTo(separated, bounds, padding);
  return { status: "removed", image: cropped, inkCoverage: coverageOf(cropped) };
};
