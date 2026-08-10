import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { resolveQuickPdfBuildMetadata } from "./scripts/build-metadata.mjs";

export default defineConfig(({ mode }) => {
  const build = resolveQuickPdfBuildMetadata({ mode });

  return {
    plugins: [react()],
    define: {
      __QUICKPDF_BUILD__: JSON.stringify(build),
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["src/test/setup.ts"],
      exclude: ["e2e/**", "node_modules/**", "dist/**"],
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
      },
    },
  };
});
