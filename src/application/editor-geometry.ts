export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect extends Point {
  readonly width: number;
  readonly height: number;
}

export interface PageGeometry {
  readonly width: number;
  readonly height: number;
}

export const pageTopLeftRectToPdfRect = (rect: Rect, page: PageGeometry): Rect => ({
  x: rect.x,
  y: page.height - rect.y - rect.height,
  width: rect.width,
  height: rect.height,
});

export const pageTopLeftTextToPdfPoint = (request: {
  readonly bounds: Rect;
  readonly page: PageGeometry;
  readonly fontSize: number;
}): Point => ({
  x: request.bounds.x,
  y: request.page.height - request.bounds.y - request.fontSize,
});
