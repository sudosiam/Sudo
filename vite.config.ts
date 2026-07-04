import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import pkg from './package.json';

const appVersion = pkg.version;

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  resolve: {
    // Prevent duplicate React copies after Vite HMR reconnects (invalid hook call).
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
  },
  plugins: [
    basicSsl(),
    react(),
    tailwindcss(),
    wasm(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,wasm}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      manifest: {
        name: 'Sudo — Business Finance',
        short_name: 'Sudo',
        description: 'Offline-first business finance & accounting',
        theme_color: '#fafafa',
        background_color: '#fafafa',
        display: 'standalone',
        start_url: '/',
        id: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  worker: {
    format: 'es',
    plugins: () => [wasm()],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query'],
    // These packages contain web workers and WASM files that must not be pre-bundled.
    exclude: ['@journeyapps/wa-sqlite', '@powersync/web'],
  },
  server: {
    // Required for mobile testing on LAN — WASM workers need a secure context
    host: true,
    watch: {
      // Brand assets are often locked by image viewers on Windows (EBUSY).
      ignored: ['**/brand/**'],
    },
  },
});
