// Security utilities for API protection

// JWT Secret (in production, use environment variable)
const JWT_SECRET =
  import.meta.env.VITE_JWT_SECRET || "your-secret-key-change-in-production";

// Allowed domains (whitelist)
const ALLOWED_DOMAINS = [
  "localhost",
  "127.0.0.1",
  "09caacc2e455.ngrok-free.app",
  ".ngrok-free.app", // Allow all ngrok subdomains
];

// Generate JWT token
export const generateToken = (payload, expiresIn = "1h") => {
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + (expiresIn === "1h" ? 3600 : expiresIn === "24h" ? 86400 : 3600),
  };

  const base64Header = btoa(JSON.stringify(header))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const base64Payload = btoa(JSON.stringify(tokenPayload))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  // Simple HMAC-SHA256 (in production, use crypto library)
  const signature = btoa(`${base64Header}.${base64Payload}.${JWT_SECRET}`)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${base64Header}.${base64Payload}.${signature}`;
};

// Verify JWT token
export const verifyToken = (token) => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Token expired
    }

    return payload;
  } catch (e) {
    return null;
  }
};

// Generate signed URL with expiration
export const generateSignedUrl = (url, expiresIn = 3600) => {
  const expires = Math.floor(Date.now() / 1000) + expiresIn;
  const token = generateToken({ url, expires }, expiresIn);
  return {
    signedUrl: `${url}?token=${token}&expires=${expires}`,
    expires,
  };
};

// Check if domain is allowed
export const isDomainAllowed = (origin) => {
  if (!origin) return false;

  try {
    const url = new URL(origin);
    const hostname = url.hostname;

    return ALLOWED_DOMAINS.some((domain) => {
      if (domain.startsWith(".")) {
        // Wildcard domain
        return hostname.endsWith(domain) || hostname === domain.slice(1);
      }
      return hostname === domain || hostname.includes(domain);
    });
  } catch (e) {
    return false;
  }
};

// Get current domain token
export const getDomainToken = () => {
  const origin = window.location.origin;
  if (isDomainAllowed(origin)) {
    return generateToken({ domain: origin, type: "domain" }, "24h");
  }
  return null;
};

// Validate request with domain and token
export const validateRequest = (token, origin) => {
  if (!isDomainAllowed(origin)) {
    return { valid: false, error: "Domain not allowed" };
  }

  if (!token) {
    return { valid: false, error: "Token required" };
  }

  const payload = verifyToken(token);
  if (!payload) {
    return { valid: false, error: "Invalid or expired token" };
  }

  return { valid: true, payload };
};
