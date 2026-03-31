import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/client',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        rewrite: (p) => p.replace(/^\/api/, '/api'),
      },
      '/uploads': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        rewrite: (p) => p,
      },
    },
  },
});
