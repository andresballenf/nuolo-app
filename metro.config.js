const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add any custom configuration here
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];

module.exports = config;