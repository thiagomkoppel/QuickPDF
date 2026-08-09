import { useEffect } from "react";

/** Registers the browser-native unload warning only while a session is dirty. */
export const useUnsavedChangesBeforeUnload = (hasUnsavedChanges: boolean): void => {
  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;

    const warnBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
    };
  }, [hasUnsavedChanges]);
};
