const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);
const workspaceRoot = path.resolve(__dirname, "../..");

config.watchFolders = Array.from(new Set([workspaceRoot, ...(config.watchFolders || [])]));

module.exports = config;
