import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["bin/compressx.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  minify: false,
  sourcemap: false,
  splitting: false,
  shims: true,
  platform: "node",
});
