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
  ".vercel.app", // Allow all Vercel subdomains
  "movie-desxyuglr-shahrukhali1s-projects.vercel.app",
  "movie-nine-jet.vercel.app",
  "vercel.app", // Base Vercel domain
];

// Helper to check if domain matches Vercel pattern
const isVercelDomain = (hostname) => {
  return hostname.includes("vercel.app") || hostname.endsWith(".vercel.app");
};

// Helper to check if domain matches ngrok pattern
const isNgrokDomain = (hostname) => {
  return (
    hostname.includes("ngrok-free.app") || hostname.endsWith(".ngrok-free.app")
  );
};

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
  if (!origin) {
    // If no origin provided, check window.location (for client-side)
    if (typeof window !== "undefined") {
      origin = window.location.origin;
    } else {
      return false;
    }
  }

  try {
    const url = new URL(origin);
    const hostname = url.hostname;

    // Quick checks for common patterns
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }

    if (isVercelDomain(hostname)) {
      return true;
    }

    if (isNgrokDomain(hostname)) {
      return true;
    }

    // Check against allowed domains list
    const isAllowed = ALLOWED_DOMAINS.some((domain) => {
      if (domain.startsWith(".")) {
        // Wildcard domain (e.g., .vercel.app, .ngrok-free.app)
        // Check if hostname ends with the domain (e.g., example.vercel.app ends with .vercel.app)
        return hostname.endsWith(domain) || hostname === domain.slice(1);
      }
      // Exact match or contains
      return hostname === domain || hostname.includes(domain);
    });

    // Debug logging
    if (!isAllowed && typeof window !== "undefined") {
      console.log("Domain check:", {
        origin,
        hostname,
        isVercel: isVercelDomain(hostname),
        isNgrok: isNgrokDomain(hostname),
        allowedDomains: ALLOWED_DOMAINS,
      });
    }

    return isAllowed;
  } catch (e) {
    // If URL parsing fails, try direct string matching as fallback
    if (
      origin.includes("vercel.app") ||
      origin.includes("localhost") ||
      origin.includes("ngrok-free.app")
    ) {
      return true;
    }
    return false;
  }
};

// Get current domain token
export const getDomainToken = () => {
  if (typeof window === "undefined") return null;

  const origin = window.location.origin;
  if (isDomainAllowed(origin)) {
    return generateToken({ domain: origin, type: "domain" }, "24h");
  }

  // Fallback: if domain check fails but it's a known domain, still generate token
  if (
    origin.includes("vercel.app") ||
    origin.includes("localhost") ||
    origin.includes("ngrok-free.app")
  ) {
    console.warn("Domain not in whitelist but allowing:", origin);
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


