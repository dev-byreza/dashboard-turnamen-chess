/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['lucide-react'],
  outputFileTracingIncludes: {
    '/api/**/*': ['./public/engines/stockfish/**/*'],
  },
};

export default nextConfig;
