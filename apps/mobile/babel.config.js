module.exports = {
  presets: ['@react-native/babel-preset'],
  plugins: [
    // Required by WatermelonDB for decorators
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    // Module resolver so Metro resolves @kanban/* aliases
    [
      'module-resolver',
      {
        root: ['../../packages'],
        alias: {
          '@kanban/types': '../../packages/types/src',
          '@kanban/utils': '../../packages/utils/src',
          '@kanban/store': '../../packages/store/src',
          '@kanban/database': '../../packages/database/src',
          '@kanban/services': '../../packages/services/src',
          '@kanban/ui': '../../packages/ui/src',
        },
      },
    ],
    // Reanimated must be last
    'react-native-reanimated/plugin',
  ],
};
