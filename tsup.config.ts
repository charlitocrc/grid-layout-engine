import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      core: "src/core/index.ts",
      extras: "src/extras/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    splitting: true,
    treeshake: true,
    clean: true,
    outDir: "dist",
  },
  {
    entry: { "grid-layout-engine": "src/browser.ts" },
    format: ["iife"],
    splitting: false,
    treeshake: true,
    minify: true,
    outDir: "dist",
    outExtension: () => ({ js: ".min.js" }),
  },
]);
