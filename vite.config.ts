/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    base: command === 'build' ? env.VITE_BASE_PATH : '/',
    plugins: [
      react({ devTarget: 'es2022' }),
    ],
    resolve: {
      alias: {
        // /esm/icons/index.mjs only exports the icons statically, so no separate chunks are created
        '@tabler/icons-react': '@tabler/icons-react/dist/esm/icons/index.mjs',
      },
    },
    test: {
      environment: 'jsdom',
      exclude: ['./tests/**', 'node_modules/**'],
      setupFiles: ['vitest-localstorage-mock'],
      fileParallelism: true,
      maxWorkers: '100%',
      minWorkers: 1,
      coverage: {
        provider: 'v8',
        all: true,
        exclude: [
          'public/**',
          'src/public/**',
          'dist/**',
          'eslint.config.js',
          'vite.config.ts',
          'playwright.config.ts',
          'src/vite-env.d.ts',
          'src/lodash.d.ts',
          'src/main.tsx',
          'src/analysis/types.ts',
          'tests/checkSavedAnswers.ts',
          'tests/utils.ts',
        ],
      },
    },
  };
});
