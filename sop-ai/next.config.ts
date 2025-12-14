import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  
  // Standalone output for Docker deployments
  output: 'standalone',
  
  // Optimize for production
  swcMinify: true,
  
  // Image optimization (if you add images later)
  images: {
    unoptimized: true, // Set to false if you add next/image components
  },
};

export default nextConfig;
