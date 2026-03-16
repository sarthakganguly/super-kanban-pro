module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: { jsx: true },
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  settings: {
    react: { version: 'detect' },
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  rules: {
    // Enforce consistent import ordering
    'sort-imports': ['error', { ignoreDeclarationSort: true }],

    // React — we use the new JSX transform so no need to import React in scope
    'react/react-in-jsx-scope': 'off',

    // TypeScript — be strict but practical
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',

    // Performance — avoid accidental re-renders
    'react-hooks/exhaustive-deps': 'error',
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js', '*.mjs'],
};
