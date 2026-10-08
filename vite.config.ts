import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createResponseApi } from './server/response-api.mjs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'biscuit-response-api',
      configureServer(server) {
        server.middlewares.use(createResponseApi());
      },
      configurePreviewServer(server) {
        server.middlewares.use(createResponseApi());
      },
    },
  ],
  base: '/',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    fs: {
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem}',
        '**/.git/**',
        '**/data/**',
        '**/server/**',
      ],
    },
    watch: { ignored: ['**/data/**'] },
  },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
