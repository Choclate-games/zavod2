import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3000
  },
  build: {
    target: "esnext",
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1500
  }
});
