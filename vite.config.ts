import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 2500, emptyOutDir: true },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Juragan Warteg',
        short_name: 'Warteg',
        description: 'Game tycoon warteg pixel ala Kairosoft. Dari gerobak sampai franchise! Dibuat oleh KodeKecil.',
        // not a standard manifest member, kept as credit (browsers ignore unknown keys)
        ...({ author: 'KodeKecil', developer: { name: 'KodeKecil', url: 'https://kodekecil.my.id' } } as object),
        lang: 'id',
        theme_color: '#8a5228',
        background_color: '#1a120c',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,woff,woff2,ico,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
