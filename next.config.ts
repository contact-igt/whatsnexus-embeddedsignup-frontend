import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com"],
  /* config options here */
  // reactCompiler: true,
  transpilePackages: ['lamejs'],

  // experimental: {
    // Optimize package imports for better tree-shaking and faster builds
    // optimizePackageImports: ['lucide-react', 'framer-motion'],
  // },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-2a8283cb141a4a22a2b79661de7294ee.r2.dev",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
