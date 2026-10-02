/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    const videoAiInternal = (process.env.TGG_VIDEO_AI_INTERNAL_URL ?? 'http://video-ai:10050').replace(/\/$/, '');
    return [
      {
        source: '/video-ai/:path*',
        destination: videoAiInternal + '/:path*',
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.steamstatic.com',
      },
    ],
  },
};

export default nextConfig;
