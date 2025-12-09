// Netlify Edge Function to proxy video requests with streaming support
export default async (request, context) => {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Range",
      },
    });
  }

  try {
    // Extract video path from URL
    const url = new URL(request.url);
    const videoPath =
      url.searchParams.get("path") || url.pathname.replace("/video/", "");

    if (!videoPath) {
      return new Response(JSON.stringify({ error: "Video path required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Decode and construct full path
    const decodedPath = decodeURIComponent(videoPath);
    const fullPath = decodedPath.startsWith("/")
      ? decodedPath
      : `/${decodedPath}`;
    const videoUrl = `https://cmlhz.com${fullPath}`;

    // Get Range header for video streaming
    const range = request.headers.get("range") || "";

    // Forward the request to the actual video server
    const fetchOptions = {
      method: request.method,
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
      return new Response(
        JSON.stringify({
          error: `Failed to fetch video: ${response.status}`,
          videoUrl,
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Forward response headers
    const headers = new Headers({
      "Content-Type": response.headers.get("content-type") || "video/mp4",
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range",
    });

    // Copy content-length if present
    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    // Copy range-related headers if present (for partial content)
    const contentRange = response.headers.get("content-range");
    if (contentRange) {
      headers.set("Content-Range", contentRange);
    }

    // Return streaming response (Edge Functions support streaming)
    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error("Video proxy error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to proxy video",
        message: error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
};
