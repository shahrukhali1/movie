// Vercel API route to proxy video requests - using query parameter instead of catch-all
export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range");
    return res.status(200).end();
  }

  try {
    // Get video path from query parameter
    const videoPath = req.query.path || req.query.video;

    if (!videoPath) {
      // Try to extract from URL
      const url = req.url || "";
      const match =
        url.match(/\/api\/video-proxy[?&]path=([^&]+)/) ||
        url.match(/\/api\/video-proxy[?&]video=([^&]+)/);
      if (match && match[1]) {
        const decodedPath = decodeURIComponent(match[1]);
        const fullPath = decodedPath.startsWith("/")
          ? decodedPath
          : `/${decodedPath}`;
        const videoUrl = `https://cmlhz.com${fullPath}`;

        // Get Range header
        const range = req.headers.range || "";
        const fetchOptions = {
          method: req.method || "GET",
          headers: {
            Referer: "https://cmlhz.com",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        };
        if (range) fetchOptions.headers.Range = range;

        const response = await fetch(videoUrl, fetchOptions);
        if (!response.ok && response.status !== 206) {
          return res
            .status(response.status)
            .json({ error: `Failed: ${response.status}` });
        }

        const headers = {
          "Content-Type": response.headers.get("content-type") || "video/mp4",
          "Accept-Ranges": "bytes",
          "Access-Control-Allow-Origin": "*",
        };
        const contentLength = response.headers.get("content-length");
        if (contentLength) headers["Content-Length"] = contentLength;
        const contentRange = response.headers.get("content-range");
        if (contentRange) headers["Content-Range"] = contentRange;

        res.status(response.status);
        Object.keys(headers).forEach((key) => {
          if (headers[key]) res.setHeader(key, headers[key]);
        });

        const arrayBuffer = await response.arrayBuffer();
        // eslint-disable-next-line no-undef
        const buffer = Buffer.from(arrayBuffer);
        res.send(buffer);
        return;
      }

      return res
        .status(400)
        .json({ error: "Video path required", url: req.url, query: req.query });
    }

    // Decode and construct path
    const decodedPath = decodeURIComponent(videoPath);
    const fullPath = decodedPath.startsWith("/")
      ? decodedPath
      : `/${decodedPath}`;
    const videoUrl = `https://cmlhz.com${fullPath}`;

    // Get Range header
    const range = req.headers.range || "";
    const fetchOptions = {
      method: req.method || "GET",
      headers: {
        Referer: "https://cmlhz.com",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    };
    if (range) fetchOptions.headers.Range = range;

    const response = await fetch(videoUrl, fetchOptions);
    if (!response.ok && response.status !== 206) {
      return res.status(response.status).json({
        error: `Failed to fetch video: ${response.status}`,
        videoUrl,
      });
    }

    const headers = {
      "Content-Type": response.headers.get("content-type") || "video/mp4",
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range",
    };
    const contentLength = response.headers.get("content-length");
    if (contentLength) headers["Content-Length"] = contentLength;
    const contentRange = response.headers.get("content-range");
    if (contentRange) headers["Content-Range"] = contentRange;

    res.status(response.status);
    Object.keys(headers).forEach((key) => {
      if (headers[key]) res.setHeader(key, headers[key]);
    });

    const arrayBuffer = await response.arrayBuffer();
    // eslint-disable-next-line no-undef
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (error) {
    console.error("Video proxy error:", error);
    res.status(500).json({
      error: "Failed to proxy video",
      message: error.message,
    });
  }
}
