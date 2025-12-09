// Vercel API route to proxy video requests and hide actual API URL
export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range");
    return res.status(200).end();
  }

  try {
    // Extract path from query parameters (Vercel catch-all route format)
    // For [...path], Vercel passes segments as array in req.query.path
    const pathParam = req.query.path;

    // Reconstruct the video path
    let videoPath = "";

    if (Array.isArray(pathParam) && pathParam.length > 0) {
      // Multiple path segments: ['movies-xxx', 'jun-24', 'Troll-2-2025.mp4']
      videoPath = "/" + pathParam.join("/");
    } else if (typeof pathParam === "string" && pathParam) {
      // Single path segment
      videoPath = "/" + pathParam;
    } else {
      // Fallback: extract from URL
      // This handles cases where query params might not be populated
      const url = req.url || "";
      // Try to match /api/video/... pattern first
      let match = url.match(/\/api\/video(\/.+)/);
      if (!match) {
        // Try /video/... pattern
        match = url.match(/\/video(\/.+)/);
      }
      if (match && match[1]) {
        videoPath = match[1];
      } else {
        // Last resort: check if path is in query as string
        const queryKeys = Object.keys(req.query);
        if (queryKeys.length > 0 && queryKeys[0] !== "path") {
          // Path might be in a different query param
          const firstKey = queryKeys[0];
          const firstValue = req.query[firstKey];
          if (typeof firstValue === "string") {
            videoPath = "/" + firstValue;
          }
        }

        if (!videoPath) {
          return res.status(400).json({
            error: "Video path not found",
            query: req.query,
            url: req.url,
            pathParam: pathParam,
            pathParamType: typeof pathParam,
            method: req.method,
          });
        }
      }
    }

    // Construct the actual video URL
    const videoUrl = `https://cmlhz.com${videoPath}`;

    // Get Range header for video streaming
    const range = req.headers.range || "";

    // Forward the request to the actual video server
    const fetchOptions = {
      method: req.method || "GET",
      headers: {
        Referer: "https://cmlhz.com",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    };

    // Add Range header if present (for video streaming)
    if (range) {
      fetchOptions.headers.Range = range;
    }

    // Fetch video from source
    const response = await fetch(videoUrl, fetchOptions);

    // Handle non-OK responses (206 is OK for partial content)
    if (!response.ok && response.status !== 206) {
      return res.status(response.status).json({
        error: `Failed to fetch video: ${response.status}`,
        videoUrl,
        status: response.status,
        statusText: response.statusText,
      });
    }

    // Forward response headers
    const headers = {
      "Content-Type": response.headers.get("content-type") || "video/mp4",
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range",
    };

    // Copy content-length if present
    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      headers["Content-Length"] = contentLength;
    }

    // Copy range-related headers if present (for partial content)
    const contentRange = response.headers.get("content-range");
    if (contentRange) {
      headers["Content-Range"] = contentRange;
    }

    // Set status code (206 for partial content, 200 for full)
    res.status(response.status);

    // Set all headers
    Object.keys(headers).forEach((key) => {
      if (headers[key]) {
        res.setHeader(key, headers[key]);
      }
    });

    // Stream the video data - use arrayBuffer for Vercel compatibility
    const arrayBuffer = await response.arrayBuffer();
    // Convert ArrayBuffer to Buffer for Node.js compatibility
    // eslint-disable-next-line no-undef
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (error) {
    console.error("Video proxy error:", error);
    res.status(500).json({
      error: "Failed to proxy video",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}
