import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ieugxahinfowtlryyzmv.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '4000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '4000',
        pathname: '/**',
      },
    ],
    /*
     * Optimisation is on.
     *
     * It was globally disabled to stop next/image throwing on an unconfigured
     * host, which it did by never resizing or re-encoding anything — so a
     * 2.5MB PNG hero was downloaded whole, on a phone, at full resolution.
     * That was the largest contentful paint.
     *
     * The hosts that actually serve us are listed above, and the two places
     * that take a URL from outside that list — the hero and the product
     * gallery — already pass `unoptimized` per image. Adding a host here is the
     * correct fix for a new source; turning the feature off for the whole site
     * is not.
     */
  },
};

export default nextConfig;
