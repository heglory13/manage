import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const rawBasePath = (env.VITE_APP_BASE_PATH || '/').trim();
  const normalizedBasePath =
    rawBasePath === '/' ? '/' : `/${rawBasePath.replace(/^\/+|\/+$/g, '')}/`;

  return {
    base: normalizedBasePath,
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    },
    server: {
      port: 3000,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
    },
  };
})
