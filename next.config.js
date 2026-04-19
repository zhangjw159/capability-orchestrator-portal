/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: false,
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
