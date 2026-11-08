import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

const base = '/tkd-practice/';

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'TKD Practice',
        short_name: 'TKD',
        description: 'Taekwondo practice timer, schedule and progress.',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4F6F8',
        theme_color: '#F4F6F8',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['models/**'],
        // The pose model and WebAssembly are big, so they are cached the first time they are used.
        runtimeCaching: [{ urlPattern: ({ url }) => url.pathname.includes('/models/'), handler: 'CacheFirst', options: { cacheName: 'pose-models', expiration: { maxEntries: 8 } } }],
      },
    }),
  ],
  test: { include: ['tests/**/*.test.ts'] },
});
