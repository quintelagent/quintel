import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const API = process.env.QNTL_API || 'http://127.0.0.1:8787';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@engine': fileURLToPath(new URL('../engine/src', import.meta.url)) } },
  server: { proxy: { '/api': { target: API, changeOrigin: true } }, fs: { allow: ['..'] } },
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 900 },
});
