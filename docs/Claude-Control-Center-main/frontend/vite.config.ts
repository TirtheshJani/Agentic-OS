import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        // Override with VITE_PROXY_TARGET when the default port is taken
        // (e.g. a production container already bound to :5050).
        target: process.env.VITE_PROXY_TARGET || "http://localhost:5050",
        changeOrigin: true,
      },
    },
  },
});
