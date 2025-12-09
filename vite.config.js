import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Allow external connections
    allowedHosts: [
      "09caacc2e455.ngrok-free.app",
      ".ngrok-free.app", // Allow all ngrok subdomains
      "localhost",
      "127.0.0.1",
    ],
    proxy: {
      "/api": {
        target: "https://111.90.159.132",
        changeOrigin: true,
        rewrite: (path) => {
          // Remove /api prefix and keep the rest
          const newPath = path.replace(/^\/api/, "");
          return newPath;
        },
        secure: true,
        configure: (proxy, options) => {
          proxy.on("error", (err, req, res) => {
            // Silent error handling
          });
          proxy.on("proxyReq", (proxyReq, req, res) => {
            // Silent proxy logging
          });
        },
      },
      // Proxy for video files from cmlhz.com to avoid CORS issues
      "/video": {
        target: "https://cmlhz.com",
        changeOrigin: true,
        rewrite: (path) => {
          // Remove /video prefix and keep the rest
          const newPath = path.replace(/^\/video/, "");
          // Ensure path starts with /
          return newPath.startsWith("/") ? newPath : `/${newPath}`;
        },
        secure: true,
        configure: (proxy, options) => {
          proxy.on("error", (err, req, res) => {
            // Silent error handling
          });
          proxy.on("proxyReq", (proxyReq, req, res) => {
            // Add Range header support for video streaming
            if (req.headers.range) {
              proxyReq.setHeader("Range", req.headers.range);
            }
            // Add CORS headers to response
            proxyReq.setHeader("Referer", "https://cmlhz.com");
            // Silent proxy logging
          });
          proxy.on("proxyRes", (proxyRes, req, res) => {
            // Add CORS headers to response
            proxyRes.headers["Access-Control-Allow-Origin"] = "*";
            proxyRes.headers["Access-Control-Allow-Methods"] =
              "GET, HEAD, OPTIONS";
            proxyRes.headers["Access-Control-Allow-Headers"] = "Range";
            // Silent proxy logging
          });
        },
      },
    },
  },
});
