import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Minimal server.js bundle for the Docker image (docker/frontend/Dockerfile)
  output: "standalone",
};

export default nextConfig;
