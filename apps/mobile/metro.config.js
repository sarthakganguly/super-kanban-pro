/**
 * Metro configuration for apps/mobile
 *
 * Key concerns:
 *   1. Monorepo: Metro must watch all packages/ directories, not just this app.
 *   2. Symlinks: yarn workspaces creates symlinks; Metro needs to follow them.
 *   3. React Native Web: no special Metro config needed here — web uses Webpack.
 */

const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

// Root of the monorepo — two levels up from apps/mobile
const monorepoRoot = path.resolve(__dirname, '../..');

const config = {
  // Watch the whole monorepo so hot-reload works when editing packages/
  watchFolders: [monorepoRoot],

  resolver: {
    // Allow Metro to follow symlinks created by yarn workspaces
    unstable_enableSymlinks: true,

    // Ensure only one copy of React is resolved (prevents hook errors)
    extraNodeModules: new Proxy(
      {},
      {
        get: (_, name) =>
          path.join(__dirname, 'node_modules', name),
      },
    ),
  },

  transformer: {
    // Enable Hermes bytecode for faster startup on Android
    hermesParser: true,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
