import type { NextConfig } from "next";

// Same-origin proxy to the backend: the browser only ever talks to this
// Next.js server, so the session cookie the backend sets is first-party
// (no cross-site cookie/CORS complications between :3000 and :8000).
const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_INTERNAL_URL}/api/:path*` }];
  },
};

export default nextConfig;
