/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['@synapse/shared'],
    experimental: {
        // Enable server actions
        serverActions: {
            bodySizeLimit: '2mb',
        },
    },
};

export default nextConfig;
