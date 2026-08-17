/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '4000', pathname: '/uploads/**' },
    ],
    unoptimized: true,
  },
  async redirects() {
    return [
      { source: '/', destination: '/home', permanent: false },
    ];
  },
};
module.exports = nextConfig;
