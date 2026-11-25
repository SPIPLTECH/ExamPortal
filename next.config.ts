import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root (multiple lockfiles exist in parent dirs).
  turbopack: {
    root: __dirname,
  },
  // (experimental.cpus/workerThreads below cap static-generation workers so a
  // low-RAM box doesn't run out of memory during `next build`.)
  poweredByHeader: false,
  compress: true,
  // Smaller client bundles: only pull the icons / primitives that are actually used.
  experimental: {
    cpus: 1,
    workerThreads: false,
    optimizePackageImports: ["lucide-react", "radix-ui", "sonner"],
  },
  // Cloudinary-hosted images.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
