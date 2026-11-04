// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// pdf.js ships inside the app as .txt assets (see scripts/copy-pdfjs.mjs).
config.resolver.assetExts.push('txt');

module.exports = config;
