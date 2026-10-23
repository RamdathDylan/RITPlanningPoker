import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development the browser talks only to Vite, which forwards these paths to the Node
// server. That mirrors production, where one origin serves everything (ADR-008).
const serverUrl = `http://localhost:${process.env.PORT ?? 3000}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": serverUrl,
      "/health": serverUrl,
      "/socket.io": { target: serverUrl, ws: true },
    },
  },
});
