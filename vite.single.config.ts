import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

// Inline the icon as a data URI and drop PWA-only tags: the single file must work from file://
function inlineIcons(): Plugin {
  const icon = fs.readFileSync(fileURLToPath(new URL('./public/icons/icon-192.png', import.meta.url))).toString('base64');
  return {
    name: 'inline-icons',
    transformIndexHtml(html) {
      return html
        .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" type="image/png" href="data:image/png;base64,${icon}" />`)
        .replace(/<link rel="apple-touch-icon"[^>]*>/, '');
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: false,
  resolve: {
    alias: { 'virtual:pwa-register': fileURLToPath(new URL('./src/pwa-stub.ts', import.meta.url)) },
  },
  build: { outDir: 'dist-single', emptyOutDir: true, chunkSizeWarningLimit: 5000, assetsInlineLimit: 100_000_000 },
  plugins: [inlineIcons(), viteSingleFile({ removeViteModuleLoader: true })],
});
