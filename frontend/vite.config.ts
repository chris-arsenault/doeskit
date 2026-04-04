/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      provider: "v8",
      reporter: ["lcov", "text"],
    },
  },
  build: {
    rollupOptions: {
      external: ["/config.js"],
    },
  },
});
