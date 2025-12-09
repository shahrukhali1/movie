// Test API route
export default async function handler(req, res) {
  res.status(200).json({
    message: "API route works!",
    query: req.query,
    url: req.url,
  });
}
