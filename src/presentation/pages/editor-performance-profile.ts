import type { EditorFormFactor } from "./editor-form-factor";

export type EditorPerformanceProfile = "automatic" | "light" | "full";

export type EffectiveEditorPerformanceProfile = Exclude<EditorPerformanceProfile, "automatic">;

export type EditorPerformanceEnvironment = Readonly<{
  formFactor: EditorFormFactor;
  hardwareConcurrency: number | undefined;
  deviceMemory: number | undefined;
}>;

const LOW_POWER_MAX_CORES = 4;
const LOW_POWER_MAX_MEMORY_GB = 2;

const isLowPowerTouchEnvironment = ({
  formFactor,
  hardwareConcurrency,
  deviceMemory,
}: EditorPerformanceEnvironment): boolean => {
  if (formFactor === "desktop") {
    return false;
  }

  const hasNoCapacitySignal = hardwareConcurrency === undefined && deviceMemory === undefined;

  return (
    hasNoCapacitySignal ||
    (hardwareConcurrency !== undefined && hardwareConcurrency <= LOW_POWER_MAX_CORES) ||
    (deviceMemory !== undefined && deviceMemory <= LOW_POWER_MAX_MEMORY_GB)
  );
};

export const resolveEditorPerformanceProfile = (
  profile: EditorPerformanceProfile,
  environment: EditorPerformanceEnvironment,
): EffectiveEditorPerformanceProfile => {
  if (profile === "light" || profile === "full") {
    return profile;
  }

  return isLowPowerTouchEnvironment(environment) ? "light" : "full";
};

export const renderPixelRatioForProfile = (
  profile: EffectiveEditorPerformanceProfile,
  devicePixelRatio: number,
): number => {
  if (profile === "light") {
    return 1;
  }

  return Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
};
