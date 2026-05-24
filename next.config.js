/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "10mb" }
  }
};

module.exports = nextConfig;
