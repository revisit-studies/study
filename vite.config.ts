import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {

  const env = loadEnv(mode, process.cwd());

  return {
  base: command === 'build' ? env.VITE_BASE_PATH : '/',
    plugins: [
      react(),
    ],
  };
});
