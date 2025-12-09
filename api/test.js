// Test API route to verify Vercel API routes are working
export default async function handler(req, res) {
  res.status(200).json({
    message: "API route is working",
    query: req.query,
    url: req.url,
  });
}
