/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // PPR desactivado para compatibilidad máxima en Vercel hobby
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  // Leaflet requiere que se importe solo en el cliente
  webpack: (config) => {
    config.resolve.fallback = { fs: false };
    return config;
  },
};

export default nextConfig;
