import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./lib/security/csp";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    // The Content-Security-Policy is per-request (nonce) and is set in proxy.ts.
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
