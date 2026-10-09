import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: { entries: ["index.html"] }, // Ignore nested Overwolf app during website dev scanning.
  base: process.env.GITHUB_ACTIONS ? "/chibi.gg/" : "/",
  define: {
    __APP_VERSION__: JSON.stringify(process.env.GITHUB_SHA || "dev"),
  },
});
