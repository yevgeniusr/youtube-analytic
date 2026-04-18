/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ['react-markdown', 'remark-gfm'],
};

export default nextConfig;
