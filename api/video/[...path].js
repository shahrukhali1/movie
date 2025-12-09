// Vercel API route to proxy video requests and hide actual API URL
export default async function handler(req, res) {
  const { path } = req.query;

  // Reconstruct the video path
  const videoPath = Array.isArray(path) ? "/" + path.join("/") : "/" + path;
  const videoUrl = `https://cmlhz.com${videoPath}`;

  try {
    // Get Range header for video streaming
    const range = req.headers.range || "";

    // Forward the request to the actual video server
    const fetchOptions = {
      method: req.method,
      headers: {
        Referer: "https://cmlhz.com",
        "User-Agent": "Mozilla/5.0",
      },
    };

    // Add Range header if present (for video streaming)
    if (range) {
      fetchOptions.headers.Range = range;
    }

    const response = await fetch(videoUrl, fetchOptions);

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
    if (response.headers.get("content-range")) {
      headers["Content-Range"] = response.headers.get("content-range");
    }

    // Set status code (206 for partial content, 200 for full)
    res.status(response.status);

    // Set headers
    Object.keys(headers).forEach((key) => {
      if (headers[key]) {
        res.setHeader(key, headers[key]);
      }
    });

    // Stream the video data
    if (response.body) {
      // Use streaming for better performance
      const reader = response.body.getReader();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      // Convert stream to buffer and send
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      res.send(buffer);
    } else {
      // Fallback: get array buffer
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    }
  } catch (error) {
    console.error("Video proxy error:", error);
    res.status(500).json({ error: "Failed to proxy video" });
  }
}
