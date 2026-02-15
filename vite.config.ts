import path from 'path';
import { webcrypto } from 'node:crypto';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    loadEnv(mode, '.', '');
    if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== 'function') {
      Object.defineProperty(globalThis, 'crypto', {
        value: webcrypto,
        configurable: true,
      });
    }
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
