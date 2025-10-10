const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add 'cjs' to source extensions for compatibility
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];

module.exports = config;