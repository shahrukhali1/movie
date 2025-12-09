// Vercel serverless function to proxy video requests
export default async function handler(req, res) {
  const { path } = req.query;

  // Get the full path from query or URL
  const fullPath = Array.isArray(path) ? path.join("/") : path || "";

  // Remove token and expires from path if present (for security, we validate but don't forward)
  const cleanPath = fullPath.split("?")[0];
  const targetUrl = `https://cmlhz.com/${cleanPath}`;

  try {
    // Get Range header for video streaming
    const range = req.headers.range;

    const headers = {
      Referer: "https://cmlhz.com",
      "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
    };

    if (range) {
      headers["Range"] = range;
    }

    const response = await fetch(targetUrl, {
      method: req.method || "GET",
      headers,
    });

    // Forward response headers
    const contentType = response.headers.get("content-type");
    const contentLength = response.headers.get("content-length");
    const contentRange = response.headers.get("content-range");
    const acceptRanges = response.headers.get("accept-ranges");

    res.status(response.status);

    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }
    if (contentRange) {
      res.setHeader("Content-Range", contentRange);
    }
    if (acceptRanges) {
      res.setHeader("Accept-Ranges", acceptRanges);
    }

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range");

    // Stream the video data
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


