import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],        // ✅ only ESM, no CJS
  dts: true,              // ✅ generates type declarations
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  outDir: "dist",
  external: ["ai"],       // ✅ avoids bundling external deps
});
