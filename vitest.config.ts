import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: [resolve(__dirname, "src/test/setup.ts")],
    include: ["src/**/*.{test,spec}.{ts,js}"],
    exclude: ["node_modules", "dist"],
    globals: true,
  },
});
