// Vercel API route to proxy video requests and hide actual API URL
export default async function handler(req, res) {
  const { path } = req.query;

  // Reconstruct the video path
  const videoPath = Array.isArray(path) ? "/" + path.join("/") : "/" + path;
  const videoUrl = `https://cmlhz.com${videoPath}`;

  try {
    // Forward the request to the actual video server
    const response = await fetch(videoUrl, {
      method: req.method,
      headers: {
        Range: req.headers.range || "",
        Referer: "https://cmlhz.com",
      },
    });

    // Forward response headers
    const headers = {
      "Content-Type": response.headers.get("content-type") || "video/mp4",
      "Content-Length": response.headers.get("content-length") || "",
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range",
    };

    // Copy range-related headers if present
    if (response.headers.get("content-range")) {
      headers["Content-Range"] = response.headers.get("content-range");
    }

    // Set status code
    res.status(response.status);

    // Set headers
    Object.keys(headers).forEach((key) => {
      if (headers[key]) {
        res.setHeader(key, headers[key]);
      }
    });

    // Stream the video data
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Video proxy error:", error);
    res.status(500).json({ error: "Failed to proxy video" });
  }
}
