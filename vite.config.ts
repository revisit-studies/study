import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import importMetaUrlPlugin from '@codingame/esbuild-import-meta-url-plugin';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    base: command === 'build' ? env.VITE_BASE_PATH : '/',
    plugins: [
      react({ devTarget: 'es2022' }), importMetaUrlPlugin,
    ],
    resolve: {
      alias: {
        // /esm/icons/index.mjs only exports the icons statically, so no separate chunks are created
        '@tabler/icons-react': '@tabler/icons-react/dist/esm/icons/index.mjs',
      },
      dedupe: ['vscode', 'monaco-vscode-api'],
    },
  };
});
