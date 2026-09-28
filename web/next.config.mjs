/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Derive an image host origin from the API URL (uploads are served at <api>/uploads).
let imageHost = 'localhost';
let imagePort = 5000;
try {
  const u = new URL(apiUrl);
  imageHost = u.hostname;
  imagePort = Number(u.port || (u.protocol === 'https' ? 443 : 80));
} catch {
  /* keep defaults */
}

const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: imageHost, port: String(imagePort), pathname: '/**' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
