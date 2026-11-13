import type { NextConfig } from "next";

// Baseline hardening headers for every route. A full page Content-Security-Policy
// is intentionally not set here: Next.js and Tailwind rely on inline styles/scripts
// and would need nonces or hashes first. frame-ancestors alone cannot break rendering
// and blocks clickjacking of the app and its API responses.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
