import { defineConfig } from "vite";

export default defineConfig({
  // Keep assets relative so the same build works on Cloudflare Pages previews and production.
  base: "./",
  build: {
    target: "es2022",
    sourcemap: true
  }
});
