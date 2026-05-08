import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Auth agent
      '/proxy/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/auth/, ''),
      },
      // Document agent
      '/proxy/document': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/document/, ''),
      },
      // Workflow agent
      '/proxy/workflow': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/workflow/, ''),
      },
      // Task agent
      '/proxy/task': {
        target: 'http://localhost:3004',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/task/, ''),
      },
      // Audit agent
      '/proxy/audit': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/audit/, ''),
      },
      // Notification agent
      '/proxy/notification': {
        target: 'http://localhost:3006',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/notification/, ''),
      },
      // Search/OCR agent
      '/proxy/search': {
        target: 'http://localhost:3007',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/search/, ''),
      },
      // Orchestrator
      '/proxy/orchestrator': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/orchestrator/, ''),
      },
    },
  },
});
