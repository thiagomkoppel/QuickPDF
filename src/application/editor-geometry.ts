export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect extends Point {
  readonly width: number;
  readonly height: number;
}

export interface ViewportGeometry {
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly scale: number;
}

export const pageToScreenPoint = (point: Point, viewport: ViewportGeometry): Point => ({
  x: point.x * viewport.scale,
  y: point.y * viewport.scale,
});

export const screenToPagePoint = (point: Point, viewport: ViewportGeometry): Point => ({
  x: point.x / viewport.scale,
  y: point.y / viewport.scale,
});

export const pageToScreenRect = (rect: Rect, viewport: ViewportGeometry): Rect => ({
  ...pageToScreenPoint(rect, viewport),
  width: rect.width * viewport.scale,
  height: rect.height * viewport.scale,
});

export const screenToPageRect = (rect: Rect, viewport: ViewportGeometry): Rect => ({
  ...screenToPagePoint(rect, viewport),
  width: rect.width / viewport.scale,
  height: rect.height / viewport.scale,
});

export const calculateAnchoredScroll = (request: {
  readonly scrollLeft: number;
  readonly scrollTop: number;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly previousScale: number;
  readonly nextScale: number;
}): Point => {
  if (request.previousScale <= 0 || request.nextScale <= 0) {
    return { x: request.scrollLeft, y: request.scrollTop };
  }

  const scaleRatio = request.nextScale / request.previousScale;

  return {
    x: (request.scrollLeft + request.pointerX) * scaleRatio - request.pointerX,
    y: (request.scrollTop + request.pointerY) * scaleRatio - request.pointerY,
  };
};
