const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

const config = getDefaultConfig(__dirname);
const workspaceRoot = path.resolve(__dirname, "../..");

if (fs.existsSync(path.join(workspaceRoot, "pnpm-workspace.yaml"))) {
  config.watchFolders = Array.from(new Set([workspaceRoot, ...(config.watchFolders || [])]));
}

module.exports = config;
