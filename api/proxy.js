// Vercel serverless function to proxy API requests
export default async function handler(req, res) {
  const { path } = req.query;

  // Get the full path from query or URL
  const fullPath = Array.isArray(path) ? path.join("/") : path || "";
  const targetUrl = `https://111.90.159.132/${fullPath}${
    req.url.includes("?") ? req.url.split("?").slice(1).join("?") : ""
  }`;

  try {
    const response = await fetch(targetUrl, {
      method: req.method || "GET",
      headers: {
        Accept: "application/json, text/html, */*",
        "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
      },
    });

    const data = await response.text();

    // Forward response
    res.status(response.status);
    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") || "text/html"
    );
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

