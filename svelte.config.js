import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: "build",
      assets: "build",
      fallback: "index.html",
    }),
    alias: {
      "$lib": "src/lib",
      "$lib/*": "src/lib/*",     // <-- Wrapped in quotes
      "@shared": "src/shared",
      "@shared/*": "src/shared/*", // <-- Wrapped in quotes
    },
  },
};

export default config;