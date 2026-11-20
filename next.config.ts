import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root (multiple lockfiles exist in parent dirs).
  turbopack: {
    root: __dirname,
  },
  // This dev box has limited free RAM; cap static-generation workers so the
  // build doesn't spawn one worker per core and run out of memory.
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
  // Cloudinary-hosted images.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
