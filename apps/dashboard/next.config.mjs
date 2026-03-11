/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    // Turbopack configuration (default bundler in Next.js 16+)
    turbopack: {
        resolveAlias: {
            '@synapse/shared': '../../packages/shared/dist/index.js',
            '@synapse/dal': '../../packages/dal/dist/index.js',
        },
    },
};

export default nextConfig;
