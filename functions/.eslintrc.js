module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'airbnb-base',
    'eslint:recommended',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['tsconfig.json'],
    sourceType: 'module',
  },
  ignorePatterns: [
    '/lib/**/*', // Ignore built files.
    '/generated/**/*', // Ignore generated files.
    '.eslintrc.js',
  ],
  plugins: [
    '@typescript-eslint',
    'import',
  ],
  rules: {
    quotes: ['error', 'single'],
    'import/no-unresolved': 0,
    indent: ['error', 2],
    'valid-jsdoc': 'off',
    'require-jsdoc': 'off',
    'import/prefer-default-export': 'off',
    'no-restricted-syntax': 'off',
  },
};
