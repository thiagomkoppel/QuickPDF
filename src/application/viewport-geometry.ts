export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface ViewportGeometry {
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly scale: number;
}

export const pageToScreenPoint = (point: Point, viewport: ViewportGeometry): Point => ({
  x: point.x * viewport.scale,
  y: (viewport.pageHeight - point.y) * viewport.scale,
});

export const screenToPagePoint = (point: Point, viewport: ViewportGeometry): Point => ({
  x: point.x / viewport.scale,
  y: viewport.pageHeight - point.y / viewport.scale,
});
