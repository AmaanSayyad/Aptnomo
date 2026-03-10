import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  // @ts-ignore
  turbopack: {
    root: 'c:\\Users\\enliven\\Documents\\GitHub\\Aptnomo',
  },
};

export default nextConfig;
