import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths work both locally and under the /client/ GitHub Pages path.
  base: "/client/",
  build: {
    target: "es2022",
    sourcemap: true
  }
});
