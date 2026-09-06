export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect extends Point {
  readonly width: number;
  readonly height: number;
}

/**
 * The visible area of a page in PDF user space.
 *
 * `width` and `height` describe the area the reader actually shows, and `x`/`y` its lower-left
 * corner. Both default to zero: a page is usually displayed from the origin, but a cropped page
 * or a media box that does not start at the origin is offset, and overlays have to follow it or
 * they land somewhere else in the exported file.
 */
export interface PageGeometry {
  readonly width: number;
  readonly height: number;
  readonly x?: number;
  readonly y?: number;
}

/** Top edge of the visible page area, which top-left overlay coordinates are measured from. */
const visibleTop = (page: PageGeometry): number => (page.y ?? 0) + page.height;

export const pageTopLeftRectToPdfRect = (rect: Rect, page: PageGeometry): Rect => ({
  x: (page.x ?? 0) + rect.x,
  y: visibleTop(page) - rect.y - rect.height,
  width: rect.width,
  height: rect.height,
});

export const pageTopLeftTextToPdfPoint = (request: {
  readonly bounds: Rect;
  readonly page: PageGeometry;
  readonly fontSize: number;
}): Point => ({
  x: (request.page.x ?? 0) + request.bounds.x,
  y: visibleTop(request.page) - request.bounds.y - request.fontSize,
});
