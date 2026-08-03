export type ViewerMode = "manual" | "fit-page" | "fit-width";

export interface ViewerFitInput {
  readonly workspaceWidth: number;
  readonly workspaceHeight: number;
  readonly horizontalPadding: number;
  readonly verticalPadding: number;
  readonly pageWidth: number;
  readonly pageHeight: number;
}

const valid = (value: number): boolean => Number.isFinite(value) && value > 0;

export const calculateViewerFit = (
  mode: Exclude<ViewerMode, "manual">,
  input: ViewerFitInput,
): number | undefined => {
  if (
    !valid(input.workspaceWidth) ||
    !valid(input.workspaceHeight) ||
    !valid(input.pageWidth) ||
    !valid(input.pageHeight)
  ) {
    return undefined;
  }
  const availableWidth = Math.max(1, input.workspaceWidth - Math.max(0, input.horizontalPadding));
  const availableHeight = Math.max(1, input.workspaceHeight - Math.max(0, input.verticalPadding));
  const widthScale = availableWidth / input.pageWidth;
  if (mode === "fit-width") {
    return widthScale;
  }
  return Math.min(widthScale, availableHeight / input.pageHeight);
};
