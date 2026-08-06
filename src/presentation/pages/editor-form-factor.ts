export type EditorFormFactor = "phone" | "tablet-portrait" | "tablet-landscape" | "desktop";

export type EditorViewportMetrics = Readonly<{
  width: number;
  height: number;
  hasCoarsePointer: boolean;
  maxTouchPoints: number;
}>;

const PHONE_MAX_SHORTEST_EDGE = 767;
const TABLET_MAX_SHORTEST_EDGE = 1024;
const MIN_USABLE_EDITOR_HEIGHT = 500;

export const classifyEditorFormFactor = ({
  width,
  height,
  hasCoarsePointer,
  maxTouchPoints,
}: EditorViewportMetrics): EditorFormFactor => {
  const shortestEdge = Math.min(width, height);
  const supportsTouch = hasCoarsePointer || maxTouchPoints > 0;

  if (supportsTouch && shortestEdge < PHONE_MAX_SHORTEST_EDGE) {
    return "phone";
  }

  const isTabletHardware =
    supportsTouch && shortestEdge <= TABLET_MAX_SHORTEST_EDGE && height >= MIN_USABLE_EDITOR_HEIGHT;

  if (isTabletHardware) {
    return width >= height ? "tablet-landscape" : "tablet-portrait";
  }

  return "desktop";
};
