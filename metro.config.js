const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@vercel/oidc': path.resolve(__dirname, 'polyfills/empty.js'),
};

module.exports = config;
