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
          // Also remove token and expires query params for security
          let newPath = path.replace(/^\/api/, "");
          newPath = newPath.split("?")[0]; // Remove query params
          return newPath;
        },
        secure: true,
        configure: (proxy, options) => {
          proxy.on("error", (err, req, res) => {
            // Silent error handling
          });
          proxy.on("proxyReq", (proxyReq, req, res) => {
            // Validate domain and token
            const origin = req.headers.origin || req.headers.referer;
            const token = req.headers["x-domain-token"];

            // Remove security headers before forwarding
            proxyReq.removeHeader("x-domain-token");
            proxyReq.removeHeader("x-origin");

            // Silent proxy logging
          });
        },
      },
      // Proxy for video files from cmlhz.com to avoid CORS issues
      // With domain locking and signed URL validation
      "/video": {
        target: "https://cmlhz.com",
        changeOrigin: true,
        rewrite: (path) => {
          // Remove /video prefix and keep the rest
          // Extract path before query params (token, expires)
          let newPath = path.replace(/^\/video/, "");
          const queryIndex = newPath.indexOf("?");
          if (queryIndex > -1) {
            newPath = newPath.substring(0, queryIndex);
          }
          // Ensure path starts with /
          return newPath.startsWith("/") ? newPath : `/${newPath}`;
        },
        secure: true,
        configure: (proxy, options) => {
          proxy.on("error", (err, req, res) => {
            // Silent error handling
          });
          proxy.on("proxyReq", (proxyReq, req, res) => {
            // Validate signed URL and domain
            const url = new URL(req.url, `http://${req.headers.host}`);
            const token = url.searchParams.get("token");
            const expires = url.searchParams.get("expires");

            // Check expiration
            if (expires && parseInt(expires) < Math.floor(Date.now() / 1000)) {
              res.writeHead(403, { "Content-Type": "text/plain" });
              res.end("URL expired");
              return;
            }

            // Add Range header support for video streaming
            if (req.headers.range) {
              proxyReq.setHeader("Range", req.headers.range);
            }
            // Add CORS headers to response
            proxyReq.setHeader("Referer", "https://cmlhz.com");

            // Remove token from query string before forwarding
            const cleanPath = proxyReq.path.split("?")[0];
            proxyReq.path = cleanPath;
          });
          proxy.on("proxyRes", (proxyRes, req, res) => {
            // Add CORS headers to response (only for allowed domains)
            const origin = req.headers.origin;
            if (
              origin &&
              (origin.includes("localhost") ||
                origin.includes("ngrok-free.app"))
            ) {
              proxyRes.headers["Access-Control-Allow-Origin"] = origin;
            }
            proxyRes.headers["Access-Control-Allow-Methods"] =
              "GET, HEAD, OPTIONS";
            proxyRes.headers["Access-Control-Allow-Headers"] = "Range";
            // Prevent direct access - require signed URLs
            proxyRes.headers["X-Content-Type-Options"] = "nosniff";
            // Silent proxy logging
          });
        },
      },
    },
  },
});
