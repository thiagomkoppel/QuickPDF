import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { resolveQuickPdfBuildMetadata } from "./scripts/build-metadata.mjs";

const compatibilityGateTarget = "chrome101";

export default defineConfig(({ mode }) => {
  const build = resolveQuickPdfBuildMetadata({ mode });

  return {
    plugins: [react()],
    build: { target: compatibilityGateTarget, manifest: true },
    define: {
      __QUICKPDF_BUILD__: JSON.stringify(build),
    },
  };
});
