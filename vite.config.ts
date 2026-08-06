import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const compatibilityGateTarget = "chrome101";

export default defineConfig({
  plugins: [react()],
  build: { target: compatibilityGateTarget, manifest: true },
});
