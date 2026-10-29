/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Externalize native Node.js modules that cannot be bundled by Webpack.
    serverComponentsExternalPackages: ['@node-rs/argon2'],
  },
  // For extra safety, also add the module to Webpack externals for server builds.
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('@node-rs/argon2');
    }
    return config;
  },
};

module.exports = nextConfig;
