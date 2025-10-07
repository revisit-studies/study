import { fixupConfigRules, fixupPluginRules } from '@eslint/compat';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import react from 'eslint-plugin-react';
import globals from 'globals';
// eslint-disable-next-line import/no-unresolved -- This is throwing a false positive
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [{
  ignores: ['public/*'],
}, ...fixupConfigRules(compat.extends(
  'airbnb-base',
  'airbnb/rules/react',
  'plugin:react/recommended',
  'eslint:recommended',
  'plugin:import/typescript',
  'plugin:@typescript-eslint/recommended',
  'plugin:react-hooks/recommended',
)), {
  plugins: {
    '@typescript-eslint': fixupPluginRules(typescriptEslint),
    react: fixupPluginRules(react),
  },

  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.node,
    },

    parser: tsParser,
    ecmaVersion: 'latest',
    sourceType: 'module',
  },

  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.d.ts'],
      },
    },
  },

  rules: {
    'class-methods-use-this': 'off',
    'linebreak-style': 'off',
    'no-restricted-exports': 'off',
    'no-restricted-syntax': 'off',
    'no-underscore-dangle': 'off',
    'no-nested-ternary': 'off',

    'no-console': ['error', {
      allow: ['warn', 'error'],
    }],

    '@typescript-eslint/no-unused-expressions': ['error', {
      allowShortCircuit: true,
      allowTernary: true,
      allowTaggedTemplates: true,
    }],

    'react/no-array-index-key': 'off',
    'jsx-a11y/click-events-have-key-events': 'off',
    'no-return-await': 'off',

    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],

    'max-classes-per-file': 'off',

    'no-param-reassign': ['error', {
      props: false,
    }],

    'cypress/unsafe-to-chain-command': 'off',
    'import/no-extraneous-dependencies': 'off',
    'import/prefer-default-export': 'off',
    'import/order': 'error',

    'prefer-destructuring': ['warn', {
      object: true,
      array: false,
    }],

    'prefer-promise-reject-errors': 'warn',
    'prefer-spread': 'warn',
    'react/react-in-jsx-scope': 0,
    'max-len': 0,
    'react/jsx-filename-extension': 0,
    'import/extensions': ['error', 'never'],
    '@typescript-eslint/ban-ts-comment': 'warn',
    'react/destructuring-assignment': 'off',
    'react/jsx-props-no-spreading': 'off',
    'react/no-unused-class-component-methods': 'warn',
    'react/require-default-props': 'off',

    'react/static-property-placement': ['warn', 'property assignment', {
      childContextTypes: 'static getter',
      contextTypes: 'static public field',
      contextType: 'static public field',
      displayName: 'static public field',
    }],
  },
}];
