// Netlify Function to proxy video requests and hide actual API URL
exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Range",
      },
      body: "",
    };
  }

  try {
    // Extract video path from query parameter (from redirect rule)
    // The redirect rule passes path as query param: ?path=movies-xxx/jun-24/file.mp4
    let videoPath = event.queryStringParameters?.path;

    if (!videoPath) {
      // Fallback: try to extract from path
      const pathMatch = event.path.match(/\/video\/(.+)/);
      if (pathMatch) {
        videoPath = pathMatch[1];
      } else {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            error: "Video path required",
            path: event.path,
            query: event.queryStringParameters,
          }),
        };
      }
    }

    // Decode and construct full path
    const decodedPath = decodeURIComponent(videoPath);
    const fullPath = decodedPath.startsWith("/")
      ? decodedPath
      : `/${decodedPath}`;
    const videoUrl = `https://cmlhz.com${fullPath}`;

    // Get Range header for video streaming
    const range = event.headers.range || event.headers.Range || "";

    // Forward the request to the actual video server
    const fetchOptions = {
      method: event.httpMethod || "GET",
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
      return {
        statusCode: response.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: `Failed to fetch video: ${response.status}`,
          videoUrl,
        }),
      };
    }

    // Get response body as array buffer
    const arrayBuffer = await response.arrayBuffer();
    // Convert to base64 for Netlify Functions
    // Use Uint8Array and manual base64 encoding since Buffer might not be available
    const uint8Array = new Uint8Array(arrayBuffer);
    let binaryString = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }
    const base64String = btoa(binaryString);

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

    // Return response with base64 encoded body for Netlify Functions
    // Note: For very large files (>6MB), consider using Edge Functions or direct URL
    return {
      statusCode: response.status,
      headers,
      body: base64String,
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error("Video proxy error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to proxy video",
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      }),
    };
  }
};
