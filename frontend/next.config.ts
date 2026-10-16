import type { NextConfig } from "next";

// Demo/tunnel mode (docs/DEMO-NGROK.md): serve the API under the frontend's own
// origin so one tunnel (one host) carries both and the session cookie stays
// first-party. Build with NEXT_PUBLIC_API_URL=/api and API_PROXY_TARGET set.
// Unset in normal deploys: no rewrite, the browser calls the API host directly.
const apiProxyTarget = process.env.API_PROXY_TARGET;

const nextConfig: NextConfig = {
  // Minimal server.js bundle for the Docker image (docker/frontend/Dockerfile)
  output: "standalone",
  ...(apiProxyTarget && {
    rewrites: async () => [{ source: "/api/:path*", destination: `${apiProxyTarget}/:path*` }],
  }),
};

export default nextConfig;
