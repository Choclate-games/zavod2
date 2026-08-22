import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 6000,
  },
  server: {
    port: 3000,
    host: true,
  },
});